import { createMenuField } from './MenuFormControls.js';
import NpcNameTable from 'DB/NpcNameTable.js';
import { formatNPCMarkup } from 'Utils/RagnarokText.js';

/** Hide only a redundant opening speaker label; keep the original dialogue state intact. */
function dialogueLines(state) {
	const lines = state.lines || [];
	if (state.kind !== 'npc' || !state.title || state.title === '对话') return lines;
	const plainText = value => {
		const template = document.createElement('template');
		template.innerHTML = formatNPCMarkup(value);
		return template.content.textContent.trim();
	};
	const first = lines.findIndex(line => plainText(line));
	if (first < 0) return lines;
	const speaker = plainText(lines[first]).match(/^\[([^\[\]\r\n]+)\]$/)?.[1];
	if (!speaker) return lines;
	const name = value => {
		const clean = value.split('#')[0].split('::')[0].replace(/\s+/g, ' ').trim();
		return NpcNameTable[clean] || clean;
	};
	return name(speaker) === name(plainText(state.title)) ? lines.slice(first + 1) : lines;
}

/** Shared presentation for NPC text, choices, input and buy/sell prompts. */
export function createNPCPanel(body, state) {
	body.replaceChildren();
	const content = document.createElement('div');
	content.className = 'npc-content';
	const text = document.createElement('div');
	text.className = 'npc-lines';
	text.innerHTML = formatNPCMarkup(dialogueLines(state));
	text.hidden = !text.textContent;
	content.append(text);
	if (state.resultItems?.length) {
		const list = document.createElement('ul');
		list.className = 'npc-result-items';
		for (const item of state.resultItems) {
			const row = document.createElement('li');
			const name = document.createElement('span');
			const count = document.createElement('span');
			name.textContent = item.name;
			count.textContent = `× ${item.count}`;
			row.append(name, count);
			list.append(row);
		}
		content.append(list);
	}
	const footer = document.createElement('div');
	footer.className = 'npc-actions menu-footer';
	body.append(content, footer);
	updateNPCCutin(body, state);
	function button(parent, label, respond) {
		const node = document.createElement('button');
		node.type = 'button';
		node.textContent = label;
		node.onclick = respond;
		parent.append(node);
	}
	if (state.kind === 'deal') {
		text.hidden = false;
		text.textContent ||= '请选择购买或出售物品。';
		button(footer, '购买', () => state.respond(0));
		button(footer, '出售', () => state.respond(1));
		return;
	}
	if (state.mode === 'menu') {
		const options = document.createElement('div');
		options.className = 'npc-options';
		options.setAttribute('role', 'group');
		options.setAttribute('aria-label', '对话选项');
		for (const option of state.options) button(options, option.text, () => state.respond(option.value));
		content.append(options);
		footer.hidden = true;
	}
	if (state.mode === 'next') button(footer, '下一步', () => state.respond());
	if (state.mode === 'close') button(footer, '结束对话', () => state.respond());

	if (['number', 'text'].includes(state.mode)) {
		const form = document.createElement('form');
		form.className = 'npc-input-form';
		const input = createMenuField();
		input.type = 'text';
		input.inputMode = state.mode === 'number' ? 'numeric' : 'text';
		input.setAttribute('aria-label', state.mode === 'number' ? '输入数字' : '输入文字');
		input.placeholder = state.mode === 'number' ? '请输入数字' : '请输入文字';
		input.maxLength = state.mode === 'text' ? 255 : 11;
		const submit = document.createElement('button');
		submit.type = 'submit';
		submit.textContent = '确定';
		const error = document.createElement('span');
		error.className = 'npc-error';
		error.id = 'npc-input-error';
		error.setAttribute('role', 'status');
		error.hidden = true;
		input.setAttribute('aria-describedby', error.id);
		form.append(input, submit, error);
		form.onsubmit = event => {
			event.preventDefault();
			const result = state.respond(input.value);
			const invalid = typeof result === 'string';
			error.textContent = invalid ? result : '';
			error.hidden = !invalid;
			input.setAttribute('aria-invalid', String(invalid));
		};
		footer.append(form);
	}
	footer.hidden = !footer.childElementCount;
}

export function updateNPCCutin(body, state) {
	let image = body.querySelector('.npc-cutin');
	if (!state.image) {
		image?.remove();
		return;
	}
	if (!image) {
		image = document.createElement('img');
		image.alt = '';
		image.className = 'npc-cutin';
		body.querySelector('.npc-content').prepend(image);
	}
	if (image.getAttribute('src') !== state.image) image.src = state.image;
}
