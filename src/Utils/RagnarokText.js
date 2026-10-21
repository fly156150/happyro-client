function markupTag() {
	return /<(ITEMLINK|ITEM|NAVI)>([\s\S]*?)<INFO>([\s\S]*?)<\/INFO><\/\1>/gi;
}

function escapeHtml(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function applyColorCodes(text) {
	let hasOpenSpan = false;
	const html = String(text ?? '').replace(/\^([0-9a-fA-F]{6})/g, (_, color) => {
		const close = hasOpenSpan ? '</span>' : '';
		hasOpenSpan = color !== '000000';
		return hasOpenSpan ? `${close}<span style="color:#${color}">` : close;
	});
	return hasOpenSpan ? `${html}</span>` : html;
}

function markupSource(value) {
	if (Array.isArray(value)) {
		return value.filter(Boolean).join('\n');
	}
	return typeof value === 'string' ? value : '';
}

export function toPlainRagnarokText(value) {
	return markupSource(value)
		.replace(markupTag(), '$2')
		.replace(/\^[0-9a-f]{6}/gi, '')
		.replace(/(?:\\n|\^n)/gi, '\n');
}

export function formatRagnarokMarkup(value, formatText = escapeHtml) {
	const text = markupSource(value).replace(/(?:\\n|\^n)/gi, '\n');
	const parts = [];
	let lastIndex = 0;
	for (const match of text.matchAll(markupTag())) {
		parts.push(applyColorCodes(formatText(text.slice(lastIndex, match.index))));
		const [, tag, label, info] = match;
		const inner = applyColorCodes(formatText(label));
		if (tag.toUpperCase() === 'NAVI') {
			parts.push(
				`<span class="navi-link" data-navi-info="${escapeHtml(info)}" data-navi-name="${escapeHtml(toPlainRagnarokText(label))}">${inner}</span>`
			);
		} else {
			parts.push(`<span class="item-link" data-item-id="${escapeHtml(info)}">${inner}</span>`);
		}
		lastIndex = match.index + match[0].length;
	}
	parts.push(applyColorCodes(formatText(text.slice(lastIndex))));
	return parts.join('');
}

/** Shared NPC formatting: text-only tags and constrained font attributes. */
export function formatNPCMarkup(value) {
	const tags =
		/&lt;(\/?)(b|i|u|strong|em|s|strike|del|ins|small|big|sub|sup|br|hr|p|div|span|ul|ol|li|blockquote|pre|code|font|h[1-6])(?=\s|\/?&gt;)([\s\S]*?)&gt;/gi;
	const formatText = text =>
		escapeHtml(text).replace(tags, (_, closing, tag, attributes) => {
			tag = tag.toLowerCase();
			if (closing) return ['br', 'hr'].includes(tag) ? '' : `</${tag}>`;
			let safeAttributes = '';
			if (tag === 'font') {
				const color = attributes.match(
					/(?:^|\s)color\s*=\s*(?:&quot;|&#39;)?(#[a-f\d]{3,8}|[a-z]+)(?:&quot;|&#39;)?(?=\s|\/?$)/i
				)?.[1];
				const size = attributes.match(
					/(?:^|\s)size\s*=\s*(?:&quot;|&#39;)?([1-7])(?:&quot;|&#39;)?(?=\s|\/?$)/i
				)?.[1];
				if (color) safeAttributes += ` color="${color}"`;
				if (size) safeAttributes += ` size="${size}"`;
			}
			return `<${tag}${safeAttributes}>`;
		});
	return formatRagnarokMarkup(value, formatText);
}
