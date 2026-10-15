import { createCompanionLayout } from './CompanionLayout.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
export function createPetPanel(body, service) {
	createCompanionLayout(body, {
		nameAttribute: 'data-name',
		nameLabel: '宠物名称',
		sectionTitle: '进化',
		contentAttribute: 'data-evolution',
		refresh: true
	});
	const feedback = createFeedback(body);
	const $ = selector => body.querySelector(selector);
	let dismiss,
		lastPet = null,
		evoKey = '',
		lastMessage = service.snapshot().message || '',
		nameDirty = false;
	function cancel() {
		dismiss?.();
		dismiss = null;
	}
	function prepare(action, value, label) {
		const pet = service.snapshot().gid;
		dismiss = confirmAction(body, label, () => {
			dismiss = null;
			if (service.snapshot().gid !== pet) {
				feedback('宠物已变化，请重新确认', 'error');
				return;
			}
			const result = service.command(action, value);
			feedback(result, result === '已发送请求，以服务器状态为准' ? 'pending' : 'error');
			update();
		});
	}
	for (const [action, label] of [
		['feed', '喂食'],
		['perform', '表演'],
		['egg', '收回为宠物蛋'],
		['unequip', '卸下饰品'],
		['rename', '改名'],
		['autofeed', '切换自动喂食']
	]) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = label;
		b.dataset.action = action;
		b.onclick = () => {
			prepare(
				action,
				action === 'rename' ? $('[data-name]').value : undefined,
				`${label}${action === 'rename' ? '为「' + $('[data-name]').value + '」' : ''}？`
			);
		};
		if (action === 'rename') $('[data-name]').parentElement.append(b);
		else $('[data-actions]').append(b);
	}
	$('[data-refresh]').onclick = () => {
		cancel();
		service.refresh();
		update();
	};
	$('[data-name]').oninput = () => {
		nameDirty = true;
		cancel();
	};
	function update() {
		const state = service.snapshot(),
			info = state.info;
		const rows = info
			? [
					['名称', info.szName],
					['等级', info.nLevel],
					['饱食度', `${info.nFullness} / 100`],
					['亲密度', info.nRelationship],
					['饰品', state.accessory ? '已装备' : '未装备'],
					['自动喂食', state.autoFeed ? '已开启' : '未开启']
				]
			: [['状态', '暂无已召唤的宠物']];
		$('[data-info]').replaceChildren();
		for (const [label, value] of rows) {
			const dt = document.createElement('dt'),
				dd = document.createElement('dd');
			dt.textContent = label;
			dd.textContent = value;
			$('[data-info]').append(dt, dd);
		}
		if (lastPet !== state.gid) {
			lastPet = state.gid;
			nameDirty = false;
			cancel();
		}
		if (!nameDirty) $('[data-name]').value = info?.szName || '';
		const nextKey = JSON.stringify(state.evolutions);
		if (nextKey !== evoKey) {
			evoKey = nextKey;
			$('[data-evolution]').replaceChildren();
			if (!state.evolutions.length) {
				const empty = document.createElement('p');
				empty.textContent = '暂无可用进化';
				$('[data-evolution]').append(empty);
			}
			for (const evo of state.evolutions) {
				const title = document.createElement('h3');
				title.textContent = `进化为 ${evo.name}`;
				$('[data-evolution]').append(title);
				for (const mat of evo.materials) {
					const p = document.createElement('p');
					p.textContent = `${mat.name}：${mat.owned} / ${mat.count}`;
					$('[data-evolution]').append(p);
				}
				const b = document.createElement('button');
				b.type = 'button';
				b.textContent = '进化为 ' + evo.name;
				b.onclick = () => prepare('evolve', evo.egg, '确认将宠物进化为 ' + evo.name + '？');
				$('[data-evolution]').append(b);
			}
		}
		for (const button of body.querySelectorAll('button:not(.ui-confirm button)')) button.disabled = !state.allowed;
		$('[data-refresh]').disabled = !state.canRefresh;
		$('[data-name]').disabled = !state.allowed || Boolean(info?.bModified);
		$('[data-action=rename]').disabled = !state.allowed || Boolean(info?.bModified);
		$('[data-action=unequip]').disabled = !state.allowed || !state.accessory;
		if (lastMessage !== state.message) {
			lastMessage = state.message;
			feedback.update(state.message, state.messageKind);
		}
	}
	update();
	return { update };
}
