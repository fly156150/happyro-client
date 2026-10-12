import { pickupCategories, savePickupSettings, validPickupSettings } from './PickupSettings.js';
import { loadAdventureAsset } from 'UI/Components/GameTools/AdventureControlService.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { openPickupItemPicker } from './PickupItemPicker.js';

/** Shared pickup editor with immediate switches and debounced numeric persistence. */
export function createPickupSettingsPanel(section, draft, persist = savePickupSettings) {
	section.classList.add('pickup-section');
	let timer;
	let destroyed = false;
	const imageUrls = new Set();
	const excludedImageUrls = new Set();
	const placeholder =
		'data:image/svg+xml,' +
		encodeURIComponent(
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="4" fill="#253442" stroke="#65717b"/><path d="m6 8 6-3 6 3v8l-6 3-6-3zm0 0 6 3 6-3m-6 3v8" fill="none" stroke="#bac4cd" stroke-linejoin="round"/></svg>'
		);
	function clearImages(urls = imageUrls) {
		urls.forEach(url => URL.revokeObjectURL(url));
		urls.clear();
	}
	function itemImage(path, urls) {
		const image = document.createElement('img');
		image.className = 'pickup-item-icon';
		image.width = image.height = 24;
		image.src = placeholder;
		image.alt = '暂无图片';
		image.onerror = () => {
			image.onerror = null;
			image.src = placeholder;
			image.alt = '暂无图片';
		};
		if (path) {
			loadAdventureAsset(path.replace('/api/adventure-tools', ''))
				.then(url => {
					if (destroyed || !image.isConnected) {
						URL.revokeObjectURL(url);
						return;
					}
					urls.add(url);
					image.alt = '';
					image.src = url;
				})
				.catch(() => {
					/* Keep the placeholder when the asset is unavailable. */
				});
		}
		return image;
	}
	const status = document.createElement('span');
	status.className = 'pickup-save-status';
	status.setAttribute('role', 'status');
	const feedback = document.createElement('div');
	feedback.className = 'pickup-save-error';
	feedback.hidden = true;
	const retry = document.createElement('button');
	retry.type = 'button';
	retry.textContent = '重试';
	retry.hidden = true;
	function save() {
		clearTimeout(timer);
		timer = undefined;
		const valid = validPickupSettings(draft);
		const ok = valid && persist(structuredClone(draft)) !== false;
		const invalidInput = section.querySelector('[aria-invalid="true"]');
		status.textContent = ok
			? invalidInput
				? '数值无效，保留上次有效配置'
				: ''
			: valid
				? '保存失败，请重试'
				: '数值无效，保留上次有效配置';
		status.dataset.error = String(!ok || !!invalidInput);
		feedback.hidden = ok && !invalidInput;
		retry.hidden = ok || !valid;
		return ok;
	}
	retry.onclick = save;
	function numeric(input) {
		const changed = input.oninput;
		input.oninput = () => {
			clearTimeout(timer);
			if (input.validity.valid) changed();
			input.setAttribute('aria-invalid', String(!input.validity.valid));
			status.textContent = input.validity.valid ? '' : '数值无效，保留上次有效配置';
			status.dataset.error = String(!input.validity.valid);
			feedback.hidden = input.validity.valid;
			retry.hidden = true;
			if (input.validity.valid) timer = setTimeout(save, 400);
		};
		input.onblur = save;
		input.onkeydown = event => {
			if (event.key === 'Enter') {
				event.preventDefault();
				save();
			}
		};
	}
	const label = (text, input) => {
		const row = document.createElement('label');
		row.className = 'settings-field';
		if (input.type === 'checkbox') {
			input.classList.add('game-switch');
			input.setAttribute('role', 'switch');
		}
		const caption = document.createElement('span');
		caption.textContent = text;
		row.append(caption, input);
		return row;
	};
	const enabled = document.createElement('input');
	enabled.type = 'checkbox';
	enabled.checked = draft.enabled;
	enabled.dataset.pickup = 'enabled';
	const enabledRow = label('自动拾取', enabled);
	enabledRow.classList.add('pickup-enabled');
	section.append(enabledRow);
	const controls = document.createElement('fieldset');
	controls.className = 'pickup-controls';
	enabled.oninput = () => {
		draft.enabled = enabled.checked;
		save();
	};
	const limits = document.createElement('div');
	limits.className = 'pickup-limits';
	controls.append(limits);
	const range = document.createElement('input');
	range.type = 'number';
	range.min = 1;
	range.max = 15;
	range.step = 1;
	range.value = draft.range;
	range.dataset.pickup = 'range';
	range.oninput = () => {
		draft.range = Number(range.value);
	};
	range.required = true;
	numeric(range);
	limits.append(label('拾取范围（格）', range));
	const batchSeconds = document.createElement('input');
	batchSeconds.type = 'number';
	batchSeconds.min = 1;
	batchSeconds.max = 30;
	batchSeconds.step = 1;
	batchSeconds.value = draft.batchSeconds;
	batchSeconds.dataset.pickup = 'batchSeconds';
	batchSeconds.oninput = () => {
		draft.batchSeconds = Number(batchSeconds.value);
	};
	batchSeconds.required = true;
	numeric(batchSeconds);
	limits.append(label('每轮拾取最长时间（秒）', batchSeconds));
	const batchHelp = document.createElement('p');
	batchHelp.className = 'pickup-note';
	batchHelp.textContent = '自动战斗时，打完当前目标再拾取本轮物品；达到时限后重新找怪，没有怪物则继续拾取。';
	controls.append(batchHelp);
	const categories = document.createElement('div');
	categories.className = 'pickup-categories';
	categories.setAttribute('role', 'group');
	categories.setAttribute('aria-label', '物品分类');
	for (const [id, text] of pickupCategories) {
		const input = document.createElement('input');
		input.type = 'checkbox';
		input.checked = draft.categories.includes(id);
		input.dataset.category = id;
		input.oninput = () => {
			draft.categories = pickupCategories
				.map(([key]) => key)
				.filter(key => categories.querySelector(`[data-category="${key}"]`).checked);
			save();
		};
		categories.append(label(text, input));
	}
	controls.append(categories);
	const heading = document.createElement('h4');
	heading.textContent = '排除物品';
	controls.append(heading);
	const excludedTitle = document.createElement('p');
	const excluded = document.createElement('div');
	excluded.className = 'pickup-excluded';
	excluded.setAttribute('aria-label', '已排除物品');
	const selected = new Set();
	let closePicker, cancelClear;
	function button(text, action) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = text;
		b.onclick = action;
		return b;
	}
	const add = button('添加', () => {
		closePicker?.();
		closePicker = openPickupItemPicker(section, {
			excluded: draft.excluded,
			image: path => itemImage(path, imageUrls),
			clearImages,
			confirm: items => {
				for (const item of items)
					if (!draft.excluded.some(entry => entry.id === item.id)) draft.excluded.push(item);
				renderExcluded();
				save();
			}
		});
	});
	const remove = button('删除', () => {
		draft.excluded = draft.excluded.filter(item => !selected.has(item.id));
		selected.clear();
		renderExcluded();
		save();
	});
	const clear = button('清空', () => {
		cancelClear = confirmAction(section, `确认清空全部 ${draft.excluded.length} 件排除物品？`, () => {
			draft.excluded = [];
			selected.clear();
			renderExcluded();
			save();
		});
	});
	const toolbar = document.createElement('div');
	toolbar.className = 'pickup-toolbar';
	toolbar.append(add, remove, clear);
	controls.append(toolbar, excludedTitle, excluded);
	function updateSelection() {
		remove.disabled = !selected.size;
		clear.disabled = !draft.excluded.length;
		excludedTitle.textContent = `已排除 ${draft.excluded.length} 件 · 已选 ${selected.size} 件`;
	}
	function renderExcluded() {
		clearImages(excludedImageUrls);
		excluded.replaceChildren();
		for (const item of draft.excluded) {
			const row = document.createElement('label');
			row.className = 'pickup-item';
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.dataset.excludedId = item.id;
			checkbox.checked = selected.has(item.id);
			checkbox.onchange = () => {
				if (checkbox.checked) selected.add(item.id);
				else selected.delete(item.id);
				updateSelection();
			};
			const name = document.createElement('span');
			name.textContent = `${item.name} · ${item.id}`;
			row.append(checkbox, itemImage(`/items/${item.id}/icon`, excludedImageUrls), name);
			excluded.append(row);
		}
		if (!draft.excluded.length) excluded.textContent = '暂无排除物品';
		updateSelection();
	}
	renderExcluded();
	const note = document.createElement('p');
	note.className = 'pickup-note';
	note.textContent =
		'自动走向并拾取符合配置的地面物品，包括自己丢弃的物品。手动拾取不受这些配置影响。设置保存在当前浏览器，按角色区分。';
	feedback.append(status, retry);
	section.append(controls, note, feedback);
	return {
		flush: () => {
			if (timer) save();
		},
		destroy: () => {
			destroyed = true;
			clearImages(excludedImageUrls);
			clearImages();
			clearTimeout(timer);
			closePicker?.();
			cancelClear?.();
		}
	};
}
