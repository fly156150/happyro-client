import { openGameSelectOverlay } from './GameSelectLayout.js';
import escapeHtml from './escapeHtml.js';

function optionMarkup(option, selectedValue) {
	const value = String(option.value);
	return `<button class="game-select-option${value === selectedValue ? ' selected' : ''}" type="button" role="option"${option.disabled ? ' disabled' : ''} aria-selected="${value === selectedValue}" data-value="${escapeHtml(value)}" data-search="${escapeHtml(`${option.label} ${option.search || ''}`.toLocaleLowerCase())}">
		<strong>${escapeHtml(option.label)}</strong>${option.description ? `<small>${escapeHtml(option.description)}</small>` : ''}
	</button>`;
}

export function renderGameSelect({
	name = '',
	className = '',
	ariaLabel,
	value,
	options,
	searchable = false,
	disabled = false
}) {
	const selectedValue = String(value ?? '');
	const selected = options.find(option => String(option.value) === selectedValue) || options[0];
	return `<div class="game-select ${className}" data-game-select>
		<input class="game-select-value ${className}" type="hidden"${name ? ` name="${escapeHtml(name)}"` : ''} value="${escapeHtml(selectedValue)}">
		<button class="game-select-trigger" type="button" aria-label="${escapeHtml(ariaLabel)}" aria-haspopup="listbox" aria-expanded="false"${disabled ? ' disabled' : ''}><span>${escapeHtml(selected?.label || '')}</span><i></i></button>
		<div class="game-select-menu" role="listbox" hidden>
			${searchable ? `<input class="game-select-search" type="search" placeholder="搜索${escapeHtml(ariaLabel)}" aria-label="搜索${escapeHtml(ariaLabel)}">` : ''}
			<div class="game-select-options">${options.map(option => optionMarkup(option, selectedValue)).join('')}</div>
			<div class="game-select-empty" hidden>没有匹配项</div>
		</div>
	</div>`;
}

export function mountGameSelect(root) {
	if (!root) return null;
	const input = root.querySelector('.game-select-value');
	const trigger = root.querySelector('.game-select-trigger');
	const menu = root.querySelector('.game-select-menu');
	const search = root.querySelector('.game-select-search');
	const empty = root.querySelector('.game-select-empty');
	let closeTimer, cleanupOverlay;

	function close() {
		clearTimeout(closeTimer);
		cleanupOverlay?.();
		cleanupOverlay = null;
		menu.hidden = true;
		trigger.setAttribute('aria-expanded', 'false');
		root.classList.remove('open', 'drop-up');
	}

	function open() {
		clearTimeout(closeTimer);
		for (const select of root.getRootNode().querySelectorAll('.game-select.open')) {
			if (select === root) continue;
			select.dispatchEvent(new Event('game-select-close'));
		}
		menu.hidden = false;
		trigger.setAttribute('aria-expanded', 'true');
		root.classList.add('open');
		if (root.closest('.mobile-menu-window')) {
			cleanupOverlay = openGameSelectOverlay(root, close);
		} else {
			const windowBottom =
				root.closest('.game-tools-window')?.getBoundingClientRect().bottom || window.innerHeight;
			root.classList.toggle('drop-up', menu.getBoundingClientRect().bottom > windowBottom);
		}
		if (menu.hidden) return;
		search?.focus();
	}

	function currentOptions() {
		return [...root.querySelectorAll('.game-select-option')];
	}

	function selectOption(option) {
		input.value = option.dataset.value;
		trigger.querySelector('span').textContent = option.querySelector('strong').textContent;
		for (const candidate of currentOptions()) {
			const selected = candidate === option;
			candidate.classList.toggle('selected', selected);
			candidate.setAttribute('aria-selected', String(selected));
		}
		close();
		trigger.focus();
		input.dispatchEvent(new Event('change', { bubbles: true }));
	}

	root.addEventListener('game-select-close', close);
	trigger.addEventListener('click', () => (menu.hidden ? open() : close()));
	root.addEventListener('focusout', () => {
		// Safari blurs a focused button when it is tapped again. A closed menu
		// must not schedule a dismissal of the next click's newly opened menu.
		if (menu.hidden) return;
		clearTimeout(closeTimer);
		closeTimer = setTimeout(() => {
			if (!root.contains(root.getRootNode().activeElement)) close();
		}, 0);
	});
	root.addEventListener('keydown', event => {
		if (event.key === 'Escape' && !menu.hidden) {
			event.preventDefault();
			event.stopPropagation();
			close();
			trigger.focus();
		} else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && event.target !== search) {
			if (trigger.disabled) return;
			event.preventDefault();
			if (menu.hidden) open();
			const options = currentOptions().filter(option => !option.disabled && !option.hidden);
			const index = options.indexOf(root.getRootNode().activeElement);
			const next =
				event.key === 'Home'
					? 0
					: event.key === 'End'
						? options.length - 1
						: event.key === 'ArrowDown'
							? Math.min(index + 1, options.length - 1)
							: index < 0
								? options.length - 1
								: Math.max(0, index - 1);
			options[next]?.focus();
		}
	});
	root.querySelector('.game-select-options').addEventListener('click', event => {
		const option = event.target.closest('.game-select-option');
		if (!option || option.disabled || !root.contains(option)) return;
		selectOption(option);
	});
	search?.addEventListener('input', () => {
		const term = search.value.trim().toLocaleLowerCase();
		let visible = 0;
		for (const option of currentOptions()) {
			option.hidden = term !== '' && !option.dataset.search.includes(term);
			if (!option.hidden) visible += 1;
		}
		empty.hidden = visible !== 0;
	});

	return { input, close };
}

export function setGameSelectOptions(root, { options, value = '', disabled = false, ariaLabel } = {}) {
	if (!root) return;
	const input = root.querySelector('.game-select-value');
	const trigger = root.querySelector('.game-select-trigger');
	const selectedValue = String(value ?? '');
	const selected = options.find(option => String(option.value) === selectedValue) || options[0];
	input.value = selectedValue;
	trigger.disabled = Boolean(disabled);
	trigger.querySelector('span').textContent = selected?.label || '';
	if (ariaLabel) trigger.setAttribute('aria-label', ariaLabel);
	root.querySelector('.game-select-options').innerHTML = options
		.map(option => optionMarkup(option, selectedValue))
		.join('');
	root.dispatchEvent(new Event('game-select-close'));
	root.querySelector('.game-select-menu').hidden = true;
	root.classList.remove('open', 'drop-up');
	trigger.setAttribute('aria-expanded', 'false');
}

export function mountGameSelects(container) {
	return [...container.querySelectorAll('[data-game-select]')].map(mountGameSelect);
}
