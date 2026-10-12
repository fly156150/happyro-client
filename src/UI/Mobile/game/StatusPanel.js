/** Keep selection and scroll positions while remaining durations update. */
export function createStatusPanel(body) {
	body.innerHTML =
		'<div class="inventory-layout" data-menu-layout="split"><div class="inventory-list" aria-label="状态列表"></div><section class="inventory-detail" aria-label="状态说明"><p class="item-description"></p></section></div>';
	const list = body.querySelector('.inventory-list');
	const description = body.querySelector('.item-description');
	const nodes = new Map();
	let selected,
		statuses = [];
	function showSelection() {
		const status = statuses.find(entry => entry.id === selected);
		const text = status ? status.description || '暂无状态说明' : '当前没有状态效果';
		if (description.textContent !== text) description.textContent = text;
		for (const [id, node] of nodes) node.setAttribute('aria-pressed', String(id === selected));
	}
	return {
		update(next) {
			statuses = next;
			const ids = new Set(statuses.map(status => status.id));
			for (const [id, node] of nodes)
				if (!ids.has(id)) {
					node.remove();
					nodes.delete(id);
				}
			if (!ids.has(selected)) selected = statuses[0]?.id;
			for (const [index, status] of statuses.entries()) {
				let node = nodes.get(status.id);
				if (!node) {
					node = document.createElement('button');
					node.type = 'button';
					node.className = 'inventory-item';
					node.dataset.status = status.id;
					node.innerHTML = '<span class="status-title"></span><small class="status-duration"></small>';
					node.onclick = () => {
						selected = status.id;
						showSelection();
						description.parentElement.scrollTop = 0;
					};
					nodes.set(status.id, node);
				}
				const title = node.querySelector('.status-title'),
					duration = node.querySelector('.status-duration');
				if (title.textContent !== status.title) title.textContent = status.title;
				const time = status.seconds == null ? '' : `${status.seconds}秒`;
				if (duration.textContent !== time) duration.textContent = time;
				duration.hidden = !time;
				if (list.children[index] !== node) list.insertBefore(node, list.children[index] || null);
			}
			showSelection();
		}
	};
}
