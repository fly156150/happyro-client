import SkillWindow from 'UI/Components/SkillList/SkillList.js';
import { acquireInputFreeze, releaseInputFreeze, isInputFrozenExcept } from 'UI/InputFreeze.js';
import { isIdentificationExam, createExamTargets } from 'UI/Game/IdentificationExam.js';
import { createSelfActions } from 'UI/Game/SelfActions.js';
import { gameDeathSnapshot } from 'UI/Game/GameDeath.js';
import { createScreenWakeLock } from './ScreenWakeLock.js';
import { hasVisiblePixels, createAltitudeFallback } from 'UI/Components/MiniMap/MiniMapImage.js';
import { createMobileInputEditor } from './MobileInputEditor.js';
import { loadCatalogMapImage } from 'UI/Components/GameTools/WorldAssetService.js';
import { createMobileViewport } from './MobileViewport.js';
import AdventureTools from './AdventureTools.js';
import CombatDiagnostics from 'Core/CombatDiagnostics.js';
import { createGameAutoCombatRuntime } from 'UI/Game/GameAutoCombatRuntime.js';
import { isAutoCombatTeleportPending } from 'UI/Game/AutoCombatTeleport.js';
import { openGameCompanions } from 'UI/Game/GameCompanions.js';
import { openGamePet } from 'UI/Game/GamePet.js';
import { openGameMail, gameMailUnread } from 'UI/Game/GameMail.js';
import { graphicsFields, settingsSnapshot, saveGameSettings, saveGameAudio } from 'UI/Game/GameSettings.js';
import { requestGameBank } from 'UI/Game/GameBank.js';
import { showOwnedVending } from 'UI/Game/GameVending.js';
import { createGameSocial } from 'UI/Game/GameSocial.js';
import { createGameChat, chatChannelError, chatChannel, isIncomingPrivateMessage } from 'UI/Game/GameChat.js';
import { createGameQuests } from 'UI/Game/GameQuests.js';
import { createGameContainers } from 'UI/Game/GameContainers.js';
import EntityManager from 'Renderer/EntityManager.js';
import { subscribeInteraction, clearInteraction } from 'UI/Game/ServerInteraction.js';
import { createGameAttributes } from 'UI/Game/GameAttributes.js';
import { createGameSkills } from 'UI/Game/GameSkills.js';
import { createEquipmentController } from 'UI/Game/GameEquipment.js';
import { characterStats } from 'UI/Game/CharacterStats.js';
import { clearAttackIntent } from 'Controls/AttackIntent.js';
import { createGameInventory } from 'UI/Game/GameInventory.js';
import { createGameShortcuts } from 'UI/Game/GameShortcuts.js';
import Renderer from 'Renderer/Renderer.js';
import * as Commands from 'UI/Game/GameCommands.js';
import { bindPointerControls } from './PointerControls.js';
import GUIComponent from 'UI/GUIComponent.js';
import UIManager from 'UI/UIManager.js';
import Session from 'Engine/SessionStorage.js';
import Platform from 'UI/Platform.js';
import Mobile from 'Core/Mobile.js';
import Mouse from 'Controls/MouseEventHandler.js';
import MapControl from 'Controls/MapControl.js';
import Altitude from 'Renderer/Map/Altitude.js';
import MapRenderer from 'Renderer/MapRenderer.js';
import DB from 'DB/DBManager.js';
import { getJobDisplayName } from 'DB/Jobs/JobDisplayNameTable.js';
import StatusIcons from 'UI/Components/StatusIcons/StatusIcons.js';
import { subscribeChatFeed } from 'UI/Game/ChatFeed.js';
import { createGameHUDView } from './GameHUDView.js';

const HUD = new GUIComponent('MobileGameHUD', '');
HUD.render = () => '';
HUD.mouseMode = GUIComponent.MouseMode.CROSS;
HUD.needFocus = false;
HUD.nativeScrolling = true;
let view;
let selfActions;
let controls;
let shortcuts;
let autoCombat;
let examTargets;
let inventory;
let equipment;
let containers;
let skills;
let attributes;
let quests;
let chat;
let social;
let unsubscribe;
let unsubscribeOrientation;
let unsubscribeInteraction;
let abort;
let modal = false;
HUD.actions = {};

function cancelSceneInput() {
	examTargets?.clear();
	if (isIdentificationExam(MapRenderer.currentMap)) Commands.stopAttack();
	autoCombat?.stop();
	shortcuts?.cancel();
	controls?.cancel();
	Session.moveAction = null;
	Mobile.cancelInteraction();
	MapControl.onRequestStopWalk();
}
function setModal(value) {
	if (value === modal) return;
	modal = value;
	if (value) {
		cancelSceneInput();
		acquireInputFreeze(HUD);
		Mouse.intersect = false;
	} else {
		releaseInputFreeze(HUD);
	}
}
function snapshot() {
	const entity = Session.Entity;
	if (!entity) return;
	const combatState = autoCombat.snapshot();
	// Same-map teleport rebuilds the HUD before the runtime resumes on its next tick.
	if (!combatState.active && isAutoCombatTeleportPending()) {
		combatState.active = true;
		combatState.status = '正在随机瞬移';
	}
	const diagnosticStart = CombatDiagnostics.begin();
	view.updateShortcuts(shortcuts.snapshot());
	view.update({
		exam: isIdentificationExam(MapRenderer.currentMap) ? examTargets?.snapshot() : null,
		death: gameDeathSnapshot(),
		autoCombat: combatState,
		unreadMail: gameMailUnread(),
		name: entity.display.name,
		job: getJobDisplayName(entity._job),
		level: entity.clevel,
		jobLevel: entity.joblevel,
		money: entity.money,
		hp: entity.life.hp,
		maxHp: entity.life.hp_max,
		sp: entity.life.sp,
		maxSp: entity.life.sp_max,
		ap: entity.life.ap,
		maxAp: entity.life.ap_max,
		position: [entity.position[0], entity.position[1]],
		direction: entity.direction,
		mapName: DB.getMapName(MapRenderer.currentMap, MapRenderer.currentMap),
		statuses: StatusIcons.getSnapshot(),
		target: Commands.targetSnapshot()
	});
	selfActions?.update();
	CombatDiagnostics.end('mobile.hud', diagnosticStart);
}
let updateViewport;
let disposeInputEditor;
let releaseScreenWakeLock;
HUD.onAppend = function () {
	// Repeated map mounting must not duplicate subscriptions or timers.
	HUD.onRemove(false);
	releaseScreenWakeLock = createScreenWakeLock();
	updateViewport = createMobileViewport(HUD._host);
	disposeInputEditor = createMobileInputEditor(HUD._host);
	abort = new AbortController();
	const enabled = () =>
		Boolean(
			!Session.FreezeUI &&
			Session.Playing &&
			!document.hidden &&
			Session.Entity &&
			Session.Entity.action !== Session.Entity.ACTION.DIE
		);
	examTargets = createExamTargets({
		enabled: () => enabled() && isIdentificationExam(MapRenderer.currentMap),
		get: id => EntityManager.get(id),
		focus: () => EntityManager.getFocusEntity(),
		stop: Commands.stopAttack,
		select: entity => {
			const previous = EntityManager.getFocusEntity();
			if (previous && previous !== entity) previous.onFocusEnd();
			EntityManager.setFocusEntity(entity);
			EntityManager.setOverEntity(entity);
			entity.onFocus({ attack: false });
		},
		attack: () => Commands.attackSelected(controls?.isMoving() || false)
	});
	autoCombat = createGameAutoCombatRuntime({
		enabled,
		isMoving: () => controls?.isMoving() || false,
		update: () => {
			if (view) snapshot();
		},
		onDisconnect: () => HUD.remove()
	});
	shortcuts = createGameShortcuts(() => controls?.isMoving() || false);
	inventory = createGameInventory(() => modal && !isInputFrozenExcept(HUD));
	containers = createGameContainers(() => modal && !isInputFrozenExcept(HUD));
	social = createGameSocial(() => modal && !isInputFrozenExcept(HUD), shortcuts);
	chat = createGameChat(
		(...args) => HUD.actions.sendChat(...args),
		() => modal && !isInputFrozenExcept(HUD),
		command => HUD.actions.sendEmotion(command)
	);
	quests = createGameQuests(() => modal && !isInputFrozenExcept(HUD));
	attributes = createGameAttributes(() => modal && !isInputFrozenExcept(HUD));
	skills = createGameSkills(() => modal && !isInputFrozenExcept(HUD), shortcuts);
	equipment = createEquipmentController(inventory, () => characterStats(Session.Entity),
		() => modal && !isInputFrozenExcept(HUD), () => SkillWindow.getUI().getSkillRevision());
	view = createGameHUDView(HUD.getRoot(), {
		cancelSceneInput,
		deathSnapshot: gameDeathSnapshot,
		returnToSavePoint: () => {
			if (!gameDeathSnapshot().dead) return false;
			HUD.actions.returnToSavePoint();
			return true;
		},
		revive: () => {
			const state = gameDeathSnapshot();
			if (!state.dead || !state.tokenCount) return false;
			HUD.actions.revive();
			return true;
		},
		openAdventureTools: back => AdventureTools.openFromMenu(back),
		openAdventureMap: (target, back) => AdventureTools.openMap(target, back),
		setModal,
		prepareHomunculusAction: (action, id) => {
			autoCombat.stop();
			return Commands.prepareHomunculusAction(action, id, () =>
				openGameCompanions('homunculus', () => modal ? !isInputFrozenExcept(HUD) : enabled()));
		},
		prepareMercenaryAction: (action, id) => {
			autoCombat.stop();
			return Commands.prepareMercenaryAction(action, id, () =>
				openGameCompanions('mercenary', () => modal ? !isInputFrozenExcept(HUD) : enabled()));
		},
		preparePetAction: (action, id) => {
			autoCombat.stop();
			return Commands.preparePetAction(action, id, () => openGamePet(() => modal ? !isInputFrozenExcept(HUD) : enabled()));
		},
		playerAction: (action, id) => {
			autoCombat.stop();
			return Commands.playerAction(action, id, name => view.openPrivate(name));
		},
		interact: () => {
			autoCombat.stop();
			Commands.interactSelected();
		},
		showSelfActions: () => {
			if (autoCombat.snapshot().active) autoCombat.stop();
			cancelSceneInput();
			EntityManager.setFocusEntity(Session.Entity);
			snapshot();
		},
		clearPlayerSelection: () => {
			cancelSceneInput();
			EntityManager.setFocusEntity(null);
			snapshot();
		},
		chooseExamTarget: id => {
			examTargets.choose(id);
			snapshot();
		},
		attackExamTarget: () => {
			if (!examTargets.attack()) view.notice('请先选择魔物');
			snapshot();
		},
		toggleAutoCombat: () => {
			if (autoCombat.snapshot().active || isAutoCombatTeleportPending()) autoCombat.stop();
			else {
				shortcuts.cancel();
				controls.cancel();
				if (!autoCombat.start()) view.notice('当前不能开始自动战斗');
			}
			snapshot();
		},
		autoCombat: {
			recoveryItems: () => autoCombat.recoveryItems(),
			loadRecoveryItemIcon: id => autoCombat.loadRecoveryItemIcon(id),
			recoveryItemName: id => autoCombat.recoveryItemName(id),
			snapshot: () => autoCombat.snapshot(),
			mapSpecies: () => autoCombat.mapSpecies(),
			skills: () => autoCombat.skills(),
			configure: (...args) => autoCombat.configure(...args)
		},
		shortcutPage: delta => {
			shortcuts.turn(delta);
			snapshot();
		},
		camera: Commands.adjustCamera,
		settings: {
			fields: graphicsFields,
			snapshot: settingsSnapshot,
			save: saveGameSettings,
			audio: saveGameAudio
		},
		openCompanion: kind => openGameCompanions(kind, () => modal && !isInputFrozenExcept(HUD)),
		openPet: () => openGamePet(() => modal && !isInputFrozenExcept(HUD)),
		openMail: () => openGameMail(() => modal && !isInputFrozenExcept(HUD)),
		openBank: () => requestGameBank(() => modal && !isInputFrozenExcept(HUD)),
		showOwnedVending,
		canOperate: () => modal && !isInputFrozenExcept(HUD),
		social,
		questSnapshot: () => quests.snapshot(),
		questToggle: (...args) => quests.toggle(...args),
		containerSnapshot: source => containers.snapshot(source),
		containerPreview: (...args) => containers.preview(...args),
		transferItem: (...args) => containers.transfer(...args),
		removeCart: () => containers.removeCart(),
		attributes,
		skillsReset: () => skills.reset(),
		skillsSnapshot: () => skills.snapshot(),
		skillsLearn: (...args) => skills.learn(...args),
		skillsBind: (...args) => skills.bind(...args),
		equipmentSnapshot: () => equipment.snapshot(),
		equipmentCheckCandidates: (...args) => equipment.checkCandidates(...args),
		equipmentRemoveAttachment: mask => equipment.removeAttachment(mask),
		equipmentAct: (...args) => equipment.act(...args),
		inventorySnapshot: () => inventory.snapshot(),
		inventoryPreview: (...args) => inventory.preview(...args),
		inventoryDrop: (...args) => inventory.drop(...args),
		inventoryAct: (...args) => inventory.act(...args),
		bindInventory: (index, id, slot) =>
			inventory.canBind(index, id) && shortcuts.configure(slot, { isSkill: false, ID: id }),
		shortcutName: index => shortcuts.slotName(index),
		shortcutSnapshot: () => shortcuts.snapshot(),
		shortcutCandidates: () => shortcuts.candidates(),
		configureShortcut: (...args) => shortcuts.configure(...args),
		cancelSkill: () => {
			shortcuts.cancel();
			snapshot();
		},
		selfSkill: () => {
			shortcuts.self();
			snapshot();
		},
		sendChat: (...args) => chat.send(...args),
		chatChannelError,
		chatEmotionImages: () => import('UI/Game/ChatEmotionImages.js').then(module => module.loadChatEmotionImages()),
		returnToCharacters: () => HUD.actions.returnToCharacters()
	});
	selfActions = createSelfActions(HUD.getRoot().querySelector('.target-actions'), cancelSceneInput);
	unsubscribeInteraction = subscribeInteraction(state => view.showInteraction(state));
	controls = bindPointerControls(HUD.getRoot(), Renderer.canvas, {
		enabled,
		startMove: () => {
			examTargets.clear();
			if (isIdentificationExam(MapRenderer.currentMap)) Commands.stopAttack();
			autoCombat.pauseForMovement();
		},
		move: (x, y) => {
			autoCombat.pauseForMovement();
			Commands.moveDirection(x, y);
		},
		stopMove: Commands.stopDirectionalMovement,
		shortcut: slot => {
			autoCombat.stop('手动施法，自动战斗已停止');
			Commands.stopAttack();
			const index = shortcuts.snapshot().slots[slot].index;
			const result = shortcuts.use(index);
			snapshot();
			if (result.configure !== undefined) view.openShortcuts(result.configure);
			if (result.message) view.notice(result.message);
		},
		pickTapTarget: (x, y) => {
			const hit = Commands.pickSceneEntity(x, y);
			return hit &&
				[hit.constructor.TYPE_ITEM, hit.constructor.TYPE_NPC, hit.constructor.TYPE_NPC2].includes(
					hit.objecttype
				)
				? hit
				: null;
		},
		tap: (x, y, pressedTarget) => {
			if (pressedTarget && EntityManager.get(pressedTarget.GID) !== pressedTarget) return;
			const hit = pressedTarget || Commands.pickSceneEntity(x, y);
			// Keep self taps inert unless a skill is awaiting its target.
			if (hit === Session.Entity && !shortcuts.snapshot().pending) return;
			examTargets.clear();
			if (
				hit &&
				[hit.constructor.TYPE_ITEM, hit.constructor.TYPE_NPC, hit.constructor.TYPE_NPC2].includes(
					hit.objecttype
				)
			) {
				autoCombat.stop('手动操作，自动战斗已停止');
				shortcuts.cancel();
				Commands.tapScene(x, y, hit);
			} else if (shortcuts.snapshot().pending) {
				autoCombat.stop('手动施法，自动战斗已停止');
				shortcuts.pick(x, y);
			} else if (hit && hit.objecttype === hit.constructor.TYPE_MOB) {
				if (isIdentificationExam(MapRenderer.currentMap)) {
					autoCombat.stop();
					examTargets.pick(EntityManager.intersect(true));
				} else if (!autoCombat.attackTarget(hit.GID)) view.notice('当前无法攻击这只魔物');
			} else {
				autoCombat.stop('手动操作，自动战斗已停止');
				if (isIdentificationExam(MapRenderer.currentMap)) Commands.stopAttack();
				Commands.tapScene(x, y);
			}

			snapshot();
		}
	});
	const mapView = view;
	const mapSignal = abort.signal;
	const grid = { width: Altitude.width, height: Altitude.height };
	mapView.setMap({ ...grid, loading: true });
	loadCatalogMapImage(MapRenderer.currentMap)
		.then(
			source =>
				new Promise(resolve => {
					if (!source) return resolve(null);
					const image = new Image();
					image.onload = () => resolve(image);
					image.onerror = () => resolve(null);
					image.src = source;
				})
		)
		.catch(() => null)
		.then(image => {
			if (mapSignal.aborted) return;
			const map = image && hasVisiblePixels(image) ? image : createAltitudeFallback();
			mapView.setMap({ ...grid, image: map, loading: false });
		});
	snapshot();
	unsubscribe = subscribeChatFeed(messages => {
		view.setMessages(
			messages.map(message => {
				const parsed = message.html ? new DOMParser().parseFromString(message.text, 'text/html') : null;
				return {
					id: message.id,
					privatePeer: message.privatePeer,
					bodyText: message.bodyText,
					direction: message.direction,
					replyable: message.replyable,
					text: parsed ? parsed.body.textContent || '' : message.text,
					channel: chatChannel(message),
					incomingPrivate: isIncomingPrivateMessage(message)
				};
			})
		);
	});
	const cancel = () => {
		cancelSceneInput();
		view.suspend();
	};
	window.addEventListener('blur', cancel, { signal: abort.signal });
	document.addEventListener(
		'visibilitychange',
		() => {
			if (document.hidden) cancel();
		},
		{ signal: abort.signal }
	);
	unsubscribeOrientation = Platform.onOrientationChange(cancelSceneInput);
	for (const type of ['resize', 'scroll'])
		window.visualViewport?.addEventListener(type, updateViewport, { signal: abort.signal });
	window.addEventListener('resize', updateViewport, { signal: abort.signal });
	const viewport = updateViewport;
	for (const type of ['focusin', 'focusout'])
		HUD.getRoot().addEventListener(type, () => queueMicrotask(viewport), { signal: abort.signal });
	updateViewport();
};
HUD.onRemove = function (resetInteraction = true) {
	setModal(false);
	releaseInputFreeze(HUD);
	examTargets?.clear();
	examTargets = null;
	selfActions?.destroy();
	selfActions = null;
	releaseScreenWakeLock?.();
	releaseScreenWakeLock = null;
	disposeInputEditor?.();
	disposeInputEditor = null;
	updateViewport?.destroy();
	autoCombat?.destroy();
	autoCombat = null;
	unsubscribeInteraction?.();
	unsubscribeInteraction = null;
	if (resetInteraction) clearInteraction();
	controls?.destroy();
	controls = null;
	shortcuts?.cancel();
	shortcuts = null;
	inventory = null;
	equipment = null;
	skills = null;
	attributes = null;
	quests = null;
	chat = null;
	social = null;
	containers = null;
	clearAttackIntent();
	unsubscribe?.();
	unsubscribe = null;
	unsubscribeOrientation?.();
	unsubscribeOrientation = null;
	abort?.abort();
	abort = null;
	if (view) {
		cancelSceneInput();
		view.destroy();
		view = null;
	}
};
export default UIManager.addComponent(HUD);
