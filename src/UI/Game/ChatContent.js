/** Build chat markup only from text and explicit client-created link parts. */
export function createChatContent(parts, parseItemLink) {
	const content = document.createElement('div');
	function appendText(text) {
		let offset = 0;
		for (const match of text.matchAll(/<ITEMLINK>.*?<\/ITEMLINK>|<ITEML>.*?<\/ITEML>|<ITEM>.*?<\/ITEM>/gi)) {
			content.append(text.slice(offset, match.index));
			let item;
			try {
				item = parseItemLink(match[0]);
			} catch {
				// A malformed player-supplied item link remains ordinary text.
			}
			if (item) {
				const link = document.createElement('span');
				link.className = 'item-link';
				link.dataset.item = match[0];
				link.style.color = '#FFFF63';
				link.textContent = `<${item.name}>`;
				content.append(link);
			} else content.append(match[0]);
			offset = match.index + match[0].length;
		}
		content.append(text.slice(offset));
	}
	for (const part of Array.isArray(parts) ? parts : [parts]) {
		if (typeof part === 'string') appendText(part);
		else if (part.kind === 'nickname') {
			const link = document.createElement('span');
			link.className = 'nickname-link';
			link.dataset.nickname = part.text;
			link.style.cursor = 'pointer';
			link.style.textDecoration = 'underline';
			link.textContent = part.text;
			content.append(link);
		} else if (part.kind === 'download') {
			const link = document.createElement('a');
			link.style.color = '#F88';
			link.download = part.filename;
			link.href = part.url;
			link.target = '_blank';
			link.rel = 'noopener';
			link.textContent = part.text;
			content.append(link);
		}
	}
	return content;
}
