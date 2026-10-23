import { bindDesktopDialogDrag } from '../DesktopDialogDrag.js';
import { createAutoCombatPanel } from 'UI/Game/AutoCombatPanel.js';
import { createPickupSettingsPanel } from 'UI/Game/PickupSettingsPanel.js';

/** Desktop presentation; gameplay and persistence remain in the shared services. */
export function createAutoCombatView(root, actions, pickup, { showSkillDescription } = {}) {
	root.innerHTML = `
		<div class="combat-toolbar" role="group" aria-label="战斗辅助快捷操作">
		<button type="button" class="combat-launcher" data-combat-toggle role="switch" aria-checked="false" aria-label="开启自动战斗" data-tooltip="开启自动战斗">
			<svg class="combat-swords-icon" aria-hidden="true"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <!-- Lucide swords: https://lucide.dev/icons/swords
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
  -->
  <path d="m13 19 6-6" />
  <path d="M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5" />
  <path d="m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586" />
  <path d="m16 16 4 4" />
  <path d="m19 21 2-2" />
  <path d="m5 14 4 4" />
  <path d="m5 21-2-2" />
  <path d="M7.5 16.5 4 20" />
</svg>
		</button>
		<button type="button" class="combat-launcher" data-pickup-toggle role="switch" aria-checked="false" aria-label="开启自动拾取" data-tooltip="开启自动拾取">
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3 1 4h6l1-4Z M9 7C6 10 4 13 4 17c0 3 3 4 8 4s8-1 8-4c0-4-2-7-5-10Z M12 11v6 M9 14h6"/></svg>
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
