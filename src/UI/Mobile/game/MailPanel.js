import { createFeedback } from 'UI/Components/Feedback.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { setListItemText } from './ListItemText.js';
import { toPlainRagnarokText } from 'Utils/RagnarokText.js';

/** Mail owns its layout; the service owns server state and transaction validation. */
export function createMailPanel(body, service) {
	let version = -1,
		tab = 0,
		page = 0,
		term = '',
		review = null;
	let dismiss;
	const controls = new Map();
	const node = (parent, tag, className, text) => {
		const element = document.createElement(tag);
		element.className = className;
		if (text !== undefined) element.textContent = text;
		parent.append(element);
		return element;
	};
	body.replaceChildren();
	const feedback = createFeedback(body);
	const toolbar = node(body, 'div', 'mail-toolbar');
	const layout = node(body, 'div', 'mail-layout');
	layout.dataset.menuLayout = 'split';
	const list = node(layout, 'section', 'mail-browser');
	const pane = node(layout, 'section', 'mail-pane');
	const detail = node(pane, 'div', 'mail-detail');
	const detailFooter = node(body, 'div', 'mail-actions mail-footer');
	const para = (parent, text, className = 'mail-note') => node(parent, 'p', className, text);
	const heading = (parent, text) => node(parent, 'h3', 'mail-heading', text);
	const actions = parent => node(parent, 'div', 'mail-actions');
	const button = (parent, label, action, disabled = false) => {
		const element = node(parent, 'button', '', label);
		element.type = 'button';
		controls.set(element, disabled);
		element.onclick = () => {
			action();
			update();
		};
		return element;
	};
	const clearReview = () => {
		review = null;
		dismiss?.();
		dismiss = null;
	};
	const field = (parent, label, value, oninput, type = 'text') => {
		const row = node(parent, 'label', 'mail-field');
		node(row, 'span', '', label);
		const input = node(row, type === 'textarea' ? 'textarea' : 'input', '');
		if (type !== 'textarea') input.type = type;
		input.value = value;
		input.oninput = () => {
			clearReview();
			oninput(type === 'number' ? Number(input.value) : input.value);
		};
		controls.set(input, false);
		return input;
	};
	const mailKey = mail => `${mail.openType}:${mail.MailID}`;
	function renderCompose(state) {
		heading(toolbar, '写邮件');
		button(actions(toolbar), '取消写信', () => {
			service.cancelCompose();
			clearReview();
		});
		heading(list, '添加附件');
		const quantity = field(list, '每次添加数量', 1, () => {}, 'number');
		quantity.min = 1;
		quantity.max = 32767;
		quantity.inputMode = 'numeric';
		const inventory = node(list, 'div', 'mail-rows');
		for (const item of state.inventory) {
			const row = button(inventory, '', () => service.add(item.index, item.ID, Number(quantity.value)));
			row.className = 'mail-row';
			setListItemText(row, item.name, `持有 ${item.count} · 点击添加`);
		}
		if (!state.inventory.length) para(inventory, '背包中没有可添加的物品。', 'mail-empty');
		node(list, 'div', 'mail-browser-footer', `${state.inventory.length} 种可选物品`);
		const form = node(detail, 'div', 'mail-form');
		field(form, '收件人', state.draft.receiver, value => service.change('receiver', value));
		button(actions(form), '校验收件人', () => service.validate());
		field(form, '标题（最多 39 字节）', state.draft.title, value => service.change('title', value));
		field(form, '正文（最多 499 字节）', state.draft.body, value => service.change('body', value), 'textarea');
		const amount = field(form, '附加 Zeny', state.draft.zeny, value => service.change('zeny', value), 'number');
		amount.min = 0;
		amount.max = 2147483647;
		amount.inputMode = 'numeric';
		const attachments = node(detail, 'section', 'mail-attachments');
		heading(attachments, `附件（${state.attachments.length}）`);
		for (const item of state.attachments) {
			const card = node(attachments, 'div', 'mail-attachment');
			para(card, `${item.name} × ${item.count}`, 'mail-attachment-name');
			para(card, item.description);
			button(actions(card), '移除', () => service.remove(item.index, item.count));
		}
		if (!state.attachments.length) para(attachments, '尚未添加附件');
		para(attachments, `附件重量：${state.weight}；限制以服务器为准。`);
		para(detail, '邮费：每种附件 2500 Zeny，加附加金额的 2%；最终以服务器为准。');
		button(detailFooter, '发送邮件', () => {
			review = service.review();
			if (review.error) {
				feedback(review.error, 'error');
				review = null;
				return;
			}
			const requested = review;
			dismiss = confirmAction(
				body,
				`确认发送邮件给「${review.receiver}」？`,
				() => {
					dismiss = null;
					service.send(requested);
					review = null;
					update();
				},
				{}
			);
		});
	}
	function renderInbox(state) {
		const search = node(toolbar, 'input', 'mail-search');
		search.type = 'search';
		search.placeholder = '搜索标题或寄件人';
		search.setAttribute('aria-label', '搜索标题或寄件人');
		search.value = term;
		search.oninput = () => {
			term = search.value;
			page = 0;
		};
		search.onchange = () => {
			render();
			update();
		};
		controls.set(search, false);
		const tools = actions(toolbar);
		const category = node(tools, 'select', 'mail-category');
		category.setAttribute('aria-label', '邮箱分类');
		for (const [value, label] of [
			[0, '个人'],
			[1, '账号'],
			[2, '退回']
		])
			category.add(new Option(label, String(value)));
		category.value = String(tab);
		category.onchange = () => {
			tab = Number(category.value);
			page = 0;
			render();
			update();
		};
		controls.set(category, false);
		button(tools, '刷新', () => {
			clearReview();
			service.refresh();
		});
		button(tools, '写信', () => service.compose()).className = 'mail-primary';
		search.onkeydown = event => {
			if (event.key === 'Enter' && !event.isComposing) {
				event.preventDefault();
				render();
				update();
			}
		};
		const rows = state.list.filter(
			mail => mail.openType === tab && `${mail.title} ${mail.SenderName}`.includes(term)
		);
		const pages = Math.max(1, Math.ceil(rows.length / 8));
		page = Math.min(page, pages - 1);
		const messages = node(list, 'div', 'mail-rows');
		for (const mail of rows.slice(page * 8, page * 8 + 8)) {
			const row = button(messages, '', () => {
				clearReview();
				service.read(mailKey(mail));
			});
			row.className = 'mail-row';
			row.setAttribute('aria-pressed', String(state.selected === mailKey(mail)));
			setListItemText(
				row,
				mail.title || '（无标题）',
				`${mail.Isread ? '' : '未读 · '}${mail.SenderName}${mail.deleting ? ' · 删除中' : ''}`
			);
		}
		if (!rows.length) para(messages, term ? '没有匹配的邮件' : '暂无邮件', 'mail-empty');
		const pagination = node(toolbar, 'div', 'mail-pagination');
		const previous = button(
			pagination,
			'‹',
			() => {
				page--;
				render();
			},
			page === 0
		);
		previous.setAttribute('aria-label', '上一页');
		node(pagination, 'span', '', `${page + 1} / ${pages} · ${rows.length} 封`);
		const next = button(
			pagination,
			'›',
			() => {
				page++;
				render();
			},
			page >= pages - 1
		);
		next.setAttribute('aria-label', '下一页');
		const mail = state.detail;
		if (!mail || mail.openType !== tab) {
			heading(detail, '邮件详情');
			para(detail, '请选择一封邮件查看内容。', 'mail-empty');
			for (const label of ['领取金额', '领取物品', '删除邮件']) button(detailFooter, label, () => {}, true);
			return;
		}
		heading(detail, mail.title || '（无标题）');
		para(detail, `寄件人：${mail.SenderName}`);
		para(detail, toPlainRagnarokText(mail.Textcontent), 'mail-content');
		const attachments = node(detail, 'section', 'mail-attachments');
		heading(attachments, '附加金额与物品');
		para(attachments, `${mail.zeny} Zeny`, 'mail-attachment-name');
		for (const item of mail.describedItems) {
			const card = node(attachments, 'div', 'mail-attachment');
			para(card, `${item.name} × ${item.count}`, 'mail-attachment-name');
			para(card, item.description);
		}
		if (mail.zeny || mail.ItemList.length) para(attachments, '领取前请预留背包容量和负重。');
		const footer = detailFooter;
		button(footer, '领取金额', () => service.claim('zeny'), !mail.zeny);
		button(footer, '领取物品', () => service.claim('items'), !mail.ItemList.length);
		{
			button(
				footer,
				'删除邮件',
				() => {
					const selected = state.selected;
					dismiss = confirmAction(
						body,
						'确定删除这封邮件？',
						() => {
							dismiss = null;
							if (service.snapshot().selected !== selected) {
								feedback('邮件已变化，请重新确认', 'error');
								return;
							}
							service.delete();
							update();
						},
						{}
					);
				},
				Boolean(mail.zeny || mail.ItemList.length)
			);
		}
	}
	function render() {
		const state = service.snapshot();
		version = state.revision;
		layout.dataset.writing = String(state.writing);
		controls.clear();
		clearReview();
		toolbar.replaceChildren();
		list.replaceChildren();
		detail.replaceChildren();
		detailFooter.replaceChildren();
		if (state.writing) renderCompose(state);
		else renderInbox(state);
	}
	function update() {
		const state = service.snapshot();
		if (version !== state.revision) render();
		for (const [control, disabled] of controls) control.disabled = disabled || !state.allowed;
		const message = ['暂无邮件', '请选择邮件'].includes(state.message) ? '' : state.message;
		feedback.update(message, state.messageKind);
	}
	render();
	update();
	return { update };
}
