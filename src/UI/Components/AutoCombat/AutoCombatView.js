import { bindDesktopDialogDrag } from '../DesktopDialogDrag.js';
import { createAutoCombatPanel } from 'UI/Game/AutoCombatPanel.js';
import { createPickupSettingsPanel } from 'UI/Game/PickupSettingsPanel.js';

/** Desktop presentation; gameplay and persistence remain in the shared services. */
export function createAutoCombatView(root, actions, pickup, { showSkillDescription } = {}) {
	root.innerHTML = `
		<div class="combat-toolbar" role="group" aria-label="战斗辅助快捷操作">
		<button type="button" class="combat-launcher" data-combat-toggle role="switch" aria-checked="false" aria-label="开启自动战斗" data-tooltip="开启自动战斗">
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 3 5 2 10 13-3 3L7 8Z M4 16l4 4 M3 21l3-3 M14 8l3-3 4-2-2 5-3 3"/></svg><span class="assist-state" aria-hidden="true"></span>
		</button>
		<button type="button" class="combat-launcher" data-pickup-toggle role="switch" aria-checked="false" aria-label="开启自动拾取" data-tooltip="开启自动拾取">
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3 1 4h6l1-4Z M9 7C6 10 4 13 4 17c0 3 3 4 8 4s8-1 8-4c0-4-2-7-5-10Z M12 11v6 M9 14h6"/></svg><span class="assist-state" aria-hidden="true"></span>
		</button>
		<button type="button" class="combat-launcher" data-settings aria-label="战斗辅助设置" data-tooltip="战斗辅助设置" aria-haspopup="dialog" aria-expanded="false">
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3-.7 2.4-2 .9L4 5.7 2 9l1.8 1.8v2.4L2 15l2 3.3 2.3-.6 2 .9L9 21h6l.7-2.4 2-.9 2.3.6 2-3.3-1.8-1.8v-2.4L22 9l-2-3.3-2.3.6-2-.9L15 3Z"/><circle cx="12" cy="12" r="3.5"/></svg>
		</button>
		</div>
		<div class="assist-feedback" role="status" hidden></div>
		<div class="combat-backdrop" hidden>
			<section class="combat-dialog" role="dialog" aria-modal="true" aria-label="战斗辅助配置">
				<header class="desktop-window-header"><h2 class="desktop-window-title">战斗辅助</h2><button type="button" class="desktop-window-close" data-close aria-label="关闭战斗辅助"></button></header>
				<div class="combat-tabbar">
				<div class="combat-tabs desktop-tab-group" role="tablist" aria-label="战斗辅助配置">
					<button type="button" role="tab" id="combat-tab" aria-controls="combat-panel" aria-selected="true" data-tab="combat">自动战斗</button>
					<button type="button" role="tab" id="pickup-tab" aria-controls="pickup-panel" aria-selected="false" tabindex="-1" data-tab="pickup">自动拾取</button>
				</div>
				</div>
				<div id="combat-panel" role="tabpanel" aria-labelledby="combat-tab" class="desktop-combat-panel">
					<div class="auto-config-body"></div>
				</div>
				<div id="pickup-panel" role="tabpanel" aria-labelledby="pickup-tab" class="desktop-pickup-panel" hidden>
					<div class="desktop-pickup-scroll"></div>
				</div>
			</section>
		</div>`;
	const $ = selector => root.querySelector(selector);
	const abort = new AbortController();
	const backdrop = $('.combat-backdrop');
	root.addEventListener('contextmenu', event => {
		const skill = event.target.closest('[data-auto-skills] [data-skill]');
		if (!skill || backdrop.hidden || !showSkillDescription) return;
		event.preventDefault();
		event.stopPropagation();
		showSkillDescription(Number(skill.dataset.skill));
	}, { signal: abort.signal });

	const restorePosition = bindDesktopDialogDrag($('.combat-dialog'), $('.desktop-window-header'), 'DesktopDialog.Position.AutoCombat', abort.signal);

	let pickupEditor;
	function finishClose() {
		pickupEditor?.flush();
		pickupEditor?.destroy();
		backdrop.hidden = true;
		root.getRootNode().host?.removeAttribute('data-settings-open');

		$('.auto-config-body').replaceChildren();
		$('.desktop-pickup-scroll').replaceChildren();
		$('.desktop-pickup-panel > .pickup-enabled')?.remove();
		$('[data-settings]').setAttribute('aria-expanded', 'false');
		$('[data-settings]').focus();
	}
	function close() {
		if (!backdrop.hidden) finishClose();
	}
	function selectTab(name) {
		for (const button of root.querySelectorAll('[data-tab]')) {
			const selected = button.dataset.tab === name;
			button.setAttribute('aria-selected', String(selected));
			button.tabIndex = selected ? 0 : -1;
		}
		$('#combat-panel').hidden = name !== 'combat';
		$('#pickup-panel').hidden = name !== 'pickup';
	}
	function open() {
		if (!backdrop.hidden) return;
		createAutoCombatPanel($('.auto-config-body'), actions);
		pickupEditor = createPickupSettingsPanel(
			$('.desktop-pickup-scroll'),
			structuredClone(pickup.load()),
			value => pickup.save({ ...value, enabled: pickup.load().enabled })
		);
		$('.desktop-pickup-scroll > .pickup-enabled')?.remove();
		selectTab('combat');
		backdrop.hidden = false;
		restorePosition();
		root.getRootNode().host?.setAttribute('data-settings-open', '');
		$('[data-settings]').setAttribute('aria-expanded', 'true');
		update(actions.snapshot());
		$('[data-close]').focus();
	}
	let feedbackTimer;
	function notice(message) {
		clearTimeout(feedbackTimer);
		$('.assist-feedback').textContent = message;
		$('.assist-feedback').hidden = !message;
		if (message) feedbackTimer = setTimeout(() => { $('.assist-feedback').hidden = true; }, 3000);
	}
	$('[data-combat-toggle]').onclick = () => {
		if (actions.snapshot().active) actions.stop();
		else if (!actions.start()) { actions.stop('当前不能开始自动战斗'); notice('当前不能开始自动战斗'); }
		update(actions.snapshot());
	};
	$('[data-pickup-toggle]').onclick = () => {
		const settings = pickup.load();
		if (pickup.save({ ...settings, enabled: !settings.enabled }) === false) notice('自动拾取设置保存失败，请重试');
		else notice('');
		update(actions.snapshot());
	};
	window.addEventListener('happyro-pickup-settings', () => update(actions.snapshot()), { signal: abort.signal });
	for (const button of root.querySelectorAll('[data-tab]')) {
		button.onclick = () => selectTab(button.dataset.tab);
		button.onkeydown = event => {
			if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
			event.preventDefault();
			const name =
				event.key === 'Home'
					? 'combat'
					: event.key === 'End'
						? 'pickup'
						: button.dataset.tab === 'combat'
							? 'pickup'
							: 'combat';
			selectTab(name);
			$(`[data-tab="${name}"]`).focus();
		};
	}
	$('[data-settings]').onclick = open;
	$('[data-close]').onclick = close;
	root.addEventListener(
		'keydown',
		event => {
			if (backdrop.hidden) return;
			event.stopPropagation();
			if (event.key === 'Escape') {
				event.preventDefault();
				close();
			}
			if (event.key === 'Tab') {
				const focusable = [
					...$('.combat-dialog').querySelectorAll('button, input, select, textarea, [tabindex]')
				].filter(el => !el.matches(':disabled') && el.tabIndex >= 0 && !el.closest('[hidden]'));
				const first = focusable[0],
					last = focusable.at(-1);
				const active = root.getRootNode().activeElement || document.activeElement;
				if (event.shiftKey && active === first) {
					last.focus();
					event.preventDefault();
				} else if (!event.shiftKey && active === last) {
					first.focus();
					event.preventDefault();
				}
			}
		},
		{ signal: abort.signal }
	);
	// Prevent release shortcuts from reaching the game while typing in settings.
	root.addEventListener(
		'keyup',
		event => {
			if (!backdrop.hidden) event.stopPropagation();
		},
		{ signal: abort.signal }
	);
	function update(state) {
		for (const [selector, enabled, label] of [
			['[data-combat-toggle]', state.active, state.active ? '停止自动战斗' : '开启自动战斗'],
			['[data-pickup-toggle]', pickup.load().enabled, pickup.load().enabled ? '关闭自动拾取' : '开启自动拾取']
		]) {
			const button = $(selector);
			button.setAttribute('aria-checked', String(enabled));
			button.setAttribute('aria-label', label);
			button.dataset.tooltip = label;
		}
	}
	update(actions.snapshot());
	return {
		update,
		open,
		close,
		isOpen: () => !backdrop.hidden,
		destroy() {
			root.getRootNode().host?.removeAttribute('data-settings-open');
			pickupEditor?.destroy();
			clearTimeout(feedbackTimer);
			abort.abort();
			root.replaceChildren();
		}
	};
}
