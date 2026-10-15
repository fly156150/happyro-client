import Session from 'Engine/SessionStorage.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import { createGameInventory } from './GameInventory.js';
import { itemQuantity } from './InventoryItems.js';
import { showInteraction, interactionSnapshot, clearInteraction } from './ServerInteraction.js';
let unread = false;
export const gameMailUnread = () => unread;
export function setGameMailUnread(value) {
	unread = Boolean(value);
}
const bytes = value => new TextEncoder().encode(value).length;
const key = mail => `${mail.openType}:${mail.MailID}`;
const identity = item => JSON.stringify([item.ITID, item.RefiningLevel, item.slot, item.Options]);
const send = (name, fields = {}) => {
	const packet = new PACKET.CZ[name]();
	Object.assign(packet, fields);
	Network.sendPacket(packet);
};
export function currentGameMail() {
	const state = interactionSnapshot();
	return state?.kind === 'mail' ? state.service : null;
}
export function receiveGameMail(kind, packet) {
	currentGameMail()?.receive(kind, packet);
}
export function openGameMail(canOperate = () => true) {
	if (!canOperate() || !Session.Playing || !Session.Entity || Session.Entity.action === Session.Entity.ACTION.DIE)
		return null;
	if (currentGameMail()) return currentGameMail();
	const token = {},
		details = new Map(),
		deleting = new Set();
	let guard = () => !Session.FreezeUI,
		closed = false,
		pending = null,
		list = [],
		selected = null,
		writing = false,
		attachments = [],
		recipient = null,
		messageKind = 'info',
		message = '',
		revision = 0,
		weight = 0;
	const setMessage = (text, kind) => {
		message = text;
		messageKind = kind;
	};
	const alive = () =>
		!closed &&
		interactionSnapshot()?.token === token &&
		guard() &&
		Session.Playing &&
		Session.Entity &&
		Session.Entity.action !== Session.Entity.ACTION.DIE;
	const allowed = () => alive() && !pending;
	const inventory = createGameInventory(allowed);
	const request = (name, fields, wait) => {
		pending = wait;
		setMessage('等待服务器回复', 'pending');
		send(name, fields);
	};
	const draft = { receiver: '', title: '', body: '', zeny: 0 };
	const service = {
		setOperationGuard: value => {
			guard = value;
		},
		snapshot: () => ({
			list: list.map(m => ({ ...m, deleting: deleting.has(key(m)) })),
			selected,
			detail: details.has(selected)
				? {
						...details.get(selected),
						describedItems: details.get(selected).ItemList.map(item => inventory.describe(item))
					}
				: null,
			writing,
			draft: { ...draft },
			recipient,
			attachments: attachments.map(i => ({ ...inventory.describe(i), identity: i.identity })),
			inventory: inventory.snapshot().filter(i => !i.worn),
			pending: Boolean(pending),
			allowed: Boolean(allowed()),
			message,
			messageKind,
			revision,
			weight,
			wallet: Session.zeny,
			fee: attachments.length * 2500 + Math.floor(draft.zeny * 0.02)
		}),
		refresh() {
			if (!allowed() || writing) return;
			deleting.clear();
			request('UPDATE_ALL_RODEX', {}, { kind: 'list' });
		},
		read(mailKey) {
			if (!allowed() || writing) return;
			const mail = list.find(m => key(m) === mailKey);
			if (!mail) return;
			selected = mailKey;
			request('REQ_READ_RODEX', mail, { kind: 'read', key: mailKey });
		},
		claim(type) {
			if (!allowed() || writing || !['items', 'zeny'].includes(type)) return;
			const mail = details.get(selected);
			if (!mail || (type === 'items' ? !mail.ItemList.length : !mail.zeny)) return;
			request(type === 'items' ? 'REQ_ITEM_FROM_RODEX' : 'REQ_ZENY_FROM_RODEX', mail, {
				kind: type,
				key: selected
			});
		},
		delete() {
			if (!allowed() || writing) return;
			const mail = details.get(selected);
			if (!mail || mail.ItemList.length || mail.zeny || deleting.has(selected)) return;
			deleting.add(selected);
			send('REQ_DELETE_RODEX', mail);
			setMessage('已请求删除；以列表更新为准，可刷新核对', 'pending');
		},
		compose() {
			if (!allowed() || writing) return;
			request('REQ_OPEN_WRITE_RODEX', {}, { kind: 'compose' });
		},
		change(field, value) {
			if (!allowed() || !writing || !Object.hasOwn(draft, field)) return;
			if (field === 'receiver') recipient = null;
			draft[field] = value;
		},
		validate() {
			if (!allowed() || !writing) return;
			const name = draft.receiver.trim();
			if (!name || bytes(name) > 23 || /[\0\t\r\n]/.test(name)) {
				setMessage('收件人姓名无效（最多 23 字节）', 'error');
				return;
			}
			recipient = null;
			request('CHECK_RODEX_RECEIVE', { name }, { kind: 'validate', name });
		},
		add(index, id, count) {
			if (!allowed() || !writing) return;
			const item = Inventory.getUI().list.find(i => i.index === index && i.ITID === id);
			const existing = attachments.find(i => i.index === index);
			if (
				!item ||
				item.equipped ||
				item.equipSwitch ||
				!Number.isInteger(count) ||
				count <= 0 ||
				count > 32767 ||
				count + (existing?.count || 0) > itemQuantity(item) ||
				(!existing && attachments.length >= 5)
			) {
				setMessage('物品或数量无效，最多附加五种物品', 'error');
				return;
			}
			request('REQ_ADD_ITEM_RODEX', { index, count }, { kind: 'add', index, identity: identity(item) });
		},
		remove(index, count) {
			if (!allowed() || !writing) return;
			const item = attachments.find(i => i.index === index);
			if (!item || !Number.isInteger(count) || count <= 0 || count > item.count) {
				setMessage('附件已变化，请重新选择', 'error');
				return;
			}
			request('REQ_REMOVE_RODEX_ITEM', { index, count }, { kind: 'remove', index });
		},
		review() {
			if (!allowed() || !writing) return { error: '当前无法发送' };
			if (!recipient || recipient.name !== draft.receiver.trim()) return { error: '请先校验收件人' };
			if (
				!draft.title.trim() ||
				bytes(draft.title) > 39 ||
				bytes(draft.body) > 499 ||
				/[\0]/.test(draft.title + draft.body)
			)
				return { error: '标题最多 39 字节，正文最多 499 字节，标题不能为空' };
			if (!Number.isInteger(draft.zeny) || draft.zeny < 0 || draft.zeny > 2147483647)
				return { error: '附件金额无效' };
			const fee = attachments.length * 2500 + Math.floor(draft.zeny * 0.02);
			if (draft.zeny + fee > Session.zeny) return { error: '余额不足以支付金额和预计邮费' };
			for (const item of attachments) {
				const live = Inventory.getUI().list.find(i => i.index === item.index);
				if (!live || identity(live) !== item.identity || itemQuantity(live) < item.count || live.equipped)
					return { error: '附件已变化，请移除后重新选择' };
			}
			return {
				receiver: recipient.name,
				zeny: draft.zeny,
				fee,
				title: draft.title,
				body: draft.body,
				items: attachments.map(i => ({ index: i.index, count: i.count, identity: i.identity })),
				CharID: recipient.CharID
			};
		},
		send(review) {
			const next = service.review();
			if (next.error || JSON.stringify(next) !== JSON.stringify(review)) {
				setMessage(next.error || '内容已变化，请重新确认', 'error');
				return;
			}
			const title = draft.title + '\0',
				body = draft.body + '\0';
			request(
				'REQ_SEND_RODEX2',
				{
					receiver: recipient.name,
					sender: Session.Entity.display.name,
					zeny: draft.zeny,
					CharID: recipient.CharID,
					title,
					body,
					Titlelength: bytes(title),
					Bodylength: bytes(body)
				},
				{ kind: 'send' }
			);
		},
		cancelCompose() {
			if (!alive() || pending?.kind === 'send') return;
			if (writing || pending?.kind === 'compose') send('REQ_CANCEL_WRITE_RODEX');
			pending = null;
			writing = false;
			attachments = [];
			recipient = null;
			revision++;
			setMessage('', 'info');
		},
		close() {
			if (closed || interactionSnapshot()?.token !== token) return;
			if (writing || pending?.kind === 'compose') send('REQ_CANCEL_WRITE_RODEX');
			closed = true;
			send('CLOSE_RODEXBOX');
			clearInteraction('mail');
		},
		receive(kind, pkt) {
			if (closed || interactionSnapshot()?.token !== token) return;
			if (kind === 'list') {
				if (pending?.kind !== 'list') return;
				list = pkt.MailList;
				details.clear();
				selected = null;
				deleting.clear();
				pending = null;
				setMessage('', 'info');
				revision++;
				return;
			}
			if (kind === 'listFailed') {
				if (pending?.kind === 'list') {
					pending = null;
					setMessage('邮件读取失败，可重新刷新', 'error');
				}
				return;
			}
			if (kind === 'delete') {
				const id = key(pkt);
				list = list.filter(m => key(m) !== id);
				details.delete(id);
				deleting.delete(id);
				if (selected === id) selected = null;
				setMessage('', 'info');
				revision++;
				return;
			}
			if (!pending || pending.kind !== kind) return;
			const wait = pending;
			if (['read', 'items', 'zeny'].includes(kind) && key(pkt) !== wait.key) return;
			// Failed add replies contain only the result; their item index is zero.
			if (kind === 'add' && !pkt.result && pkt.index !== wait.index) return;
			if (kind === 'remove' && pkt.index !== wait.index) return;
			pending = null;
			if (kind === 'read') {
				details.set(wait.key, { ...list.find(m => key(m) === wait.key), ...pkt });
				const row = list.find(m => key(m) === wait.key);
				if (row) row.Isread = 1;
				setMessage('', 'info');
			}
			if (kind === 'items' || kind === 'zeny') {
				if (!pkt.result) {
					const mail = details.get(wait.key);
					if (mail) {
						if (kind === 'items') mail.ItemList = [];
						else mail.zeny = 0;
					}
					setMessage('领取成功', 'success');
				} else setMessage('领取失败，请检查负重、空位和金额上限', 'error');
			}
			if (kind === 'compose') {
				if (pkt.result) {
					writing = true;
					attachments = [];
					recipient = null;
					Object.assign(draft, { receiver: pkt.receiveName || '', title: '', body: '', zeny: 0 });
					setMessage('', 'info');
				} else setMessage('当前无法写信', 'error');
			}
			if (kind === 'validate') {
				if (pkt.CharID > 0 && pkt.name === wait.name) {
					recipient = { ...pkt };
					draft.receiver = pkt.name;
					setMessage(`收件人已确认：${pkt.name}（Lv${pkt.level}）`, 'success');
				} else setMessage('收件人不存在或无法收信', 'error');
			}
			if (kind === 'add') {
				if (!pkt.result) {
					const item = attachments.find(i => i.index === pkt.index);
					if (item) item.count += pkt.count;
					else attachments.push({ ...pkt, identity: wait.identity });
					weight = pkt.weight;
					setMessage('', 'info');
				} else {
					const reasons = {
						1: '附件重量超限',
						2: '无法添加该物品',
						3: '附件种类已达上限',
						4: '该物品无法邮寄'
					};
					setMessage(reasons[pkt.result] || '无法添加该物品', 'error');
				}
			}
			if (kind === 'remove') {
				if (pkt.result) {
					const item = attachments.find(i => i.index === pkt.index);
					if (item) item.count -= pkt.count;
					attachments = attachments.filter(i => i.count > 0);
					weight = pkt.weight;
					setMessage('', 'info');
				} else setMessage('移除附件失败', 'error');
			}
			if (kind === 'send') {
				send('REQ_CANCEL_WRITE_RODEX');
				writing = false;
				attachments = [];
				recipient = null;
				setMessage(
					pkt.result ? '发送失败，请检查服务器提示后重新写信' : '邮件已发送',
					pkt.result ? 'error' : 'success'
				);
			}
			revision++;
		}
	};
	showInteraction({ kind: 'mail', title: '邮件', token, service, close: service.close });
	request('OPEN_ALL_RODEX', {}, { kind: 'list' });
	return service;
}
