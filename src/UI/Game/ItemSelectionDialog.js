/** Keep selection across pages until the user explicitly confirms. */
export function openItemSelectionDialog(
	container,
	{
		existingItems,
		image,
		clearImages,
		confirm,
		searchItems,
		title,
		searchLabel,
		placeholder,
		existingLabel,
		allowEmptyQuery = false,
		emptyMessage = '没有找到物品'
	}
) {
	const existing = new Set(existingItems.map(item => item.id));
	const selected = new Map();
	const dialog = document.createElement('dialog');
	dialog.className = 'pickup-picker';
	dialog.setAttribute('aria-label', title);
	dialog.innerHTML = `
		<h3 class="item-picker-title"></h3>
		<div class="pickup-search"><input type="search" aria-label="搜索排除物品" placeholder="输入物品名称或 ID"><button type="button" data-search>搜索</button></div>
		<div class="pickup-search-status" role="status" hidden></div>
		<div class="pickup-results" aria-label="可选物品" tabindex="-1" autofocus></div>
		<footer><span data-selected>已选 0 件</span><nav class="pickup-pagination" data-menu-pagination aria-label="物品搜索分页"><button type="button" data-previous aria-label="上一页" disabled><span class="pickup-page-label">上一页</span><span class="pickup-page-symbol" aria-hidden="true">‹</span></button><span data-page>1 / 1</span><button type="button" data-next aria-label="下一页" disabled><span class="pickup-page-label">下一页</span><span class="pickup-page-symbol" aria-hidden="true">›</span></button></nav>
		<div class="pickup-picker-actions"><button type="button" data-cancel>取消</button><button type="button" data-confirm disabled>确认添加</button></div></footer>`;
	const $ = selector => dialog.querySelector(selector);
	$('.item-picker-title').textContent = title;
	const input = $('input');
	input.setAttribute('aria-label', searchLabel);
	input.placeholder = placeholder;
	const results = $('.pickup-results');
	const status = $('.pickup-search-status');
	const previous = $('[data-previous]');
	const next = $('[data-next]');
	let requestId = 0,
		page = 1,
		total = 0,
		closed = false;
	function close() {
		if (closed) return;
		closed = true;
		requestId++;
		dialog.close();
		dialog.remove();
		clearImages();
	}
	function updateSelection() {
		$('[data-selected]').textContent = `已选 ${selected.size} 件`;
		$('[data-confirm]').disabled = !selected.size;
	}
	async function search(targetPage = 1) {
		const query = input.value.trim(),
			token = ++requestId;
		if (!query && !allowEmptyQuery) {
			status.hidden = false;
			status.textContent = '请输入物品名称或 ID';
			return;
		}
		previous.disabled = next.disabled = true;
		results.setAttribute('aria-busy', 'true');
		status.hidden = true;
		try {
			const response = await searchItems({ query, page: targetPage, perPage: 20 });
			if (closed || token !== requestId) return;
			clearImages();
			results.replaceChildren();
			results.scrollTop = 0;
			for (const item of response.data) {
				const name = item.name;
				const row = document.createElement('label');
				row.className = 'pickup-item';
				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.dataset.itemId = item.id;
				checkbox.checked = existing.has(item.id) || selected.has(item.id);
				checkbox.disabled = existing.has(item.id);
				checkbox.onchange = () => {
					if (checkbox.checked) selected.set(item.id, { id: item.id, name });
					else selected.delete(item.id);
					updateSelection();
				};
				const caption = document.createElement('span');
				caption.textContent = `${name}${item.count === undefined ? ` · ${item.id}` : ` ×${item.count}`}${existing.has(item.id) ? `（${existingLabel}）` : ''}`;
				row.append(checkbox, image(item.icon), caption);
				results.append(row);
			}
			if (!response.data.length) results.textContent = emptyMessage;
			page = targetPage;
			total = response.total;
			$('[data-page]').textContent = `${page} / ${Math.max(1, Math.ceil(total / 20))}`;
			status.hidden = true;
			status.textContent = '';
		} catch {
			if (!closed && token === requestId) {
				status.hidden = false;
				status.textContent = '搜索失败，请重试';
			}
		} finally {
			if (!closed && token === requestId) {
				results.removeAttribute('aria-busy');
				previous.disabled = page <= 1;
				next.disabled = total <= page * 20;
			}
		}
	}
	input.oninput = () => {
		requestId++;
		clearImages();
		results.replaceChildren();
		results.removeAttribute('aria-busy');
		status.hidden = true;
		status.textContent = '';
		page = 1;
		total = 0;
		$('[data-page]').textContent = '1 / 1';
		previous.disabled = next.disabled = true;
	};
	input.onkeydown = event => {
		if (event.key === 'Enter') {
			event.preventDefault();
			void search();
		}
	};
	$('[data-search]').onclick = () => search();
	previous.onclick = () => search(page - 1);
	next.onclick = () => search(page + 1);
	for (const button of dialog.querySelectorAll('[data-cancel]')) button.onclick = close;
	$('[data-confirm]').onclick = () => {
		const items = [...selected.values()];
		close();
		if (container.isConnected) confirm(items);
	};
	dialog.addEventListener('cancel', event => {
		event.preventDefault();
		close();
	});
	dialog.addEventListener('keydown', event => event.stopPropagation());
	container.append(dialog);
	dialog.showModal();
	if (allowEmptyQuery) void search();
	return close;
}
