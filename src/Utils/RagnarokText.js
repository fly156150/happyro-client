import ItemTable from 'DB/Items/ItemTable.js';
import tipBox from 'DB/Help/TipBox.json';

function* markupTags(text) {
	// A broken reference must not consume the next reference's label or INFO.
	const tags = /<(ITEMLINK|ITEM|NAVI|URL|TIPBOX)>((?:(?!<\/?(?:ITEMLINK|ITEM|NAVI|URL|TIPBOX)>)[\s\S])*?)<INFO>([^<]*?)<\/INFO><\/\1>/gi;
	for (const match of text.matchAll(tags)) {
		yield { index: match.index, length: match[0].length, tag: match[1].toUpperCase(), label: match[2], info: match[3] };
	}
}

/** Broken help links remain readable without exposing internal tags or IDs. */
function plainTipBoxMarkup(text) {
	return text
		.replace(/<INFO>[\s\S]*?<\/INFO>|<INFO>[^<\r\n]*|<\/INFO>/gi, '')
		.replace(/<\/?(?:TIPBOX|ITEMLINK|ITEM|NAVI|URL)>/gi, '');
}

function tipBoxId(info) {
	const value = info.trim();
	const id = Number(value);
	return /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0 ? String(id) : null;
}

function escapeHtml(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/** Keep RO color state across references, without wrapping or modifying HTML tags. */
function createColorFormatter() {
	let color = null;
	let revision = 0;
	const fonts = [];
	return text => String(text ?? '').split(/(<[^>]*>)/g).map(part => {
		if (part.startsWith('<')) {
			if (/^<font(?:\s|>)/i.test(part)) fonts.push(/\scolor=/i.test(part) ? revision : null);
			else if (/^<\/font\s*>/i.test(part)) fonts.pop();
			return part;
		}
		const pieces = [];
		let offset = 0;
		const append = value => {
			if (!value) return;
			const fontRevision = fonts.findLast(value => value !== null);
			// An explicit FONT color overrides an earlier inherited RO color.
			pieces.push(color && (fontRevision === undefined || revision > fontRevision)
				? `<span style="color:#${color}">${value}</span>` : value);
		};
		for (const match of part.matchAll(/\^([0-9a-fA-F]{6})/g)) {
			append(part.slice(offset, match.index));
			color = match[1] === '000000' ? null : match[1];
			revision++;
			offset = match.index + match[0].length;
		}
		append(part.slice(offset));
		return pieces.join('');
	}).join('');
}

export function applyColorCodes(text) { return createColorFormatter()(text); }

function markupSource(value) {
	const text = Array.isArray(value) ? value.filter(Boolean).join('\n') : typeof value === 'string' ? value : '';
	return text.replace(/\^nItemID\^(\d+)/gi, (_, id) => {
		const name = ItemTable[id]?.identifiedDisplayName;
		return name ? `<ITEM>${name}<INFO>${id}</INFO></ITEM>` : '未知物品';
	});
}

export function toPlainRagnarokText(value) {
	const text = markupSource(value);
	const parts = [];
	let lastIndex = 0;
	for (const match of markupTags(text)) {
		parts.push(plainTipBoxMarkup(text.slice(lastIndex, match.index)), match.label);
		lastIndex = match.index + match.length;
	}
	parts.push(plainTipBoxMarkup(text.slice(lastIndex)));
	return parts
		.join('')
		.replace(/<(?:br|hr)\s*\/?>|<\/(?:p|div|li|h[1-6])>/gi, '\n')
		.replace(/<\/?(?:b|i|u|strong|em|s|strike|del|ins|small|big|sub|sup|br|hr|p|div|span|ul|ol|li|blockquote|pre|code|font|h[1-6])(?=\s|\/?>)[^>]*>/gi, '')
		.replace(/\^[0-9a-f]{6}/gi, '')
		.replace(/(?:\\n|\^n)/gi, '\n');
}

export function formatRagnarokMarkup(value, formatText = formatSafeText) {
	const text = markupSource(value).replace(/(?:\\n|\^n)/gi, '\n');
	const parts = [];
	const colorize = createColorFormatter();
	let lastIndex = 0;
	for (const match of markupTags(text)) {
		parts.push(colorize(formatText(plainTipBoxMarkup(text.slice(lastIndex, match.index)))));
		const { tag, label, info } = match;
		const inner = colorize(formatText(label));
		if (tag === 'URL') {
			const url = externalMarkupUrl(info);
			parts.push(url ? `<a class="markup-url" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner);
		} else if (tag === 'TIPBOX') {
			const id = tipBoxId(info);
			const active = id && Object.hasOwn(tipBox.entries, id);
			parts.push(
				id
					? `<span data-tipbox-id="${id}"${active ? ' class="tipbox-link" role="button" tabindex="0"' : ''}>${inner}</span>`
					: inner
			);
		} else if (tag === 'NAVI') {
			parts.push(
				`<span class="navi-link" data-navi-info="${escapeHtml(info)}" data-navi-name="${escapeHtml(toPlainRagnarokText(label))}">${inner}</span>`
			);
		} else {
			const id = tipBoxId(info);
			parts.push(id && ItemTable[id]?.identifiedDisplayName ? `<span class="item-link" data-item-id="${id}" role="button" tabindex="0">${inner}</span>` : inner);
		}
		lastIndex = match.index + match.length;
	}
	parts.push(colorize(formatText(plainTipBoxMarkup(text.slice(lastIndex)))));
	return parts.join('');
}

/** Client URL metadata ends in the old window width/height, not part of the address. */
export function externalMarkupUrl(info) {
	const source = String(info).trim().replace(/,\s*\d+\s*,\s*\d+\s*$/, '');
	if (!/^https?:\/\//i.test(source)) return null;
	try {
		const url = new URL(source);
		return url.username || url.password ? null : url.href;
	} catch { return null; }
}

/** Shared description formatting: text-only tags and constrained font attributes. */
function formatSafeText(text) {
	const tags =
		/&lt;(\/?)(b|i|u|strong|em|s|strike|del|ins|small|big|sub|sup|br|hr|p|div|span|ul|ol|li|blockquote|pre|code|font|h[1-6])(?=\s|\/?&gt;)([\s\S]*?)&gt;/gi;
	return escapeHtml(text).replace(tags, (_, closing, tag, attributes) => {
			tag = tag.toLowerCase();
			if (closing) return ['br', 'hr'].includes(tag) ? '' : `</${tag}>`;
			let safeAttributes = '';
			if (tag === 'font') {
				const color = attributes.match(
					/(?:^|\s)color\s*=\s*(?:&quot;|&#39;)?(#[a-f\d]{3,8}|[a-f\d]{6}|[a-z]+)(?:&quot;|&#39;)?(?=\s|\/?$)/i
				)?.[1];
				const size = attributes.match(
					/(?:^|\s)size\s*=\s*(?:&quot;|&#39;)?([1-7])(?:&quot;|&#39;)?(?=\s|\/?$)/i
				)?.[1];
				if (color) safeAttributes += ` color="${/^[a-f\d]{6}$/i.test(color) ? '#' + color : color}"`;
				if (size) safeAttributes += ` size="${size}"`;
				const style = attributes.match(/(?:^|\s)style\s*=\s*(?:&quot;|&#39;)(.*?)(?:&quot;|&#39;)/i)?.[1];
				const pixels = style?.match(/(?:^|;)\s*font-size\s*:\s*(\d+(?:\.\d+)?)px\s*(?:;|$)/i)?.[1];
				if (pixels) safeAttributes += ` style="font-size:${Math.min(2.5, Math.max(0.85, Number(pixels) / 14))}em"`;
			}
			return `<${tag}${safeAttributes}>`;
		});
}

export function formatNPCMarkup(value) { return formatRagnarokMarkup(value); }
