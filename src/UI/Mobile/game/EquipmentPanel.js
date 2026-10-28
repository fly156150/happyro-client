import { createEquipmentPicker } from './EquipmentPicker.js';
import { ensureReadableText } from 'Utils/ReadableText.js';
import { formatRagnarokMarkup } from 'Utils/RagnarokText.js';
import { handleNaviClick, prepareNaviLinks } from 'UI/Components/Navigation/NaviActionService.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
/** Independent touch equipment view; server snapshots own all item and stat values. */
export function createEquipmentPanel(body, actions) {
	body.addEventListener('click', handleNaviClick);
	body.addEventListener('keydown', handleNaviClick);
	body.innerHTML =
		'<nav class="equipment-tabs menu-tabs menu-bottom-tabs menu-bottom-tabs--stacked" aria-label="装备分类"></nav><div class="equipment-layout" data-menu-layout="split"><div class="equipment-slots-frame"><div class="equipment-slots" aria-label="装备部位"></div></div><section class="equipment-detail inventory-item-detail" aria-label="装备详情"></section></div><div class="equipment-stats" hidden></div><div class="equipment-actions inventory-actions menu-footer menu-footer--trailing"></div>';
	const $ = selector => body.querySelector(selector);
	const slotsRoot = $('.equipment-slots'),
		detail = $('.equipment-detail');
	let group = 'normal',
		selected = 'HEAD_TOP',
		dismiss,
		detailKey = '';
	let state, picker;
	const slots = new Map(),
		statNodes = new Map();
	function button(text, fn) {
		const node = document.createElement('button');
		node.type = 'button';
		node.textContent = text;
		node.onclick = fn;
		return node;
	}
	const statSections = new Map();
	for (const [key, title] of [['base', '基础素质'], ['combat', '战斗属性']]) {
		const section = document.createElement('section');
		section.className = 'equipment-stat-section';
		const heading = document.createElement('h3');
		heading.textContent = title;
		const list = document.createElement('dl');
		section.append(heading, list);
		$('.equipment-stats').append(section);
		statSections.set(key, list);
	}
	const message = createFeedback(body);
	let lastRemoval = actions.snapshot().attachment.removal;
	const removeAttachment = button('', () => {
		const { mask, label } = state.attachment;
		if (!mask) return;
		dismiss?.();
		dismiss = confirmAction(body, `${label}？再次使用需重新租用或召唤。`, () => {
			message(actions.removeAttachment(mask), 'error');
			update();
		});
	});
	function select(slot) {
		selected = slot.key;
		dismiss?.();
		dismiss = null;
		detailKey = '';
		message('');
		render();
		detail.scrollTop = 0;
		detail.querySelector('.inventory-item-description')?.scrollTo(0, 0);
	}
	for (const [key, label] of [
		['normal', '装备'],
		['costume', '时装'],
		['shadow', '影子'],
		['stats', '属性']
	]) {
		if (actions.readOnly && key === 'stats') continue;
		const tab = button(label, () => {
			dismiss?.();
			group = key;
			const first = state.slots.find(slot => slot.group === group);
			if (first) select(first);
			else render();
		});
		tab.dataset.group = key;
		$('.equipment-tabs').append(tab);
	}
	function itemDetails(item, slot, candidate = false) {
		const title = document.createElement('h3');
		title.textContent = item.name;
		const description = document.createElement('p');
		description.className = 'item-description';
		description.innerHTML = formatRagnarokMarkup(item.descriptionMarkup || item.description || '暂无装备说明');

		const overview = document.createElement('div');
		overview.className = 'inventory-item-overview';
		const media = document.createElement('div');
		media.className = 'inventory-item-media';
		const picture = document.createElement('img');
		picture.className = 'inventory-item-picture';
		picture.alt = item.name;
		picture.hidden = !item.icon;
		if (item.icon) picture.src = item.icon;
		const metadata = document.createElement('div');
		metadata.className = 'inventory-item-metadata';
		for (const [text, status] of [
			[slot.key === 'AMMO' && `数量：${item.count}`, false],
			[candidate && item.worn && '已穿戴', true],
			[!item.identified && '未鉴定', true],
			[item.damaged && '已损坏', true]
		]) {
			if (!text) continue;
			const line = document.createElement('p');
			if (status) line.className = 'equipment-item-status';
			line.textContent = text;
			metadata.append(line);
		}
		media.append(picture);
		if (metadata.childElementCount) media.append(metadata);
		const summary = document.createElement('div');
		summary.className = 'inventory-item-summary';
		summary.append(title, description);
		for (const [kind, label] of [
			['card', '已插卡片'],
			['enchant', '附魔']
		]) {
			const sockets = item.sockets?.filter(entry => entry.kind === kind) || [];
			if (!sockets.length) continue;
			const section = document.createElement('section');
			section.className = 'inventory-sockets';
			const heading = document.createElement('h4');
			heading.textContent = label;
			section.append(heading);
			for (const socket of sockets) {
				const details = document.createElement('details');
				const name = document.createElement('summary');
				name.textContent = `${socket.name} · 槽位 ${socket.slot}`;
				const text = document.createElement('p');
				text.className = 'item-description';
				text.innerHTML = formatRagnarokMarkup(socket.descriptionMarkup || socket.description || '');
				details.append(name, text);
				section.append(details);
			}
			summary.append(section);
		}
		prepareNaviLinks(summary);
		overview.append(media, summary);
		queueMicrotask(() => ensureReadableText(overview));
		void actions.preview(item.index, item.ID).then(preview => {
			if (!overview.isConnected || !preview) return;
			const source = preview.art || preview.image || item.icon;
			if (source) {
				picture.src = source;
				picture.hidden = false;
			}
		});
		return [overview];
	}
	function perform(slot, item, action) {
		message(actions.act(slot.key, item.index, item.ID, action), 'error');
		update();
	}
	function chooseEquipment(slot) {
		picker?.close();
		picker = createEquipmentPicker(body, slot, actions, itemDetails,
			item => perform(slot, item, 'equip'), state);
		dismiss = () => picker?.close();
	}

	function renderDetail() {
		const slot = state.slots.find(entry => entry.key === selected);
		if (!slot) return;
		const key = `${group}:${JSON.stringify(slot)}`;
		if (key === detailKey) return;
		detailKey = key;
		const content = document.createElement('div');
		content.className = 'inventory-item-description';
		const ops = $('.equipment-actions');
		ops.replaceChildren();
		if (actions.readOnly) {
			ops.hidden = true;
			if (slot.item) content.append(...itemDetails(slot.item, slot));
			else content.append(document.createTextNode('此部位未穿戴装备'));
			detail.replaceChildren(content);
			return;
		}
		if (slot.item) {
			content.append(...itemDetails(slot.item, slot));
			const remove = button('卸下', () => perform(slot, slot.item, 'unequip'));
			remove.disabled = group === 'stats' || Boolean(slot.item.reason);
			ops.append(remove);
			if (slot.item.reason) {
				const reason = document.createElement('p');
				reason.textContent = slot.item.reason;
				content.append(reason);
			}
		} else {
			content.append(document.createTextNode('此部位未穿戴装备'));
			const remove = button('卸下', () => {});
			remove.disabled = true;
			ops.append(remove);
		}
		const choose = button(slot.item ? '更换' : '选择装备', () => chooseEquipment(slot));
		choose.disabled = group === 'stats' || !slot.candidates.length;
		ops.append(choose);
		detail.replaceChildren(content);
	}
	function render() {
		for (const tab of $('.equipment-tabs').children)
			tab.setAttribute('aria-pressed', String(tab.dataset.group === group));
		$('.equipment-layout').hidden = group === 'stats';
		$('.equipment-stats').hidden = group !== 'stats';
		for (const slot of state.slots) {
			let node = slots.get(slot.key);
			if (!node) {
				node = button('', () => select(state.slots.find(entry => entry.key === slot.key)));
				node.className = 'equipment-slot';
				node.dataset.slot = slot.key;
				node.append(
					document.createElement('img'),
					document.createElement('strong'),
					document.createElement('span')
				);
				slots.set(slot.key, node);
				slotsRoot.append(node);
			}
			node.hidden = slot.group !== group;
			node.setAttribute('aria-pressed', String(selected === slot.key));
			node.querySelector('strong').textContent = slot.label;
			node.querySelector('span').textContent = slot.item?.name || (actions.readOnly ? '未穿戴' : '＋ 选择装备');
			const image = node.querySelector('img');
			image.alt = '';
			image.hidden = !slot.item?.icon;
			if (slot.item?.icon && image.getAttribute('src') !== slot.item.icon) image.src = slot.item.icon;
		}
		for (const stat of state.stats) {
			if (!statNodes.has(stat.key)) {
				const dt = document.createElement('dt');
				dt.textContent = stat.label;
				const dd = document.createElement('dd');
				dd.dataset.stat = stat.key;
				const row = document.createElement('div');
				row.className = 'equipment-stat-row';
				row.append(dt, dd);
				const section = ['str', 'agi', 'vit', 'int', 'dex', 'luk'].includes(stat.key) ? 'base' : 'combat';
				statSections.get(section).append(row);
				statNodes.set(stat.key, dd);
			}
			statNodes.get(stat.key).textContent = stat.value;
		}
		picker?.refresh(state);
		renderDetail();
		if (actions.readOnly) return;
		removeAttachment.textContent = state.attachment.label;
		removeAttachment.hidden = !state.attachment.mask;
		removeAttachment.disabled = Boolean(state.attachment.removal?.pending);
		if (!removeAttachment.isConnected) $('.equipment-actions').append(removeAttachment);
		if (state.attachment.removal !== lastRemoval) {
			lastRemoval = state.attachment.removal;
			if (lastRemoval?.message) message(lastRemoval.message, lastRemoval.success ? 'success' : 'error');
		}
	}
	function update() {
		state = actions.snapshot();
		render();
	}
	update();
	return { update };
}
