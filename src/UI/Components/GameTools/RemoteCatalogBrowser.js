import { renderCatalogEmptyState } from './CatalogEmptyState.js';
import { resetTabScroll } from './TabViewState.js';
import { mountGameSelects } from './GameSelect.js';

export function mountRemoteCatalogBrowser(container, options) {
	const state = { items: [], selected: null, page: 1, total: 0, loading: false, error: '' };
	let requestToken = 0;
	let searchTimer;
	let failedRequest;
	container.innerHTML = `
		<div class="catalog-toolbar">
			<input class="catalog-search" type="search" placeholder="${options.placeholder}" aria-label="${options.searchLabel}">
			${options.filterHtml || ''}
			${options.toolbarActionHtml || ''}
		</div>
		<div class="catalog-layout" data-menu-layout="split">
			<section class="catalog-browser">
				<div class="catalog-summary"></div><div class="catalog-list"></div>
				<div class="catalog-pagination" data-menu-pagination><button class="catalog-prev" type="button" aria-label="上一页"><span aria-hidden="true">‹</span></button><span class="catalog-page"></span><button class="catalog-next" type="button" aria-label="下一页"><span aria-hidden="true">›</span></button></div>
			</section>
			<section class="catalog-detail"><div class="empty-detail">${options.emptyDetail}</div></section>
		</div>`;

	const search = container.querySelector('.catalog-search');
	search.value = options.initialQuery || '';
	const filters = [...container.querySelectorAll('.catalog-filter.game-select-value')];
	const list = container.querySelector('.catalog-list');
	const detail = container.querySelector('.catalog-detail');
	mountGameSelects(container);
	const api = {
		get state() {
			return state;
		},
		refreshDetail: renderDetail,
		reload: loadPage
	};

	let selectedKey;
	function renderDetail() {
		const nextKey = state.selected ? options.key(state.selected) : null;
		if (nextKey !== selectedKey) {
			selectedKey = nextKey;
			resetTabScroll(container, detail);
			options.onSelectionChange?.(state.selected);
		}
		if (!state.selected) {
			if (options.renderEmptyDetail) options.renderEmptyDetail(detail, api);
			else detail.innerHTML = `<div class="empty-detail">${options.emptyDetail}</div>`;
		} else options.renderDetail(detail, state.selected, api);
	}

	function renderList() {
		const pageCount = Math.max(1, Math.ceil(state.total / options.pageSize));
		container.querySelector('.catalog-summary').textContent = '';
		container.querySelector('.catalog-page').textContent = `${state.page} / ${pageCount}`;
		container.querySelector('.catalog-prev').disabled = state.loading || state.page <= 1;
		container.querySelector('.catalog-next').disabled = state.loading || state.page >= pageCount;
		list.innerHTML = state.items.map(item => options.renderRow(item, state.selected)).join('');
		if (state.loading || state.error) {
			const status = document.createElement('div');
			status.className = 'catalog-empty-state';
			const message = status.appendChild(document.createElement('p'));
			message.className = `menu-hint${state.error ? ' error' : ''}`;
			message.setAttribute('role', 'status');
			message.textContent = state.loading ? '正在加载资料...' : `资料加载失败：${state.error}`;
			if (state.error) {
				const retry = status.appendChild(document.createElement('button'));
				retry.type = 'button';
				retry.className = 'catalog-retry';
				retry.textContent = '重试';
				retry.addEventListener('click', () => {
					if (!state.loading) void loadPage(failedRequest);
				});
			}
			list.prepend(status);
		}
		if (!state.loading && !state.error && !state.items.length) {
			if (options.renderEmptyList) options.renderEmptyList(list, search.value.trim());
			else renderCatalogEmptyState(list, search.value.trim() ? '没有匹配结果' : '暂无资料');
		}
		list.querySelectorAll('[data-catalog-key]').forEach(button => {
			button.disabled = state.loading;
			button.addEventListener('click', () => {
				state.selected =
					state.items.find(item => String(options.key(item)) === button.dataset.catalogKey) || null;
				const scrollTop = list.scrollTop;
				for (const row of list.querySelectorAll('[data-catalog-key]'))
					row.classList.toggle('selected', row === button);
				renderDetail();
				list.scrollTop = scrollTop;
			});
		});
		options.onListRendered?.(list, state.items);
	}

	async function loadPage({ selectFirst = false, page = state.page } = {}) {
		const token = ++requestToken;
		state.loading = true;
		state.error = '';
		renderList();
		try {
			const result = await options.load({
				query: search.value.trim(),
				filter: filters[0]?.value || '',
				filters: Object.fromEntries(
					filters.filter(input => input.name).map(input => [input.name, input.value])
				),
				page,
				perPage: options.pageSize
			});
			if (token !== requestToken) return;
			state.page = page;
			failedRequest = null;
			state.items = result.items;
			state.total = result.total;
			if (state.selected && !selectFirst) {
				state.selected = state.items.find(item => options.key(item) === options.key(state.selected)) || null;
			} else {
				state.selected = state.items[0] || null;
			}
		} catch (error) {
			if (token !== requestToken) return;
			failedRequest = { page, selectFirst };
			state.error = error.message || '请稍后重试';
		} finally {
			if (token === requestToken) {
				state.loading = false;
				renderList();
				renderDetail();
			}
		}
	}

	function resetAndLoad() {
		state.items = [];
		state.total = 0;
		state.selected = null;
		renderDetail();
		state.page = 1;
		resetTabScroll(container, list);
		void loadPage();
	}
	search.addEventListener('input', () => {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(resetAndLoad, 250);
	});
	filters.forEach(input =>
		input.addEventListener('change', () => {
			options.onFiltersChange?.(
				Object.fromEntries(filters.filter(item => item.name).map(item => [item.name, item.value]))
			);
			resetAndLoad();
		})
	);
	const filterValues = () =>
		Object.fromEntries(filters.filter(item => item.name).map(item => [item.name, item.value]));
	options.onFiltersChange?.(filterValues());
	options.onReady?.({
		container,
		select(item) {
			clearTimeout(searchTimer);
			requestToken++;
			search.value = String(options.key(item));
			Object.assign(state, { items: [item], selected: item, page: 1, total: 1, loading: false, error: '' });
			renderList();
			renderDetail();
		},
		reload: resetAndLoad,
		reset() {
			clearTimeout(searchTimer);
			search.value = '';
			state.selected = null;
			renderDetail();
			resetAndLoad();
		},
		refreshDetail: renderDetail
	});
	container.querySelector('.catalog-prev').addEventListener('click', () => {
		resetTabScroll(container, list);
		void loadPage({ selectFirst: true, page: state.page - 1 });
	});
	container.querySelector('.catalog-next').addEventListener('click', () => {
		resetTabScroll(container, list);
		void loadPage({ selectFirst: true, page: state.page + 1 });
	});
	if (!state.selected) void loadPage();

	return () => {
		requestToken += 1;
		clearTimeout(searchTimer);
		options.cleanup?.();
	};
}
