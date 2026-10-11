import { pickupCategories, savePickupSettings, validPickupSettings } from './PickupSettings.js';
import { loadAdventureAsset, searchAdventureItems } from 'UI/Components/GameTools/AdventureControlService.js';

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
	status.textContent = '修改后自动保存';
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
				: '已保存'
			: valid
				? '保存失败，请重试'
				: '数值无效，保留上次有效配置';
		status.dataset.error = String(!ok || !!invalidInput);
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
			status.textContent = input.validity.valid ? '等待保存…' : '数值无效，保留上次有效配置';
			status.dataset.error = String(!input.validity.valid);
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
	controls.disabled = !draft.enabled;
	enabled.oninput = () => {
		draft.enabled = enabled.checked;
		controls.disabled = !draft.enabled;
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
	const columns = document.createElement('div');
	columns.className = 'pickup-columns';
	const searchColumn = document.createElement('section');
	searchColumn.className = 'pickup-column pickup-search-column';
	searchColumn.setAttribute('aria-label', '搜索物品');
	const excludedColumn = document.createElement('section');
	excludedColumn.className = 'pickup-column pickup-excluded-column';
	excludedColumn.setAttribute('aria-label', '已排除物品');
	const searchTitle = document.createElement('h5');
	searchTitle.textContent = '搜索物品';
	const excludedTitle = document.createElement('h5');
	excludedTitle.textContent = '已排除物品';
	searchColumn.append(searchTitle);
	excludedColumn.append(excludedTitle);
	columns.append(searchColumn, excludedColumn);
	controls.append(columns);
	const excluded = document.createElement('div');
	excluded.className = 'pickup-excluded';
	function button(text, action) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = text;
		b.onclick = action;
		return b;
	}
	function renderExcluded() {
		clearImages(excludedImageUrls);
		excluded.replaceChildren();
		excludedTitle.textContent = `已排除物品（${draft.excluded.length}）`;
		for (const item of draft.excluded) {
			const row = document.createElement('div');
			row.className = 'pickup-item';
			const name = document.createElement('span');
			name.textContent = `${item.name} · ${item.id}`;
			row.append(
				itemImage(`/items/${item.id}/icon`, excludedImageUrls),
				name,
				button('移除', () => {
					draft.excluded = draft.excluded.filter(entry => entry.id !== item.id);
					renderExcluded();
					save();
				})
			);
			excluded.append(row);
		}
		if (!draft.excluded.length) excluded.textContent = '暂无排除物品';
		section.querySelectorAll('[data-exclude-id]').forEach(control => {
			control.disabled = draft.excluded.some(item => item.id === Number(control.dataset.excludeId));
		});
	}
	renderExcluded();
	excludedColumn.append(excluded);
	const searchRow = document.createElement('div');
	searchRow.className = 'pickup-search';
	const input = document.createElement('input');
	input.type = 'search';
	input.placeholder = '输入物品名称或 ID';
	input.setAttribute('aria-label', '搜索排除物品');
	const results = document.createElement('div');
	results.className = 'pickup-results';
	results.setAttribute('aria-live', 'polite');
	results.textContent = '输入名称或 ID 搜索，将物品加入右侧排除列表。';
	const pagination = document.createElement('nav');
	pagination.className = 'pickup-pagination';
	pagination.setAttribute('aria-label', '物品搜索分页');
	const searchStatus = document.createElement('div');
	searchStatus.className = 'pickup-search-status';
	searchStatus.setAttribute('role', 'status');
	let currentPage = 1;
	let total = 0;
	const previousPage = button('上一页', () => search(currentPage - 1));
	const nextPage = button('下一页', () => search(currentPage + 1));
	pagination.append(previousPage, nextPage);
	pagination.hidden = true;
	let requestId = 0;
	async function search(page = 1) {
		const query = input.value.trim(),
			token = ++requestId;
		if (!query) return;
		previousPage.disabled = nextPage.disabled = true;
		results.setAttribute('aria-busy', 'true');
		searchStatus.textContent = '搜索中…';
		try {
			const response = await searchAdventureItems({ query, page, perPage: 20 });
			if (destroyed || token !== requestId || !section.isConnected) return;
			clearImages();
			results.replaceChildren();
			results.scrollTop = 0;
			for (const item of response.data) {
				const name = item.names?.['zh-CN'] || item.AegisName;
				const row = document.createElement('div');
				row.className = 'pickup-item';
				const title = document.createElement('span');
				title.textContent = `${name} · ${item.Id}`;
				const add = button('排除', () => {
					if (!draft.excluded.some(entry => entry.id === item.Id)) draft.excluded.push({ id: item.Id, name });
					renderExcluded();
					save();
					add.disabled = true;
				});
				add.dataset.excludeId = String(item.Id);
				add.disabled = draft.excluded.some(entry => entry.id === item.Id);
				row.append(itemImage(item.icon, imageUrls), title, add);
				results.append(row);
			}
			if (!response.data.length) results.textContent = '没有找到物品';
			currentPage = page;
			total = response.total;
			pagination.hidden = page === 1 && total <= 20;
			searchStatus.textContent = '';
		} catch {
			if (token === requestId) searchStatus.textContent = '搜索失败，请重试';
		} finally {
			if (token === requestId) {
				results.removeAttribute('aria-busy');
				previousPage.disabled = currentPage <= 1;
				nextPage.disabled = total <= currentPage * 20;
			}
		}
	}
	input.oninput = () => {
		requestId++;
		results.replaceChildren();
		pagination.hidden = true;
		searchStatus.textContent = '';
		results.removeAttribute('aria-busy');
		clearImages();
	};
	input.onkeydown = event => {
		if (event.key === 'Enter') {
			event.preventDefault();
			void search();
		}
	};
	searchRow.append(
		input,
		button('搜索', () => search())
	);
	searchColumn.append(searchRow, searchStatus, results, pagination);
	const note = document.createElement('p');
	note.className = 'pickup-note';
	note.textContent =
		'自动走向并拾取符合配置的地面物品，包括自己丢弃的物品。手动拾取不受这些配置影响。设置保存在当前浏览器，按角色区分。';
	const footer = document.createElement('div');
	footer.className = 'pickup-save-footer';
	footer.append(status, retry);
	section.append(controls, note, footer);
	return {
		footer,
		flush: () => {
			if (timer) save();
		},
		destroy: () => {
			destroyed = true;
			clearImages(excludedImageUrls);
			clearImages();
			clearTimeout(timer);
			requestId++;
		}
	};
}
