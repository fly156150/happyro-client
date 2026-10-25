import { formatRagnarokMarkup, toPlainRagnarokText } from 'Utils/RagnarokText.js';
import { handleNaviClick, prepareNaviLinks } from 'UI/Components/Navigation/NaviActionService.js';

/** Shared read-only inventory presentation; callers own all item actions. */
export function createInventoryDescription(item, previewItem) {
	const title = document.createElement('h3');
	title.textContent = item.name;

	const flags = document.createElement('p');
	flags.textContent = [item.worn && '已穿戴', !item.identified && '未鉴定', item.damaged && '已损坏']
		.filter(Boolean)
		.join(' · ');
	flags.hidden = !flags.textContent;
	let weight = '—';
	const description = document.createElement('p');
	description.className = 'item-description';
	const descriptionMarkup =
		(item.descriptionMarkup || '')
			.replace(/(?:\\n|\^n)/gi, '\n')
			.split(/\r?\n/)
			.filter(line => {
				const plain = toPlainRagnarokText(line);
				if (/^[\t _-]+$/.test(plain)) return false;
				const field = plain.match(/^\s*(重量|Weight|数量|Quantity|Amount)\s*[:：]\s*(\d+(?:\.\d+)?)\s*$/i);
				if (!field) return true;
				if (/^(重量|Weight)$/i.test(field[1])) weight = field[2];
				return false;
			})
			.join('\n')
			.replace(/\n(?:[\t ]*\n)+/g, '\n\n')
			.trim() || '暂无物品说明';
	description.innerHTML = formatRagnarokMarkup(descriptionMarkup);
	const media = document.createElement('div');
	media.className = 'inventory-item-media';
	const metadata = document.createElement('div');
	metadata.className = 'inventory-item-metadata';
	for (const text of [`数量：${item.count}`, `重量：${weight}`]) {
		const line = document.createElement('p');
		line.textContent = text;
		metadata.append(line);
	}
	media.append(metadata);
	const reason = document.createElement('p');
	reason.textContent = item.reason === '此物品没有直接使用操作' ? '' : item.reason || '';
	reason.className = 'inventory-item-reason';
	reason.hidden = !reason.textContent;
	const content = document.createElement('div');
	content.className = 'inventory-item-description';
	content.addEventListener('click', handleNaviClick);
	content.addEventListener('keydown', handleNaviClick);
	const heading = document.createElement('div');
	heading.className = 'inventory-item-overview';
	const summary = document.createElement('div');
	summary.className = 'inventory-item-summary';
	summary.append(title, flags, reason, description);
	for (const [kind, label] of [
		['card', '已插卡片'],
		['enchant', '附魔']
	]) {
		const entries = item.sockets?.filter(entry => entry.kind === kind) || [];
		if (!entries.length) continue;
		const section = document.createElement('section');
		section.className = 'inventory-sockets';
		const socketHeading = document.createElement('h4');
		socketHeading.textContent = label;
		section.append(socketHeading);
		for (const entry of entries) {
			const details = document.createElement('details');
			const name = document.createElement('summary');
			name.textContent = `${entry.name} · 槽位 ${entry.slot}`;
			const text = document.createElement('p');
			text.className = 'item-description';
			text.innerHTML = formatRagnarokMarkup(entry.descriptionMarkup);
			details.append(name, text);
			section.append(details);
		}
		summary.append(section);
	}
	heading.append(media, summary);
	prepareNaviLinks(summary);
	content.append(heading);
	void previewItem(item.index, item.ID).then(preview => {
		if (!content.isConnected || !preview) return;
		const source = preview.art || preview.image || item.icon;
		if (source) {
			const image = document.createElement('img');
			image.className = `inventory-item-picture${preview.art ? ' is-illustration' : ''}`;
			image.alt = item.name;
			image.src = source;
			media.prepend(image);
		}
	});
	return content;
}
