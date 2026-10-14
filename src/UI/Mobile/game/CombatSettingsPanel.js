import { createAutoCombatPanel } from 'UI/Game/AutoCombatPanel.js';
import { createPickupSettingsPanel } from 'UI/Game/PickupSettingsPanel.js';
import { loadPickupSettings } from 'UI/Game/PickupSettings.js';

/** Keep both editors mounted while switching tabs so pending edits are retained. */
export function createCombatSettingsPanel(body, actions, header) {
	body.innerHTML = `<div class="settings-tabs menu-tabs" role="tablist" aria-label="战斗辅助设置">
		<button type="button" role="tab" id="mobile-combat-tab" aria-controls="mobile-combat-settings" aria-selected="true" aria-pressed="true" data-assist-tab="combat">战斗设置</button>
		<button type="button" role="tab" id="mobile-pickup-tab" aria-controls="mobile-pickup-settings" aria-selected="false" aria-pressed="false" tabindex="-1" data-assist-tab="pickup">拾取设置</button>
		</div>
		<div class="auto-config-body" id="mobile-combat-settings" role="tabpanel" aria-labelledby="mobile-combat-tab"></div>
		<div class="mobile-pickup-settings" id="mobile-pickup-settings" role="tabpanel" aria-labelledby="mobile-pickup-tab" hidden><section class="settings-section"></section></div>`;
	const tabBar = body.querySelector('[role=tablist]');
	tabBar.classList.add('combat-settings-tabs');
	header.insertBefore(tabBar, header.querySelector('.panel-navigation'));
	header.classList.add('has-combat-tabs');
	const combat = body.querySelector('#mobile-combat-settings');
	const pickup = body.querySelector('#mobile-pickup-settings');
	createAutoCombatPanel(combat, actions);
	const editor = createPickupSettingsPanel(pickup.querySelector('section'), loadPickupSettings());
	const tabs = [...tabBar.querySelectorAll('[data-assist-tab]')];
	function select(name) {
		for (const tab of tabs) {
			const active = tab.dataset.assistTab === name;
			tab.setAttribute('aria-selected', String(active));
			tab.setAttribute('aria-pressed', String(active));
			tab.tabIndex = active ? 0 : -1;
		}
		combat.hidden = name !== 'combat';
		pickup.hidden = name !== 'pickup';
	}
	for (const tab of tabs) {
		tab.onclick = () => select(tab.dataset.assistTab);
		tab.onkeydown = event => {
			if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
			event.preventDefault();
			const target =
				event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[1] : tabs.find(item => item !== tab);
			select(target.dataset.assistTab);
			target.focus({ preventScroll: true });
		};
	}
	return () => {
		tabBar.remove();
		header.classList.remove('has-combat-tabs');
		editor.flush();
		editor.destroy();
	};
}
