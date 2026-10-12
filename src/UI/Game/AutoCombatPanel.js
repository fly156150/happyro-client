import { AUTO_COMBAT_RANGE_LIMITS, AUTO_COMBAT_TELEPORT_DEFAULTS } from 'UI/Game/AutoCombatController.js';

/** Auto combat configuration is independent of the manual shortcut slots. */
export function createAutoCombatPanel(body, actions) {
	let ready = false;
	const state = actions.snapshot();
	const ranges = { ...state.ranges };
	const teleport = { ...AUTO_COMBAT_TELEPORT_DEFAULTS, ...state.teleport };
	body.innerHTML = `
		<div class="auto-layout" data-menu-layout="form">
			<section class="auto-target-section" aria-labelledby="auto-target-title">
				<h3 id="auto-target-title">攻击目标</h3>
				<button type="button" data-all-species>全部魔物</button>
				<p class="auto-help">可多选种类；未勾选时攻击全部魔物。</p>
				<div class="auto-species-list" data-auto-species aria-label="自动战斗目标"></div>
				<section class="auto-range-settings" aria-labelledby="auto-range-title">
					<h4 id="auto-range-title">范围设置 <span data-range-summary></span></h4>
					<div data-range-controls></div>
					<p class="auto-help">搜怪：角色周围的搜索距离。活动：距本轮起点的最大距离；手动移动或瞬移后重设起点。</p>
				</section>
				<section class="auto-teleport-settings" aria-labelledby="auto-teleport-title">
					<h4 id="auto-teleport-title">自动瞬移</h4>
					<label class="auto-teleport-toggle"><span>无目标时随机瞬移</span><input type="checkbox" class="game-switch" role="switch" data-auto-teleport></label>
					<div data-teleport-controls></div>
					<p class="auto-help">使用冒险工具能力。没有战斗目标和可拾取物品时，等待后随机瞬移。</p>
					<p class="auto-help">仍受地图限制和服务器冷却约束。</p>
				</section>
			</section>
			<section class="auto-skill-section" aria-labelledby="auto-skills-title">
				<div class="auto-section-heading"><h3 id="auto-skills-title">攻击方式</h3><span data-skill-count></span></div>
				<button type="button" data-normal-attack>普通攻击</button>
				<p class="auto-help">勾选技能后随机释放，使用已学最高等级；均不可用时使用普攻。</p>
				<div class="auto-skill-list" data-auto-skills></div>
			</section>
		</div>
		<div class="auto-save-error" hidden><span data-auto-save-status role="status"></span></div>`;
	const $ = selector => body.querySelector(selector);
	const limits = AUTO_COMBAT_RANGE_LIMITS;
	for (const [key, title, maximum] of [
		['search', '搜怪范围', limits.searchMax],
		['activity', '活动范围', limits.activityMax]
	]) {
		const row = document.createElement('div');
		row.className = 'auto-range-row';
		const label = document.createElement('span');
		label.textContent = title;
		const stepper = document.createElement('div');
		stepper.className = 'auto-range-stepper';
		stepper.setAttribute('role', 'group');
		stepper.setAttribute('aria-label', title);
		const output = document.createElement('output');
		output.dataset.rangeValue = key;
		output.setAttribute('aria-live', 'polite');
		for (const delta of [-1, 1]) {
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = delta < 0 ? '−' : '+';
			button.dataset.range = key;
			button.dataset.delta = String(delta);
			button.setAttribute('aria-label', `${delta < 0 ? '减小' : '增大'}${title}`);
			button.onclick = () => {
				ranges[key] = Math.max(limits.min, Math.min(maximum, ranges[key] + delta));
				if (key === 'search') ranges.activity = Math.max(ranges.activity, ranges.search);
				else ranges.search = Math.min(ranges.search, ranges.activity);
				updateSummary();
			};
			stepper.append(button);
			if (delta < 0) stepper.append(output);
		}
		row.append(label, stepper);
		$('[data-range-controls]').append(row);
	}
	const teleportToggle = $('[data-auto-teleport]');
	teleportToggle.checked = teleport.enabled;
	const refreshTeleport = () => {
		if (ready) save();
		for (const button of body.querySelectorAll('[data-teleport-key]')) {
			const key = button.dataset.teleportKey;
			const min = 1;
			const max = key === 'waitSeconds' ? 60 : 300;
			button.disabled =
				!teleport.enabled || (Number(button.dataset.delta) < 0 ? teleport[key] <= min : teleport[key] >= max);
		}
		for (const output of body.querySelectorAll('[data-teleport-value]'))
			output.value = `${teleport[output.dataset.teleportValue]} 秒`;
	};
	teleportToggle.onchange = () => {
		teleport.enabled = teleportToggle.checked;
		refreshTeleport();
	};
	for (const [key, title, min, max] of [
		['waitSeconds', '无目标等待', 1, 60],
		['intervalSeconds', '最短瞬移间隔', 1, 300]
	]) {
		const row = document.createElement('div');
		row.className = 'auto-range-row';
		const label = document.createElement('span');
		label.textContent = title;
		const stepper = document.createElement('div');
		stepper.className = 'auto-range-stepper';
		stepper.setAttribute('role', 'group');
		stepper.setAttribute('aria-label', title);
		const output = document.createElement('output');
		output.dataset.teleportValue = key;
		for (const delta of [-1, 1]) {
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = delta < 0 ? '−' : '+';
			button.dataset.teleportKey = key;
			button.dataset.delta = String(delta);
			button.setAttribute('aria-label', `${delta < 0 ? '减小' : '增大'}${title}`);
			button.onclick = () => {
				teleport[key] = Math.max(min, Math.min(max, teleport[key] + delta));
				refreshTeleport();
			};
			stepper.append(button);
			if (delta < 0) stepper.append(output);
		}
		row.append(label, stepper);
		$('[data-teleport-controls]').append(row);
	}
	refreshTeleport();
	const species = new Map(state.species.map(entry => [entry.id, entry.name]));
	for (const target of actions.targets()) species.set(target.species, target.name);
	const chosenSpecies = new Set(state.species.map(entry => entry.id));
	for (const [id, name] of species) {
		// One native button owns activation; there is no nested label/control activation.
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'auto-species-card';
		button.dataset.species = String(id);
		button.setAttribute('role', 'checkbox');
		button.setAttribute('aria-checked', String(chosenSpecies.has(id)));
		const check = document.createElement('span');
		check.className = 'auto-species-check';
		check.setAttribute('aria-hidden', 'true');
		const title = document.createElement('span');
		title.textContent = name;
		button.append(check, title);
		const toggle = () => {
			if (chosenSpecies.has(id)) chosenSpecies.delete(id);
			else chosenSpecies.add(id);
			updateSummary();
		};
		let press = null;
		const scroller = $('.auto-target-section');
		button.onpointerdown = event => {
			if (event.button !== 0 || press) return;
			// Avoid focus scrolling the list between press and release.
			event.preventDefault();
			press = {
				id: event.pointerId,
				x: event.clientX,
				y: event.clientY,
				scroll: scroller.scrollTop,
				moved: false
			};
			button.setPointerCapture(event.pointerId);
		};
		button.onpointermove = event => {
			if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8)
				press.moved = true;
		};
		button.onpointerup = event => {
			if (press?.id !== event.pointerId) return;
			const start = press;
			press = null;
			const bounds = button.getBoundingClientRect();
			if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
			if (
				!start.moved &&
				Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 8 &&
				scroller.scrollTop === start.scroll &&
				event.clientX >= bounds.left &&
				event.clientX <= bounds.right &&
				event.clientY >= bounds.top &&
				event.clientY <= bounds.bottom
			)
				toggle();
		};
		button.onpointercancel = button.onlostpointercapture = () => {
			press = null;
		};
		// Pointer activation is handled once above. Keep keyboard/assistive activation native.
		button.onclick = event => {
			if (event.detail === 0) toggle();
		};
		$('[data-auto-species]').append(button);
	}
	if (!species.size) $('[data-auto-species]').textContent = '附近暂无魔物，发现后可在这里选择。';
	const selectedSpecies = () => [...chosenSpecies].map(id => ({ id, name: species.get(id) }));
	const entries = actions.skills();
	const chosenSkills = new Set(state.skills);
	for (const skill of entries) {
		const label = document.createElement('button');
		label.type = 'button';
		label.className = 'auto-skill-card';
		label.dataset.skill = skill.id;
		label.setAttribute('role', 'checkbox');
		label.setAttribute('aria-checked', String(chosenSkills.has(skill.id)));
		const input = document.createElement('i');
		input.className = 'auto-species-check';
		input.setAttribute('aria-hidden', 'true');
		const detail = document.createElement('span');
		const name = document.createElement('strong');
		name.textContent = skill.name;
		const level = document.createElement('small');
		level.textContent = `Lv.${skill.level}`;
		detail.append(name, level);
		if (skill.reason) {
			const reason = document.createElement('small');
			reason.className = 'auto-skill-reason';
			reason.textContent = skill.reason;
			detail.append(reason);
		}
		const icon = document.createElement('img');
		icon.className = 'auto-skill-icon';
		icon.alt = '';
		icon.width = icon.height = 24;
		label.append(input, icon, detail);
		skill.loadIcon?.(url => {
			if (url) icon.src = url;
		});
		const scroller = $('[data-auto-skills]');
		let press,
			cancelled = false;
		label.onpointerdown = event => {
			if (event.button !== 0) return;
			cancelled = false;
			press = { x: event.clientX, y: event.clientY, scroll: scroller.scrollTop };
		};
		label.onpointermove = event => {
			if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) cancelled = true;
		};
		label.onpointercancel = () => {
			cancelled = true;
		};
		label.onclick = event => {
			if (
				event.detail !== 0 &&
				(cancelled ||
					(press &&
						(scroller.scrollTop !== press.scroll ||
							Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8)))
			)
				return;
			if (chosenSkills.has(skill.id)) chosenSkills.delete(skill.id);
			else chosenSkills.add(skill.id);
			updateSummary();
		};
		$('[data-auto-skills]').append(label);
	}
	if (!entries.length) $('[data-auto-skills]').textContent = '暂无可自动释放的技能，使用普通攻击。';
	const selectedSkills = () => entries.filter(skill => chosenSkills.has(skill.id)).map(skill => skill.id);
	function updateSummary() {
		if (ready) save();
		$('[data-range-summary]').textContent = `${ranges.search} / ${ranges.activity} 格`;
		for (const output of body.querySelectorAll('[data-range-value]'))
			output.value = `${ranges[output.dataset.rangeValue]} 格`;
		for (const button of body.querySelectorAll('[data-range]')) {
			const key = button.dataset.range;
			button.disabled =
				Number(button.dataset.delta) < 0
					? ranges[key] <= limits.min
					: ranges[key] >= (key === 'search' ? limits.searchMax : limits.activityMax);
		}
		for (const button of body.querySelectorAll('[data-auto-skills] [data-skill]'))
			button.setAttribute('aria-checked', String(chosenSkills.has(Number(button.dataset.skill))));
		const count = selectedSkills().length;
		const targets = selectedSpecies();
		for (const button of body.querySelectorAll('[data-species]'))
			button.setAttribute('aria-checked', String(chosenSpecies.has(Number(button.dataset.species))));
		$('[data-all-species]').setAttribute('aria-pressed', String(!targets.length));
		$('[data-normal-attack]').setAttribute('aria-pressed', String(count === 0));
		$('[data-skill-count]').textContent = count ? `已选 ${count} 项` : '未选技能';
	}
	$('[data-all-species]').onclick = () => {
		chosenSpecies.clear();
		updateSummary();
	};
	$('[data-normal-attack]').onclick = () => {
		chosenSkills.clear();
		updateSummary();
	};
	function save() {
		const ok = actions.configure(selectedSpecies(), selectedSkills(), { ...ranges }, { ...teleport }) !== false;
		$('[data-auto-save-status]').textContent = ok ? '' : '保存失败，请重试';
		$('[data-auto-save-status]').dataset.error = String(!ok);
		$('.auto-save-error').hidden = ok;
	}
	const retry = document.createElement('button');
	retry.type = 'button';
	retry.dataset.autoRetry = '';
	retry.textContent = '重试';
	retry.onclick = save;
	$('.auto-save-error').append(retry);
	updateSummary();
	ready = true;
}
