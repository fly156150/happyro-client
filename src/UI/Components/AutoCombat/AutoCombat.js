import headerCSS from '../DesktopWindowHeader.css?raw';
import GUIComponent from 'UI/GUIComponent.js';
import UIManager from 'UI/UIManager.js';
import { createGameAutoCombatRuntime } from 'UI/Game/GameAutoCombatRuntime.js';
import { createAutoCombatView } from './AutoCombatView.js';
import css from './AutoCombat.css?raw';
import lightCSS from './AutoCombatLight.css?raw';
import tabsCSS from '../DesktopTabs.css?raw';
import lightThemeCSS from '../DesktopLightTheme.css?raw';
import { loadPickupSettings, savePickupSettings } from 'UI/Game/PickupSettings.js';
import pickupCSS from 'UI/Game/PickupSettingsPanel.css?raw';
import panelCSS from 'UI/Game/AutoCombatPanel.css?raw';
import switchCSS from 'UI/Components/GameSwitch.css?raw';

const AutoCombat = new GUIComponent('AutoCombat', panelCSS + pickupCSS + css + switchCSS + lightThemeCSS + lightCSS + tabsCSS + headerCSS);
AutoCombat.render = () => '';
AutoCombat.needFocus = false;
AutoCombat.nativeScrolling = true;
let runtime, view;

AutoCombat.onAppend = function () {
	this.onRemove();
	runtime = createGameAutoCombatRuntime({
		update: state => view?.update(state),
		onDisconnect: () => this.remove()
	});
	view = createAutoCombatView(this._container, runtime, { load: loadPickupSettings, save: savePickupSettings }, {
		showSkillDescription: async id => {
			const { default: description } = await import('../SkillDescription/SkillDescription.js');
			if (!view?.isOpen()) return;
			if (description.uid === id) {
				description.remove();
				return;
			}
			description.append();
			description.setSkill(id, { above: this._host });
		}
	});
	view.update(runtime.snapshot());
};
AutoCombat.openSettings = () => view?.open();
AutoCombat.onRemove = function () {
	runtime?.destroy();
	runtime = null;
	view?.destroy();
	view = null;
};
export default UIManager.addComponent(AutoCombat);
