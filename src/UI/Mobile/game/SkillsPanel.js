import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
import { setListItemText } from './ListItemText.js';

import { createPointResetControl } from './PointResetControl.js';

export function createSkillsPanel(body, actions) {
	body.innerHTML =
		'<div class="skills-toolbar"><select aria-label="转职分类"><option value="all">全部转职</option></select><select aria-label="技能分类"><option value="all">全部技能</option><option value="active">已学主动</option><option value="passive">已学被动</option><option value="locked">未学习</option></select></div><div class="inventory-layout skills-layout" data-menu-layout="split"><section class="skills-browser"><div class="inventory-list" aria-label="技能列表"></div><div class="skills-footer"><div class="skills-reset"></div><strong data-skill-points></strong></div></section><section class="inventory-detail inventory-item-detail" aria-label="技能详情"></section></div>';
	const $ = selector => body.querySelector(selector),
		list = $('.inventory-list'),
		detail = $('.inventory-detail');
	let selected = null,
		key = '',
		state,
		dismiss;
	const nodes = new Map();
	let resetMessage = '';
	const reset = createPointResetControl($('.skills-reset'), {
		label: '重置技能点',
		description: '确认重置技能点？',
		canReset: () => actions.snapshot().canReset,
		reset: () => actions.reset(),
		changed: () => update()
	});
	function button(text, fn) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = text;
		b.onclick = fn;
		return b;
	}
	const status = createFeedback(body);
	function renderDetail() {
		const skill = state.skills.find(entry => entry.id === selected);
		if (!skill) {
			detail.textContent = '点击技能查看说明、学习或设置快捷键';
			return;
		}
		const next = JSON.stringify({ ...skill, icon: undefined });
		if (next === key) return;
		key = next;
		detail.replaceChildren();
		const title = document.createElement('h3');
		title.textContent = skill.name;
		const summary = document.createElement('p');
		summary.textContent = `${skill.kind} · 等级 ${skill.level}/${skill.max}`;
		const learn = button(skill.level ? '升级一级' : '学习一级', () => {
			dismiss = confirmAction(body, `确认将「${skill.name}」升至 ${skill.level + 1} 级？`, () => {
				const result = actions.learn(skill.id, skill.level + 1);
				status(result, result === '已请求学习一级，等待服务器更新' ? 'pending' : 'error');
				key = '';
				update();
			});
		});
		learn.disabled = !skill.learnable;
		const content = document.createElement('div');
		content.className = 'inventory-item-description';
		content.append(title, summary);
		const ops = document.createElement('div');
		ops.className = 'inventory-actions';
		ops.append(learn);
		if (skill.active) {
			const bind = button('设置快捷键', () => {
				const level = document.createElement('select');
				level.setAttribute('aria-label', '等级');
				for (let i = 1; i <= skill.level; i++) level.add(new Option(`Lv.${i}`, String(i)));
				level.value = String(skill.level);
				const slot = document.createElement('select');
				slot.setAttribute('aria-label', '位置');
				const page = actions.shortcuts();
				for (let i = 0; i < page.total; i++)
					slot.add(new Option(`位置 ${i + 1} · ${actions.slotName(i)}`, String(i)));
				slot.value = String(page.slots[0].index);
				const fields = document.createElement('div');
				fields.className = 'shortcut-fields';
				for (const input of [level, slot]) {
					const field = document.createElement('div');
					field.className = 'ui-confirm-field';
					field.append(input);
					fields.append(field);
				}
				dismiss = confirmAction(
					body,
					`设置「${skill.name}」的快捷键？`,
					() => {
						const success = actions.bind(skill.id, Number(level.value), Number(slot.value));
						status(success ? '快捷键已设置' : '设置失败，请重新选择', success ? 'success' : 'error');
					},
					{ content: fields }
				);
			});
			bind.disabled = skill.level < 1;
			ops.append(bind);
		}
		const requirements = document.createElement('p');
		requirements.textContent = `前置技能：${skill.requirements.join('；') || '无'}${skill.reason ? '\n' + skill.reason : ''}`;
		const description = document.createElement('p');
		description.className = 'item-description';
		description.textContent = skill.description;
		content.append(requirements, description);
		detail.append(content, ops);
	}
	function render() {
		$('[data-skill-points]').textContent = `剩余技能点：${state.points}`;
		const tierSelect = $('[aria-label="转职分类"]');
		const availableTiers = ['初心者', '一转', '二转', '三转', '四转', '其它'].filter(tier =>
			state.skills.some(skill => (skill.tier || '其它') === tier)
		);
		const tierKey = availableTiers.join(',');
		if (tierSelect.dataset.tiers !== tierKey) {
			const value = tierSelect.value;
			tierSelect.replaceChildren(
				new Option('全部转职', 'all'),
				...availableTiers.map(tier => new Option(tier, tier))
			);
			tierSelect.value = availableTiers.includes(value) ? value : 'all';
			tierSelect.dataset.tiers = tierKey;
		}
		const category = $('[aria-label="技能分类"]').value;
		const tier = tierSelect.value;
		const filtered = state.skills.filter(
			skill =>
				(tier === 'all' || (skill.tier || '其它') === tier) &&
				(category === 'all' ||
					(category === 'active'
						? skill.active
						: category === 'passive'
							? skill.kind === '被动'
							: !skill.level))
		);
		const ids = new Set(filtered.map(skill => skill.id));
		if (selected !== null && !ids.has(selected)) {
			dismiss?.();
			dismiss = null;
			selected = null;
			key = '';
		}
		for (const [id, node] of nodes)
			if (!ids.has(id)) {
				node.remove();
				nodes.delete(id);
			}
		for (const skill of filtered) {
			let node = nodes.get(skill.id);
			if (!node) {
				node = button('', () => {
					dismiss?.();
					dismiss = null;
					selected = skill.id;
					key = '';
					status('');
					render();
					detail.scrollTop = 0;
				});
				node.className = 'inventory-item';
				node.dataset.skill = skill.id;
				node.append(document.createElement('img'), document.createElement('span'));
				nodes.set(skill.id, node);
				list.append(node);
			}
			node.setAttribute('aria-pressed', String(selected === skill.id));
			setListItemText(node, skill.name, `${skill.kind} Lv.${skill.level}`);
			const img = node.querySelector('img');
			img.alt = '';
			if (skill.icon && img.getAttribute('src') !== skill.icon) img.src = skill.icon;
		}
		renderDetail();
	}
	$('[aria-label="技能分类"]').onchange = render;
	$('[aria-label="转职分类"]').onchange = render;
	function update() {
		if (!body.contains(list)) return;
		state = actions.snapshot();
		if (state.message !== resetMessage) {
			resetMessage = state.message;
			status(resetMessage || '', resetMessage?.endsWith('已重置') ? 'success' : 'error');
		}
		reset.update();
		render();
	}
	update();
	return { update };
}
