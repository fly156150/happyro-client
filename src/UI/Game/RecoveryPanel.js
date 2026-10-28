import { createRecoveryThresholds } from './RecoveryThresholds.js';
import { openItemSelectionDialog } from './ItemSelectionDialog.js';
import { createItemImageLoader } from './ItemImageLoader.js';
import { subscribeRecoveryStatus } from './RecoveryStatus.js';
import { defaultRecoverySettings } from './RecoverySettings.js';

/** Shared form; the containing desktop/mobile window supplies its native tab styling. */
export function createRecoveryPanel(body, actions) {
	const { recoveryItems, recoveryItemName, loadRecoveryItemIcon } = actions;
	const images = { hp: createItemImageLoader(loadRecoveryItemIcon), sp: createItemImageLoader(loadRecoveryItemIcon) };
	const pickerImages = createItemImageLoader(loadRecoveryItemIcon);
	let closePicker;
	const settings = structuredClone(actions.snapshot().recovery || defaultRecoverySettings());
	body.innerHTML = `<div class="recovery-layout" data-menu-layout="form"></div><p class="recovery-status" role="status" hidden></p><p class="recovery-runtime-status" role="status" hidden></p>`;
	// Measure the native gutter so desktop actions align even with platform-specific scrollbars.
	const gutterObserver = new ResizeObserver(entries => {
		for (const { target } of entries) {
			const width = `${target.offsetWidth - target.clientWidth}px`;
			if (target.style.getPropertyValue('--recovery-scrollbar-width') !== width)
				target.style.setProperty('--recovery-scrollbar-width', width);
		}
	});
	const layout = body.querySelector('.recovery-layout'),
		message = body.querySelector('.recovery-status');
	function save() {
		const state = actions.snapshot();
		const ok = actions.configure(state.species, state.skills, state.ranges, state.teleport, settings) !== false;
		message.hidden = ok;
		message.textContent = ok ? '' : '保存失败，请重试';
		return ok;
	}
	function button(label, onClick) {
		const result = document.createElement('button');
		result.type = 'button';
		result.textContent = label;
		result.onclick = onClick;
		return result;
	}
	function selectedList(key, container) {
		images[key].clear();
		const fragment = document.createDocumentFragment();
		container.hidden = !settings[key].items.length;
		const stock = recoveryItems();
		for (const [position, id] of settings[key].items.entries()) {
			const row = document.createElement('div');
			row.className = 'recovery-item';
			const name = document.createElement('span');
			name.textContent = recoveryItemName(id);
			name.title = name.textContent;
			const count = document.createElement('small');
			count.dataset.recoveryStock = String(id);
			count.textContent = `×${stock.filter(item => item.id === id).reduce((sum, item) => sum + item.count, 0)}`;
			function move(offset) {
				const ids = settings[key].items;
				const current = ids.indexOf(id), next = current + offset;
				if (next < 0 || next >= ids.length) return;
				const scrollTop = container.scrollTop;
				const focused = body.getRootNode().activeElement;
				const neighbor = container.children[next];
				[ids[current], ids[next]] = [ids[next], ids[current]];
				container.insertBefore(row, offset < 0 ? neighbor : neighbor.nextSibling);
				updateOrder();
				focused?.focus({ preventScroll: true });
				container.scrollTop = scrollTop;
				save();
			}
			const up = button('↑', () => move(-1));
			up.disabled = position === 0;
			up.dataset.move = 'up';
			up.setAttribute('aria-label', `提高${name.textContent}优先级`);
			const down = button('↓', () => move(1));
			down.disabled = position === settings[key].items.length - 1;
			down.dataset.move = 'down';
			down.setAttribute('aria-label', `降低${name.textContent}优先级`);
			const remove = button('移除', () => {
				settings[key].items.splice(settings[key].items.indexOf(id), 1);
				row.remove();
				updateOrder();
				container.hidden = !settings[key].items.length;
				save();
			});
			const details = document.createElement('div');
			details.className = 'recovery-item-details';
			details.append(name, count);
			const controls = document.createElement('div');
			controls.className = 'recovery-item-actions';
			controls.append(up, down, remove);
			row.append(images[key].image(id), details, controls);
			fragment.append(row);
		}
		container.replaceChildren(fragment);
		function updateOrder() {
			[...container.children].forEach((row, index) => {
				row.querySelector('[data-move="up"]').disabled = index === 0;
				row.querySelector('[data-move="down"]').disabled = index === container.children.length - 1;
			});
		}
	}
	function choose(key, trigger, list) {
		closePicker?.();
		closePicker = openItemSelectionDialog(body, {
			title: `选择 ${key.toUpperCase()} 道具`,
			searchLabel: '搜索道具',
			placeholder: '输入道具名称或 ID',
			allowEmptyQuery: true,
			emptyMessage: '背包中暂无符合条件的道具',
			existingItems: settings[key].items.map(id => ({ id })),
			image: id => pickerImages.image(id),
			clearImages: () => pickerImages.clear(),
			searchItems: async ({ query, page, perPage }) => {
				const stock = recoveryItems();
				const rows = [...new Set(stock.filter(item => item[key]).map(item => item.id))]
					.map(id => ({
						id,
						name: recoveryItemName(id),
						icon: id,
						count: stock.filter(item => item.id === id).reduce((sum, item) => sum + item.count, 0)
					}))
					.filter(item => item.name.includes(query) || String(item.id).includes(query));
				return { data: rows.slice((page - 1) * perPage, page * perPage), total: rows.length };
			},
			confirm: items => {
				settings[key].items = [...new Set([...settings[key].items, ...items.map(item => item.id)])].slice(
					0,
					100
				);
				save();
				selectedList(key, list);
				trigger.focus();
			}
		});
	}

	for (const key of ['hp', 'sp']) {
		const section = document.createElement('section');
		section.className = 'recovery-section';
		const toggle = document.createElement('label');
		toggle.className = 'auto-teleport-toggle';
		const heading = document.createElement('strong');
		heading.textContent = `${key.toUpperCase()} 恢复`;
		const input = document.createElement('input');
		input.type = 'checkbox';
		input.className = 'game-switch';
		input.setAttribute('role', 'switch');
		input.setAttribute('aria-label', heading.textContent);
		input.checked = settings[key].enabled;
		input.onchange = () => {
			settings[key].enabled = input.checked;
			save();
		};
		toggle.append(heading, input);
		section.append(toggle);
		section.append(createRecoveryThresholds(key, settings[key], save));
		const list = document.createElement('div');
		list.className = 'recovery-items';
		const add = button('选择', () => choose(key, add, list));
		add.className = 'recovery-select';
		const headingRow = document.createElement('div');
		headingRow.className = 'recovery-items-heading';
		const label = document.createElement('h4');
		label.textContent = '道具';
		headingRow.append(label, add);
		section.append(headingRow, list);
		selectedList(key, list);
		layout.append(section);
		gutterObserver.observe(list);
	}
	const unsubscribe = subscribeRecoveryStatus(status => {
		const output = body.querySelector('.recovery-runtime-status');
		output.textContent = status;
		output.hidden = !status;
		if (body.hidden) return;
		const stock = recoveryItems();
		for (const node of body.querySelectorAll('[data-recovery-stock]'))
			node.textContent = `×${stock.filter(item => item.id === Number(node.dataset.recoveryStock)).reduce((sum, item) => sum + item.count, 0)}`;
	});
	const retry = button('重试', save);
	message.after(retry);
	retry.hidden = true;
	const observer = new MutationObserver(() => {
		retry.hidden = message.hidden;
	});
	observer.observe(message, { attributes: true, attributeFilter: ['hidden'] });
	return {
		destroy() {
			gutterObserver.disconnect();
			closePicker?.();
			images.hp.clear();
			images.sp.clear();
			pickerImages.clear();
			observer.disconnect();
			unsubscribe();
		},
		refresh() {
			for (const [i, list] of [...layout.querySelectorAll('.recovery-items')].entries())
				selectedList(['hp', 'sp'][i], list);
		}
	};
}
