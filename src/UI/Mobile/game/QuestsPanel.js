import { createFeedback } from 'UI/Components/Feedback.js';
import { setListItemText } from './ListItemText.js';

export function createQuestsPanel(body, actions) {
	body.innerHTML =
		'<div class="skills-toolbar"><select aria-label="任务分类"><option value="all">全部任务</option><option value="1">进行中</option><option value="0">已暂停</option><option value="2">已完成</option></select></div><div class="inventory-layout" data-menu-layout="split"><div class="inventory-list" aria-label="任务列表"></div><section class="inventory-detail" aria-label="任务详情"></section></div><div class="quest-actions"></div>';
	const feedback = createFeedback(body);
	const $ = selector => body.querySelector(selector),
		list = $('.inventory-list'),
		detail = $('.inventory-detail');
	let selected = null,
		state,
		detailKey = '';
	const nodes = new Map();
	function paragraph(value) {
		const p = document.createElement('p');
		p.textContent = value;
		return p;
	}
	function update() {
		state = actions.snapshot();
		const quests = state.quests.filter(q => $('select').value === 'all' || String(q.active) === $('select').value);
		const ids = new Set(quests.map(q => q.questID));
		for (const [id, node] of nodes)
			if (!ids.has(id)) {
				node.remove();
				nodes.delete(id);
			}
		if (selected !== null && !ids.has(selected)) selected = null;
		for (const q of quests) {
			let node = nodes.get(q.questID);
			if (!node) {
				node = document.createElement('button');
				node.className = 'inventory-item';
				node.dataset.quest = q.questID;
				node.onclick = () => {
					selected = q.questID;
					detailKey = '';
					update();
					detail.scrollTop = 0;
					detail.querySelector('.quest-detail-content')?.scrollTo(0, 0);
				};
				nodes.set(q.questID, node);
				list.append(node);
			}
			setListItemText(node, q.title);
			node.setAttribute('aria-pressed', String(selected === q.questID));
		}
		let empty = list.querySelector('[data-empty]');
		if (!quests.length && !empty) {
			empty = paragraph('当前分类没有任务');
			empty.dataset.empty = '';
			list.append(empty);
		}
		if (quests.length) empty?.remove();
		const q = quests.find(entry => entry.questID === selected);
		const key = JSON.stringify([q, state.allowed, state.pending]);
		if (key === detailKey) return;
		detailKey = key;
		const content = document.createElement('div');
		content.className = 'quest-detail-content';
		const operations = $('.quest-actions');
		operations.replaceChildren();
		detail.replaceChildren(content);
		if (!q) {
			content.textContent = '点击任务查看目标、进度和奖励';
			const placeholder = document.createElement('button');
			placeholder.textContent = '启用任务';
			placeholder.disabled = true;
			placeholder.className = 'portrait-menu-placeholder';
			operations.append(placeholder);
			return;
		}
		const title = document.createElement('h3');
		title.textContent = q.title;
		content.append(title, paragraph(q.summary), paragraph(q.description));
		for (const hunt of q.objectives) content.append(paragraph(`${hunt.name}：${hunt.count} / ${hunt.total}`));
		if (q.end_time) content.append(paragraph(`截止时间：${new Date(q.end_time * 1000).toLocaleString()}`));
		for (const reward of q.rewards) content.append(paragraph(`${reward.name} × ${reward.ItemNum}`));
		if (q.reward_exp_base || q.reward_exp_job)
			content.append(paragraph(`经验：${q.reward_exp_base} / 职业经验：${q.reward_exp_job}`));
		{
			const button = document.createElement('button');
			button.textContent = q.active === 1 ? '暂停任务' : '启用任务';
			button.disabled = q.active === 2 || !state.allowed || state.pending !== undefined;
			if (q.active === 2) button.className = 'portrait-menu-placeholder';
			button.onclick = () => {
				const requested = actions.toggle(q.questID, q.active);
				feedback(requested ? '已请求，等待服务器更新' : '任务状态已变化', requested ? 'pending' : 'error');
				update();
			};
			operations.append(button);
		}
		for (const target of q.targets || []) {
			const button = document.createElement('button');
			button.textContent = `查看地图：${target.name}`;
			button.onclick = () => actions.showMap(target);
			operations.append(button);
		}
	}
	$('select').onchange = () => {
		detailKey = '';
		update();
	};
	update();
	return { update };
}
