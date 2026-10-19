import { createCompanionSwitch, updateCompanionSwitch } from './CompanionSwitch.js';
import { createAutoFeedSwitch, updateAutoFeedSwitch, createAutoFeedStatus } from './CompanionAutoFeed.js';
import { createCompanionLayout } from './CompanionLayout.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
export function createCompanionsPanel(body, service) {
	createCompanionLayout(body, {
		nameAttribute: 'data-companion-name',
		nameLabel: '生命体名称',
		sectionTitle: '技能',
		contentAttribute: 'data-skills'
	});
	body.dataset.companionKind = service.snapshot().kind;
	const feedback = createFeedback(body);
	const $ = selector => body.querySelector(selector);
	const infoRows = new Map();
	let dismiss,
		gid,
		nameDirty = false,
		learning = null,
		skillKey = '',
		lastMessage = service.snapshot().message || '';
	const labels = {
		feed: '喂食',
		rename: '改名',
		autofeed: '自动喂食',
		dismiss: '解除',
		return: '返回',
		aggressive: '切换攻击模式'
	};
	function cancel() {
		dismiss?.();
		dismiss = null;
		learning = null;
		service.cancel();
	}
	function review(text) {
		dismiss = confirmAction(
			body,
			text,
			() => {
				dismiss = null;
				const requested = learning;
				learning = null;
				const result = requested
					? requested.gid === service.snapshot().gid
						? service.learn(requested.id, requested.level)
						: '伴侣已变化，请重新确认'
					: service.confirm();
				feedback(
					result,
					result === '攻击模式已更新'
						? 'success'
						: ['已发送请求，以服务器状态为准', '已请求学习一级，等待服务器更新'].includes(result)
							? 'pending'
							: 'error'
				);
				service.cancel();
				update();
			},
			{
				cancelled: () => {
					learning = null;
					service.cancel();
				}
			}
		);
	}
	const actionOrder = service.snapshot().kind === 'mercenary'
		? ['return', 'aggressive', 'dismiss']
		: ['feed', 'return', 'dismiss', 'autofeed', 'aggressive', 'rename'];
	const actionEntries = actionOrder.map(action => [action, labels[action]]);
	for (const [action, label] of actionEntries) {
		const isSwitch = action === 'autofeed' || action === 'aggressive';
		const control = action === 'autofeed' ? createAutoFeedSwitch()
			: action === 'aggressive' ? createCompanionSwitch('被动攻击', '主动攻击') : document.createElement('button');
		const button = isSwitch ? control.querySelector('input') : control;
		if (!isSwitch) {
			button.type = 'button';
			button.textContent = label;
		}
		button.dataset.action = action;
		button.onclick = () => {
			cancel();
			const error = service.prepare(action, action === 'rename' ? $('[data-companion-name]').value : undefined);
			if (error) {
				feedback(error, 'error');
				update();
				return;
			}
			if (isSwitch) {
				const result = service.confirm();
				if (!['已发送请求，以服务器状态为准', '攻击模式已更新'].includes(result)) feedback(result, 'error');
				update();
				return;
			}
			review(
				action === 'dismiss'
					? service.snapshot().kind === 'homunculus'
						? '确认删除当前生命体？'
						: '提前解除佣兵契约？'
					: action === 'return' ? '确认返回身边？' : `确认${label}？`
			);
		};
		if (action === 'rename') $('[data-companion-name]').parentElement.append(control);
		else $('[data-actions]').append(control);
	}
	$('[data-companion-name]').oninput = () => {
		nameDirty = true;
		cancel();
	};
	function update() {
		const s = service.snapshot(),
			info = s.info;
		if (gid !== s.gid) {
			gid = s.gid;
			nameDirty = false;
			cancel();
		}
		if (!s.allowed) cancel();
		if (!nameDirty) $('[data-companion-name]').value = info?.szName || '';
		$('[data-companion-name]').parentElement.hidden = s.kind !== 'homunculus';
		$('[data-companion-name]').disabled = !s.canRename;
		const rows = info
			? [
					['名称', s.kind === 'homunculus' ? info.szName : info.name],
					['等级', s.kind === 'homunculus' ? info.nLevel : info.level],
					['HP', `${info.hp ?? 0} / ${info.maxHP ?? 0}`],
					['SP', `${info.sp ?? 0} / ${info.maxSP ?? 0}`],
					['攻击模式', s.aggressive ? '主动攻击' : '被动攻击'],
					...(s.kind === 'homunculus'
						? [
								['饱食度', info.nFullness],
								['亲密度', info.nRelationship],
								['技能点', info.SKPoint],
								['经验', `${info.exp ?? 0} / ${info.maxEXP ?? 0}`],
								['自动喂食', s.autoFeed ? '开启' : '关闭']
							]
						: [
								['忠诚度', info.faith],
								['击杀数', info.approval_monster_kill_counter],
								['召唤次数', info.toal_call_num],
								[
									'契约到期',
									info.ExpireDate ? new Date(info.ExpireDate * 1000).toLocaleString('zh-CN') : '—'
								]
							])
				]
			: [['状态', '暂无已召出的伴侣']];
		const currentLabels = new Set(rows.map(([label]) => label));
		for (const [label, row] of infoRows) {
			if (!currentLabels.has(label)) {
				row.term.remove();
				row.value.remove();
				infoRows.delete(label);
			}
		}
		for (const [label, value] of rows) {
			let row = infoRows.get(label);
			if (!row) {
				const term = document.createElement('dt'), cell = document.createElement('dd');
				term.textContent = label;
				let content = cell;
				if (label === '攻击模式') {
					content = document.createElement('span');
					content.className = 'companion-attack-mode';
					cell.append(content);
				} else if (label === '自动喂食') {
					content = createAutoFeedStatus(s.autoFeed, true);
					cell.append(content);
				}
				row = { term, value: cell, content };
				infoRows.set(label, row);
				$('[data-info]').append(term, cell);
			}
			const text = String(value ?? '—');
			if (row.content.textContent !== text) row.content.textContent = text;
			if (label === '攻击模式') row.content.dataset.mode = s.aggressive ? 'active' : 'passive';
			if (label === '自动喂食') row.content.dataset.state = s.autoFeed ? 'on' : 'off';
		}
		for (const b of body.querySelectorAll('[data-action]'))
			b.disabled = !s.allowed || (b.dataset.action === 'rename' && !s.canRename);
		if (s.kind === 'homunculus') updateAutoFeedSwitch($('[data-action=autofeed]'), {
			enabled: s.autoFeed, supported: true, allowed: s.allowed, pending: s.pending === 'autofeed'
		});
		updateCompanionSwitch($('[data-action=aggressive]'), {
			checked: s.aggressive, disabled: !s.allowed,
			text: s.aggressive ? '主动攻击' : '被动攻击',
			title: s.aggressive ? '切换为被动攻击' : '切换为主动攻击'
		});
		const key = JSON.stringify([s.kind, s.skills]);
		if (key !== skillKey) {
			skillKey = key;
			$('[data-skills]').replaceChildren();
			if (!s.skills.length) {
				const empty = document.createElement('p');
				empty.textContent = '暂无技能';
				$('[data-skills]').append(empty);
			}
			for (const skill of s.skills) {
				const entry = document.createElement('div');
				entry.className = 'companion-skill';
				const description = document.createElement('span');
				if (s.kind === 'mercenary') {
					description.className = 'companion-skill-name';
					description.textContent = skill.name;
					const metadata = document.createElement('span');
					metadata.className = 'companion-skill-meta';
					metadata.textContent = `Lv.${skill.level} · ${skill.type ? '主动' : '被动'}`;
					entry.append(description, metadata);
				} else {
					description.textContent = `${skill.name} · Lv.${skill.level} · ${skill.type ? '主动' : '被动'}`;
					entry.append(description);
				}
				if (s.kind === 'homunculus') {
					const button = document.createElement('button');
					button.textContent = skill.level ? '升级一级' : '学习一级';
					button.disabled = !skill.learnable;
					button.onclick = () => {
						cancel();
						learning = { id: skill.SKID, level: skill.level + 1, gid: s.gid };
						review(`确认将「${skill.name}」升至 Lv.${skill.level + 1}？`);
					};
					entry.append(button);
				}
				$('[data-skills]').append(entry);
			}
		}
		if (lastMessage !== s.message) {
			lastMessage = s.message;
			feedback.update(s.message, s.messageKind);
		}
	}
	update();
	return { update };
}
