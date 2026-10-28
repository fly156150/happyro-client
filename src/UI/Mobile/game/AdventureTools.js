import adventureSpacingCSS from './AdventureSpacing.css?raw';
import menuThemeCSS from './MenuTheme.css?raw';
import menuHintsCSS from './MenuHints.css?raw';
import { replaceNavigationClose } from 'UI/Game/NavigationVisit.js';
import { acquireInputFreeze, releaseInputFreeze } from 'UI/InputFreeze.js';
import menuNarrowTabletCSS from './MenuNarrowTablet.css?raw';
import menuButtonSizingCSS from './MenuButtonSizing.css?raw';
import adventureMenuLayoutCSS from './AdventureMenuLayout.css?raw';
import menuFormControlsCSS from './MenuFormControls.css?raw';
import menuChromeCSS from './MenuChrome.css?raw';
import menuNavigationCSS from './MenuNavigation.css?raw';
import menuContentComponentsCSS from './MenuContentComponents.css?raw';
import menuContentLayoutCSS from './MenuContentLayout.css?raw';
import menuPortraitCSS from './MenuPortrait.css?raw';
import menuLayoutCSS from './MenuLayout.css?raw';
import { createFeedback } from 'UI/Components/Feedback.js';
import { subscribeAdventureActions } from 'UI/Components/GameTools/AdventureActionService.js';
import { subscribeAdventureRoute } from 'UI/Components/GameTools/AdventureRouteService.js';
import { createMobileInputEditor } from './MobileInputEditor.js';
import mobileSelectCSS from './MobileSelect.css?raw';
import { createMobileViewport } from './MobileViewport.js';
import GUIComponent from 'UI/GUIComponent.js';
import UIManager from 'UI/UIManager.js';
import Session from 'Engine/SessionStorage.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';
import { availableGameToolsTabs } from 'UI/Components/GameTools/GameToolsTabs.js';
import { loadAdventureControlBootstrap } from 'UI/Components/GameTools/AdventureControlService.js';
import { notifyGameInput } from 'Controls/GameInputIntent.js';
import { createAdventureToolsView } from './AdventureToolsView.js';
import baseCSS from 'UI/Components/GameTools/GameTools.css?raw';
import itemCSS from 'UI/Components/GameTools/ItemCatalogTab.css?raw';
import selectCSS from 'UI/Components/GameTools/GameSelect.css?raw';
import mobileCSS from './AdventureTools.css?raw';

const Tools = new GUIComponent(
	'MobileAdventureTools',
	baseCSS +
		itemCSS +
		selectCSS +
		mobileCSS +
		mobileSelectCSS +
		menuLayoutCSS +
		menuPortraitCSS +
		menuContentLayoutCSS +
		menuContentComponentsCSS +
		menuNavigationCSS + menuChromeCSS + adventureMenuLayoutCSS + menuFormControlsCSS + menuButtonSizingCSS + menuNarrowTabletCSS + adventureSpacingCSS + menuThemeCSS + menuHintsCSS
);
Tools.render = () => '<div class="adventure-mount mobile-menu-viewport"></div>';
Tools.needFocus = false;
Tools.nativeScrolling = true;
let view,
	disposers = [],
	generation = 0,
	abort;
let mapCloseCallback;

Tools.openFromMenu = function (back) {
	this.backToMenu = back;
	this.append();
};
Tools.openMonster = function (id, onClose) {
 this.initialMapClose = onClose;
 this.initialMonsterId = id;
 this.append();
};
Tools.openMap = function (target, back, onClose) {
	this.initialMapClose = onClose;
	this.backToMenu = back;
	this.initialMap = target;
	this.append();
};
Tools.onAppend = async function () {
	const initialMap = this.initialMap;
	const onMapClose = replaceNavigationClose(mapCloseCallback, this.initialMapClose);
	this.initialMapClose = null;
	const initialMonsterId = this.initialMonsterId;
	this.initialMonsterId = null;
	const backToMenu = this.backToMenu;
	this.backToMenu = null;
	this.initialMap = null;
	this.onRemove();
	mapCloseCallback = onMapClose;
	const request = ++generation;
	notifyGameInput('action');
	acquireInputFreeze(Tools);
	abort = new AbortController();
	const mount = this.getRoot().querySelector('.adventure-mount');
	const context = { capabilities: {}, mobile: true, initialMap, initialMonsterId };
	view = createAdventureToolsView(mount, {
		tabs: [],
		context,
		close: () => {
			const callback = mapCloseCallback;
			this.remove();
			callback?.();
		},
		backToMenu: backToMenu
			? () => {
					this.remove();
					backToMenu();
				}
			: undefined
	});

	const feedback = createFeedback(mount.querySelector('.game-tools-window'));
	let actionMessage = '',
		routeMessage = '';
	disposers.push(
		subscribeAdventureActions(state => {
			if (state.message && state.message !== actionMessage)
				feedback(
					state.message,
					state.error ? 'error' : state.npcPending || state.mapPending ? 'pending' : 'success'
				);
			actionMessage = state.message;
		}),
		subscribeAdventureRoute(state => {
			if (state.message && state.message !== routeMessage) feedback(state.message, 'info');
			routeMessage = state.message;
		})
	);
	disposers.push(onConnectionEnd(() => this.remove()));
	const viewport = createMobileViewport(this._host);
	disposers.push(viewport.destroy, createMobileInputEditor(this._host));
	window.visualViewport?.addEventListener('resize', viewport, { signal: abort.signal });
	window.visualViewport?.addEventListener('scroll', viewport, { signal: abort.signal });
	window.addEventListener('resize', viewport, { signal: abort.signal });
	this.getRoot().addEventListener('focusin', viewport, { signal: abort.signal });
	this.getRoot().addEventListener('focusout', () => queueMicrotask(viewport), { signal: abort.signal });
	viewport();
	let capabilities;
	try {
		capabilities = { ...(await loadAdventureControlBootstrap()), adminAvailable: true };
	} catch {
		capabilities = { adminAvailable: false };
	}
	if (request !== generation || !Session.Playing) return;
	context.capabilities = capabilities;
	view.setTabs(availableGameToolsTabs(capabilities));
};
Tools.onRemove = function () {
	mapCloseCallback = undefined;
	generation++;
	releaseInputFreeze(Tools);
	abort?.abort();
	abort = null;
	for (const dispose of disposers) dispose();
	disposers = [];
	view?.destroy();
	view = null;
};
export default UIManager.addComponent(Tools);
