import { createSelfActions } from 'UI/Game/SelfActions.js';
import headerCSS from '../DesktopWindowHeader.css?raw';
import feedbackCSS from '../DesktopFeedback.css?raw';
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

const AutoCombat = new GUIComponent('AutoCombat', panelCSS + pickupCSS + css + switchCSS + lightThemeCSS + lightCSS + tabsCSS + headerCSS + feedbackCSS);
AutoCombat.render = () => '';
AutoCombat.needFocus = false;
AutoCombat.nativeScrolling = true;
let runtime, view, selfActions;

AutoCombat.onAppend = function () {
	this.onRemove();
	runtime = createGameAutoCombatRuntime({
		update: state => { view?.update(state); selfActions?.update(); },
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
	selfActions = createSelfActions(this._container, () => runtime.stop(), { desktop: true });
	this._container.querySelector('.combat-action-row').before(this._container.querySelector('.self-actions-host'));
	view.update(runtime.snapshot());
};
AutoCombat.openSettings = () => view?.open();
AutoCombat.onRemove = function () {
	selfActions?.destroy();
	selfActions = null;
	runtime?.destroy();
	runtime = null;
	view?.destroy();
	view = null;
};
export default UIManager.addComponent(AutoCombat);
