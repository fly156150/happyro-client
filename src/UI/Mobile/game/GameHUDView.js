import { bindChatPreviewLayout } from './ChatPreviewLayout.js';
import menuNarrowTabletCSS from './MenuNarrowTablet.css?raw';
import menuButtonSizingCSS from './MenuButtonSizing.css?raw';
import menuBottomTabsCSS from './MenuBottomTabs.css?raw';
import menuFeatureStyles from './MenuFeatureStyles.js';
import menuFormControlsCSS from './MenuFormControls.css?raw';
import menuChromeCSS from './MenuChrome.css?raw';
import menuActionButtonsCSS from './MenuActionButtons.css?raw';
import vendingCSS from './VendingPanel.css?raw';
import companionLayoutCSS from './CompanionLayout.css?raw';
import menuNavigationCSS from './MenuNavigation.css?raw';
import menuContentComponentsCSS from './MenuContentComponents.css?raw';
import menuContentLayoutCSS from './MenuContentLayout.css?raw';
import { bindHUDNotificationInset } from './HUDNotificationInset.js';
import menuPortraitCSS from './MenuPortrait.css?raw';
import portraitCSS from './GameHUDPortrait.css?raw';
import interactionCSS from './InteractionPanel.css?raw';
import interactionPhoneCSS from './InteractionPhone.css?raw';
import interactionTabletCSS from './InteractionTablet.css?raw';
import { createChatPreview } from './ChatPreview.js';
import chatPreviewCSS from './ChatPreview.css?raw';
import menuLayoutCSS from './MenuLayout.css?raw';
import pickupCSS from 'UI/Game/PickupSettingsPanel.css?raw';
import Preferences from 'Core/Preferences.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { showToast } from 'UI/Components/Toast.js';
import { createStatusPanel } from './StatusPanel.js';
import { clearToast } from 'UI/Components/Toast.js';
import mobileSelectCSS from './MobileSelect.css?raw';
import { createMenuSelects } from './MenuSelects.js';
import selectCSS from 'UI/Components/GameTools/GameSelect.css?raw';
import { drawPlayerArrow } from 'UI/Components/GameTools/WorldMapPreview.js';
import { fittedMapRect, mapImageSourceRect, mapPointToCanvas } from 'UI/Components/GameTools/MapPreviewLayout.js';
import { createCombatSettingsPanel } from './CombatSettingsPanel.js';
import autoCombatCSS from 'UI/Game/AutoCombatPanel.css?raw';
import switchCSS from 'UI/Components/GameSwitch.css?raw';
import { createCompanionsPanel } from './CompanionsPanel.js';
import { createPetPanel } from './PetPanel.js';
import { createMailPanel } from './MailPanel.js';
import { createCameraPanel } from './CameraPanel.js';
import { createSettingsPanel } from './SettingsPanel.js';
import { createBankPanel } from './BankPanel.js';
import { createVendingPanel } from './VendingPanel.js';
import { createTradePanel } from './TradePanel.js';
import { createEnchantPanel } from './EnchantPanel.js';
import { createRefinementPanel } from './RefinementPanel.js';
import { createMaterialsPanel } from './MaterialsPanel.js';
import { createSelectionPanel } from './SelectionPanel.js';
import { createSocialPanel } from './SocialPanel.js';
import { createChatPanel, createChatComposer } from './ChatPanel.js';
import { createQuestsPanel } from './QuestsPanel.js';
import { createContainerPanel } from './ContainerPanel.js';
import shopCSS from './ShopPanel.css?raw';
import { createShopPanel } from './ShopPanel.js';
import npcCSS from './NPCPanel.css?raw';
import { createNPCPanel, updateNPCCutin } from './NPCPanel.js';
import { createAttributesPanel } from './AttributesPanel.js';
import { createSkillsPanel } from './SkillsPanel.js';
import { createEquipmentPanel } from './EquipmentPanel.js';
import { createInventoryPanel } from './InventoryPanel.js';
import { createShortcutPanel } from './ShortcutPanel.js';
import html from './GameHUD.html?raw';
import css from './GameHUD.css?raw';
import responsiveCSS from './GameHUDResponsive.css?raw';
import panelsCSS from './MenuPanels.css?raw';
import mailCSS from './MailPanel.css?raw';

/** DOM-only view; no packets, desktop windows or map event handlers. */
export function createGameHUDView(root, actions) {
	root.innerHTML = `<style>${css}
${autoCombatCSS}
${responsiveCSS}
${selectCSS}
${panelsCSS}
${pickupCSS}
${mobileSelectCSS}
${mailCSS}
${menuLayoutCSS}
${npcCSS}
${shopCSS}
${interactionCSS}
${interactionPhoneCSS}
${interactionTabletCSS}
${chatPreviewCSS}
${switchCSS}
${portraitCSS}
${menuPortraitCSS}
${menuContentLayoutCSS}
${menuContentComponentsCSS}
${companionLayoutCSS}
${menuNavigationCSS}
${menuActionButtonsCSS}
${vendingCSS}${menuChromeCSS}${menuFeatureStyles}${menuBottomTabsCSS}${menuFormControlsCSS}${menuButtonSizingCSS}${menuNarrowTabletCSS}</style>${html}`;
	const $ = selector => root.querySelector(selector);
	const abort = new AbortController();
	const chatPreview = createChatPreview(root);
	const releaseNotificationInset = bindHUDNotificationInset(root);
	let settingsCleanup;
	let combatSettingsCleanup;
	const chatDisplay = Preferences.get('ChatPreview', { collapsed: false }, 1.0);
	let chatPreviewCramped = false;
	let currentPanel = null;
	let statusPanel = null;
	let serverState = null;
	let shortcutPanel = null;
	let inventoryPanel = null;
	let equipmentPanel = null;
	let skillsPanel = null;
	let attributesPanel = null;
	let questsPanel = null;
	let chatPanel = null;
	let chatFilter = 'all';
	const chatComposer = createChatComposer();
	let socialPanel = null;
	let selectionPanel = null;
	let materialsPanel = null;
	let refinementPanel = null;
	let enchantPanel = null;
	let petPanel = null;
	let companionsPanel = null;
	let mailPanel = null;
	let bankPanel = null;
	let vendingPanel = null;
	let tradePanel = null;
	let shopPanel = null;
	let containerPanel = null;
	let noticeUntil = 0;
	let backdropPointer = null;
	let dismissBackdrop = false;
	let lastTrigger;
	let interactionPress = null;
	let petConfirmation = null;
	let mercenaryConfirmation = null;
	let snapshot = {};
	let messages = [];
	let unreadChat = 0;
	let mapImage;
	const backdrop = $('.backdrop');
	const body = $('.panel-body');
	const listen = (node, type, handler) => node.addEventListener(type, handler, { signal: abort.signal });
	// A scene tap or a press on the previous dialog cannot activate newly rendered controls.
	listen(root, 'pointerdown', event => {
		interactionPress =
			serverState && backdrop.contains(event.target)
				? event.target.closest('button, input, select, textarea, a') || event.target
				: null;
	});
	listen(root, 'pointercancel', () => {
		interactionPress = null;
	});
	root.addEventListener(
		'click',
		event => {
			if (!serverState || !backdrop.contains(event.target) || event.detail === 0) return;
			const pressed = interactionPress;
			interactionPress = null;
			if (
				!pressed ||
				!pressed.isConnected ||
				!(pressed === event.target || pressed.contains(event.target) || event.target.contains(pressed))
			) {
				event.preventDefault();
				event.stopImmediatePropagation();
			}
		},
		{ capture: true, signal: abort.signal }
	);
	// Bubble only: inner controls keep native clicks, selection and scrolling.
	for (const type of [
		'pointerdown',
		'pointerup',
		'pointermove',
		'pointercancel',
		'mousedown',
		'mouseup',
		'click',
		'dblclick',
		'contextmenu',
		'touchstart',
		'touchmove',
		'touchend',
		'touchcancel',
		'wheel',
		'keydown',
		'keyup'
	]) {
		listen(root, type, event => {
			event.stopPropagation();
		});
	}
	listen(root, 'pointerdown', event => {
		if (!event.target.closest('.combat, .battle-dock')) actions.cancelSceneInput();
	});
	listen($('[data-auto-toggle]'), 'click', () => {
		if (snapshot.target?.player || snapshot.target?.pet || snapshot.target?.mercenary) actions.clearPlayerSelection();
		else actions.toggleAutoCombat();
	});
	listen($('[data-interact]'), 'click', () => actions.interact());
	for (const button of root.querySelectorAll('[data-player-action]')) {
		listen(button, 'click', () => {
			const player = snapshot.target?.player;
			const action = button.dataset.playerAction;
			const container = $('[data-player-actions]');
			const perform = () => {
				const error = actions.playerAction(action, player?.id);
				if (error) showToast(container, error, 'error');
				else if (action === 'friend') showToast(container, '已发好友请求', 'success');
			};
			if (action === 'trade' && player)
				confirmAction(container, `向 ${player.name} 发起交易？`, perform);
			else perform();
		});
	}
	for (const button of root.querySelectorAll('[data-pet-action]')) {
		listen(button, 'click', () => {
			petConfirmation?.dismiss();
			const pet = snapshot.target?.pet, action = button.dataset.petAction;
			const container = $('[data-pet-actions]');
			const prepared = actions.preparePetAction(action, pet?.id);
			if (prepared.error) {
				showToast(container, prepared.error, 'error');
				return;
			}
			const perform = () => {
				petConfirmation = null;
				const error = prepared.execute();
				if (error) showToast(container, error, 'error');
			};
			if (action === 'feed' || action === 'egg') {
				const message = action === 'feed' ? `给「${pet.name}」喂食？` : `将「${pet.name}」收回为宠物蛋？`;
				petConfirmation = { id: pet.id, dismiss: confirmAction(container, message, perform, {
					cancelled: () => { petConfirmation = null; }
				}) };
			} else perform();
		});
	}
	for (const button of root.querySelectorAll('[data-mercenary-action]')) {
		listen(button, 'click', () => {
			mercenaryConfirmation?.dismiss();
			const mercenary = snapshot.target?.mercenary, action = button.dataset.mercenaryAction;
			const container = $('[data-mercenary-actions]');
			const prepared = actions.prepareMercenaryAction(action, mercenary?.id);
			if (prepared.error) {
				showToast(container, prepared.error, 'error');
				return;
			}
			const perform = () => {
				mercenaryConfirmation = null;
				const error = prepared.execute();
				if (error) showToast(container, error, 'error');
			};
			if (action === 'dismiss') {
				mercenaryConfirmation = { id: mercenary.id, dismiss: confirmAction(container, '提前解除佣兵契约？', perform, {
					cancelled: () => { mercenaryConfirmation = null; }
				}) };
			} else perform();
		});
	}
	for (const button of root.querySelectorAll('[data-shortcut-page]'))
		listen(button, 'click', () => actions.shortcutPage(Number(button.dataset.shortcutPage)));
	listen($('[data-skill-cancel]'), 'click', () => actions.cancelSkill());
	listen($('[data-skill-self]'), 'click', () => actions.selfSkill());
	const text = (selector, value) => {
		$(selector).textContent = value ?? '';
	};
	function drawMap(canvas) {
		if (!canvas || !mapImage) return;
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		const fit = fittedMapRect(canvas.width, canvas.height, mapImage.width, mapImage.height);
		if (mapImage.image) {
			const image = mapImage.image;
			const source = mapImageSourceRect(
				image.naturalWidth || image.width,
				image.naturalHeight || image.height,
				mapImage
			);
			ctx.drawImage(image, source.x, source.y, source.width, source.height, fit.x, fit.y, fit.width, fit.height);
		} else {
			ctx.fillStyle = '#c6d0db';
			ctx.textAlign = 'center';
			ctx.fillText(mapImage.loading ? '加载中' : '暂无图片', canvas.width / 2, canvas.height / 2);
		}
		if (!snapshot.position) return;
		const point = mapPointToCanvas(fit, mapImage, { x: snapshot.position[0], y: snapshot.position[1] });
		drawPlayerArrow(ctx, point, snapshot.direction ?? 0, 0.65);
	}
	const menuSelects = createMenuSelects(body);
	function close(notify = true) {
		menuSelects.close();
		if (!currentPanel || (notify && serverState?.canClose === false)) return;
		attributesPanel?.destroy();
		combatSettingsCleanup?.();
		combatSettingsCleanup = null;
		settingsCleanup?.();
		settingsCleanup = null;
		clearToast(body);
		const interaction = serverState;
		serverState = null;
		currentPanel = null;
		shortcutPanel = null;
		inventoryPanel = null;
		equipmentPanel = null;
		skillsPanel = null;
		attributesPanel = null;
		petPanel = null;
		companionsPanel = null;
		mailPanel = null;
		bankPanel = null;
		vendingPanel = null;
		tradePanel = null;
		shopPanel = null;
		containerPanel = null;
		questsPanel = null;
		chatPanel = null;
		socialPanel = null;
		selectionPanel = null;
		materialsPanel = null;
		refinementPanel = null;
		enchantPanel = null;
		backdrop.hidden = true;
		actions.setModal(false);
		lastTrigger?.focus();
		if (notify) interaction?.close?.();
	}
	function updateMessages() {
		chatPanel?.update(messages);
		const readingPrivate = currentPanel === 'chat' && chatFilter === 'all';
		if (readingPrivate) unreadChat = 0;
		else if (currentPanel === 'chat') unreadChat = messages.filter(m => m.incomingPrivate && !chatComposer.read.has(m.id)).length;
		for (const badge of root.querySelectorAll('[data-chat-unread]')) {
			badge.hidden = !unreadChat;
			badge.textContent = unreadChat > 99 ? '99+' : String(unreadChat);
		}
		chatPreview.update(messages, { read: readingPrivate, visible: !currentPanel });
	}
	function details(entries) {
		const dl = document.createElement('dl');
		for (const [label, value] of entries) {
			const dt = document.createElement('dt');
			dt.textContent = label;
			const dd = document.createElement('dd');
			dd.textContent = value;
			dl.append(dt, dd);
		}
		dl.className = 'character-details';
		body.replaceChildren(dl);
	}
	function renderDetails() {
		if (currentPanel === 'profile')
			details([
				['角色', snapshot.name],
				['职业', snapshot.job],
				['等级', snapshot.level],
				['职业等级', snapshot.jobLevel],
				['HP', `${snapshot.hp} / ${snapshot.maxHp}`],
				['SP', `${snapshot.sp} / ${snapshot.maxSp}`],
				['Zeny', snapshot.money]
			]);
		if (currentPanel === 'status') statusPanel?.update(snapshot.statuses || []);
	}
	function open(panel, slotIndex) {
		attributesPanel?.destroy();
		combatSettingsCleanup?.();
		combatSettingsCleanup = null;
		settingsCleanup?.();
		settingsCleanup = null;
		clearToast(body);
		if (panel === 'map') {
			close();
			actions.openAdventureMap(slotIndex, () => open('menu'));
			return;
		}
		if (!currentPanel) lastTrigger = root.activeElement;
		currentPanel = panel;
		$('.panel').dataset.view = panel;
		$('.panel').classList.toggle(
			'interaction-panel',
			[
				'materials',
				'transformation',
				'refinement',
				'enchant',
				'selection',
				'trade',
				'vending',
				'storage',
				'cart'
			].includes(panel)
		);
		backdropPointer = null;
		dismissBackdrop = false;
		backdrop.hidden = false;
		actions.setModal(true);
		text(
			'h2',
			{
				autoCombat: '自动战斗设置',
				settings: '设置',
				camera: '镜头',
				profile: '人物信息',
				status: '状态效果',
				menu: '菜单',
				chat: '聊天',
				attributes: '素质',
				shortcuts: '快捷键',
				inventory: '背包',
				equipment: serverState?.kind === 'equipment' ? serverState.title : '装备',
				skills: '技能',
				quests: '任务',
				social: '社交',
				transformation: serverState?.title,
				information: serverState?.title,
				selection: serverState?.title,
				materials: serverState?.title,
				refinement: serverState?.title,
				enchant: serverState?.title,
				cart: '手推车',
				storage: serverState?.title || '仓库',
				pet: serverState?.title,
				companions: serverState?.title,
				mail: serverState?.title,
				bank: serverState?.title,
				vending: serverState?.title,
				trade: serverState?.title,
				shop: serverState?.title,
				npc: serverState?.title || 'NPC 对话'
			}[panel]
		);
		$('[data-close]').hidden = serverState?.canClose === false;
		$('[data-close]').disabled = serverState?.canClose === false;
		$('[data-close]').title = panel === 'npc' && serverState?.canClose === false ? '请先完成当前对话步骤' : '关闭';
		$('[data-back]').hidden =
			(Boolean(serverState) &&
				!serverState.back &&
				!['pet', 'companions', 'mail', 'bank', 'vending'].includes(panel)) ||
			panel === 'menu' ||
			panel === 'chat' ||
			panel === 'camera' ||
			panel === 'npc';
		$('[data-back]').disabled = serverState?.canClose === false;
		body.replaceChildren();
		body.classList.remove('equipment-selection');
		statusPanel = null;
		body.classList.toggle('settings-body', panel === 'settings');
		$('.panel').classList.toggle('settings-panel', panel === 'settings');
		$('.panel').classList.toggle('profile-panel', panel === 'profile');
		body.classList.toggle('equipment-body', panel === 'equipment');
		$('.panel').classList.toggle('equipment-panel', panel === 'equipment');
		body.classList.toggle(
			'inventory-body',
			[
				'mail',
				'inventory',
				'skills',
				'status',
				'attributes',
				'shop',
				'trade',
				'vending',
				'storage',
				'cart',
				'quests',
				'social',
				'selection',
				'transformation',
				'refinement',
				'enchant',
				'materials'
			].includes(panel)
		);
		$('.panel').classList.toggle(
			'inventory-panel',
			[
				'mail',
				'inventory',
				'skills',
				'status',
				'attributes',
				'shop',
				'trade',
				'vending',
				'storage',
				'cart',
				'quests',
				'social',
				'selection',
				'transformation',
				'refinement',
				'enchant',
				'materials'
			].includes(panel)
		);
		body.classList.toggle('shortcut-body', panel === 'shortcuts');
		body.classList.toggle('auto-config-body', panel === 'autoCombat');
		$('.panel').classList.toggle('auto-config-panel', panel === 'autoCombat');
		$('.panel').classList.toggle('shortcut-panel', panel === 'shortcuts');
		body.classList.toggle('chat-body', panel === 'chat');
		$('.panel').classList.toggle('chat-panel', panel === 'chat');
		backdrop.classList.toggle('chat-backdrop', panel === 'chat');
		backdrop.classList.toggle('camera-backdrop', panel === 'camera');
		if (panel === 'information') {
			const list = document.createElement('dl');
			list.className = 'interaction-information';
			for (const [label, value] of serverState.rows) {
				const term = document.createElement('dt'),
					description = document.createElement('dd');
				term.textContent = label;
				description.textContent = String(value);
				list.append(term, description);
			}
			body.append(list);
		}
		if (panel === 'autoCombat')
			combatSettingsCleanup = createCombatSettingsPanel(body, actions.autoCombat, $('.panel > header'));
		if (panel === 'settings')
			settingsCleanup = createSettingsPanel(body, {
				...actions.settings,
				preview: settings => chatPreview.configure(settings)
			});
		if (panel === 'npc') createNPCPanel(body, serverState);
		if (panel === 'camera') createCameraPanel(body, actions.camera);
		if (panel === 'status') statusPanel = createStatusPanel(body);
		if (panel === 'profile' || panel === 'status') renderDetails();
		if (panel === 'menu') {
			const grid = document.createElement('div');
			grid.className = 'menu-grid';
			for (const [label, panelName] of [
				['设置', 'settings'],
				['人物', 'profile'],
				['地图', 'map'],
				['聊天', 'chat'],
				['状态', 'status'],
				['素质', 'attributes'],
				['快捷键', 'shortcuts'],
				['背包', 'inventory'],
				['装备', 'equipment'],
				['技能', 'skills'],
				['手推车', 'cart'],
				['任务', 'quests'],
				['社交', 'social']
			]) {
				const button = document.createElement('button');
				button.textContent = label;
				button.disabled = !panelName;
				if (panelName) button.onclick = () => open(panelName);
				grid.append(button);
			}
			const adventureButton = document.createElement('button');
			adventureButton.textContent = '冒险工具';
			adventureButton.onclick = () => {
				close();
				actions.openAdventureTools(() => open('menu'));
			};
			grid.prepend(adventureButton);
			const petButton = document.createElement('button');
			petButton.textContent = '宠物';
			petButton.onclick = () => {
				if (!actions.openPet()) showToast(body, '当前无法打开宠物', 'error');
			};
			grid.append(petButton);
			for (const [kind, label] of [
				['homunculus', '生命体'],
				['mercenary', '佣兵']
			]) {
				const button = document.createElement('button');
				button.textContent = label;
				button.onclick = () => {
					if (!actions.openCompanion(kind)) showToast(body, `当前无法打开${label}`, 'error');
				};
				grid.append(button);
			}
			const mailButton = document.createElement('button');
			mailButton.textContent = '邮件';
			mailButton.onclick = () => {
				if (!actions.openMail()) showToast(body, '当前无法打开邮件', 'error');
			};
			grid.append(mailButton);
			const bankButton = document.createElement('button');
			bankButton.textContent = '银行';
			bankButton.onclick = () => {
				const result = actions.openBank();
				if (result !== '已请求打开银行') showToast(body, result, 'error');
			};
			grid.append(bankButton);
			const storeButton = document.createElement('button');
			storeButton.textContent = '我的摊位';
			storeButton.onclick = () => {
				if (!actions.showOwnedVending()) showToast(body, '尚未开店，请先使用摆摊或收购技能', 'info');
			};
			grid.append(storeButton);
			const exit = document.createElement('button');
			exit.textContent = '返回选角';
			exit.onclick = () =>
				confirmAction(body, '返回选角？', () => {
					close();
					actions.returnToCharacters();
				});
			grid.append(exit);
			body.append(grid);
		}
		shortcutPanel = null;
		inventoryPanel = null;
		equipmentPanel = null;
		skillsPanel = null;
		attributesPanel = null;
		petPanel = null;
		companionsPanel = null;
		mailPanel = null;
		bankPanel = null;
		vendingPanel = null;
		tradePanel = null;
		shopPanel = null;
		containerPanel = null;
		questsPanel = null;
		chatPanel = null;
		socialPanel = null;
		selectionPanel = null;
		materialsPanel = null;
		refinementPanel = null;
		enchantPanel = null;
		if (panel === 'social') socialPanel = createSocialPanel(body, actions.social, name => open('chat', name));
		if (panel === 'quests')
			questsPanel = createQuestsPanel(body, {
				snapshot: actions.questSnapshot,
				toggle: actions.questToggle,
				showMap: target => open('map', target)
			});
		if (panel === 'storage' || panel === 'cart')
			containerPanel = createContainerPanel(
				body,
				{
					snapshot: actions.containerSnapshot,
					preview: actions.containerPreview,
					transfer: actions.transferItem,
					removeCart: actions.removeCart,
					setCapacity: capacity =>
						text(
							'h2',
							`${panel === 'cart' ? '手推车' : serverState?.title || '仓库'}${capacity ? ` (${capacity.current}/${capacity.limit})${capacity.weight === undefined ? '' : ` · 负重 ${capacity.weight}/${capacity.maxWeight}`}` : ''}`
						)
				},
				panel
			);
		if (panel === 'enchant') {
			serverState.service.setOperationGuard(actions.canOperate);
			enchantPanel = createEnchantPanel(body, serverState.service);
		}
		if (panel === 'refinement') {
			serverState.service.setOperationGuard(actions.canOperate);
			refinementPanel = createRefinementPanel(body, serverState.service);
		}
		if (panel === 'materials' || panel === 'transformation') {
			serverState.service.setOperationGuard(actions.canOperate);
			materialsPanel = createMaterialsPanel(body, serverState.service);
		}
		if (panel === 'selection') {
			serverState.service.setOperationGuard(actions.canOperate);
			selectionPanel = createSelectionPanel(body, serverState.service);
		}
		if (panel === 'companions') {
			serverState.service.setOperationGuard(actions.canOperate);
			companionsPanel = createCompanionsPanel(body, serverState.service);
		}
		if (panel === 'pet') {
			serverState.service.setOperationGuard(actions.canOperate);
			petPanel = createPetPanel(body, serverState.service);
		}
		if (panel === 'mail') {
			serverState.service.setOperationGuard(actions.canOperate);
			mailPanel = createMailPanel(body, serverState.service);
		}
		if (panel === 'bank') {
			serverState.service.setOperationGuard(actions.canOperate);
			bankPanel = createBankPanel(body, serverState.service);
		}
		if (panel === 'vending') {
			serverState.service.setOperationGuard(actions.canOperate);
			vendingPanel = createVendingPanel(body, serverState.service);
		}
		if (panel === 'trade') {
			serverState.service.setOperationGuard(actions.canOperate);
			tradePanel = createTradePanel(body, serverState.service);
		}
		if (panel === 'shop') {
			serverState.service.setOperationGuard(actions.canOperate);
			shopPanel = createShopPanel(body, serverState.service);
		}
		if (panel === 'attributes')
			attributesPanel = createAttributesPanel(body, actions.attributes, $('.panel > header'));
		if (panel === 'skills')
			skillsPanel = createSkillsPanel(body, {
				snapshot: actions.skillsSnapshot,
				learn: actions.skillsLearn,
				reset: actions.skillsReset,
				bind: actions.skillsBind,
				shortcuts: actions.shortcutSnapshot,
				slotName: actions.shortcutName
			});
		if (panel === 'equipment')
			equipmentPanel = createEquipmentPanel(body, serverState?.kind === 'equipment' ? serverState.service : {
				snapshot: actions.equipmentSnapshot,
				removeAttachment: actions.equipmentRemoveAttachment,
				preview: actions.inventoryPreview,
				act: actions.equipmentAct
			});
		if (panel === 'inventory')
			inventoryPanel = createInventoryPanel(body, {
				snapshot: actions.inventorySnapshot,
				preview: actions.inventoryPreview,
				act: actions.inventoryAct,
				drop: actions.inventoryDrop,
				shortcuts: actions.shortcutSnapshot,
				slotName: actions.shortcutName,
				bind: actions.bindInventory
			});
		if (panel === 'shortcuts')
			shortcutPanel = createShortcutPanel(body, {
				index: slotIndex,
				turn: actions.shortcutPage,
				snapshot: actions.shortcutSnapshot,
				candidates: actions.shortcutCandidates,
				skillDetail: id => actions.skillsSnapshot().skills.find(skill => skill.id === id),
				itemDetail: id => actions.inventorySnapshot().find(item => item.ID === id),
				previewItem: actions.inventoryPreview,
				configure: actions.configureShortcut
			});
		if (panel === 'chat') {
			chatPanel = createChatPanel(
				body,
				actions.sendChat,
				slotIndex,
				actions.chatEmotionImages,
				chatFilter,
				value => {
					chatFilter = value;
					updateMessages();
				},
				chatComposer,
				actions.chatChannelError
			);
			updateMessages();
		}
		menuSelects.sync();
		$('h2').focus();
	}
	function renderChatDisplay() {
		const collapsed = chatDisplay.collapsed || chatPreviewCramped;
		$('.chat-preview').classList.toggle('collapsed', collapsed);
		$('.chat-preview-open').hidden = collapsed;
		$('[data-chat-collapse]').hidden = collapsed;
		const expand = $('[data-chat-expand]');
		expand.hidden = !collapsed;
		const label = chatPreviewCramped ? '打开聊天' : '展开聊天预览';
		expand.setAttribute('aria-label', label);
		expand.title = label;
	}

	for (const [selector, collapsed] of [
		['[data-chat-collapse]', true],
		['[data-chat-expand]', false]
	]) {
		listen($(selector), 'click', () => {
			if (!collapsed && chatPreviewCramped) {
				open('chat');
				return;
			}
			chatDisplay.collapsed = collapsed;
			chatDisplay.save();
			renderChatDisplay();
			if (!collapsed) updateMessages();
			$(collapsed ? '[data-chat-expand]' : '[data-chat-collapse]').focus();
		});
	}
	renderChatDisplay();
	const releaseChatPreviewLayout = bindChatPreviewLayout(root, cramped => {
		const focused = $('.chat-preview').contains(root.activeElement);
		chatPreviewCramped = cramped;
		renderChatDisplay();
		updateMessages();
		if (focused) $(chatDisplay.collapsed || cramped ? '[data-chat-expand]' : '[data-chat-collapse]').focus();
	});
	for (const button of root.querySelectorAll('[data-panel]'))
		listen(button, 'click', () => open(button.dataset.panel));
	listen($('[data-close]'), 'click', () => close());
	// A touch held before opening the panel must not dismiss it on release.
	listen($('[data-back]'), 'click', () => {
		if (serverState?.canClose === false) return;
		const destination = serverState?.back || 'menu';
		close();
		open(destination);
	});
	listen(backdrop, 'pointerdown', event => {
		backdropPointer = event.target === backdrop ? event.pointerId : null;
		dismissBackdrop = false;
	});
	listen(backdrop, 'pointerup', event => {
		dismissBackdrop = event.target === backdrop && backdropPointer !== null && backdropPointer === event.pointerId;
		backdropPointer = null;
	});
	listen(backdrop, 'pointercancel', () => {
		backdropPointer = null;
		dismissBackdrop = false;
	});
	listen(backdrop, 'click', event => {
		if (event.target === backdrop && dismissBackdrop && currentPanel !== 'npc') close();
		dismissBackdrop = false;
	});
	listen(root, 'keydown', event => {
		if (!currentPanel) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		}
		if (event.key === 'Tab') {
			const items = [...backdrop.querySelectorAll('button, input, select, textarea, [tabindex]')].filter(
				item => !item.disabled && item.tabIndex >= 0 && item.getClientRects().length > 0
			);
			const index = items.indexOf(root.activeElement);
			event.preventDefault();
			items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
		}
	});
	return {
		suspend() {
			// Backgrounding cancels gestures, not the menu or its local drafts.
			// Disconnect/removal still destroys the view through the normal lifecycle.
			backdropPointer = null;
			dismissBackdrop = false;
			interactionPress = null;
		},
		update(next) {
			snapshot = next;
			text('[data-panel=menu]', next.unreadMail ? '菜单 · 新邮件' : '菜单');
			if (performance.now() >= noticeUntil) text('[data-target]', next.autoCombat?.status || '自动战斗已停止');
			const species = next.autoCombat?.species || [];
			const targetLabel = species.length > 1 ? `${species.length} 种魔物` : species[0]?.name || '全部魔物';
			text('[data-auto-target]', `${targetLabel} ▾`);
			$('[data-auto-target]').title = species.map(entry => entry.name).join('、') || '全部魔物';
			const player = next.target?.player, pet = next.target?.pet, mercenary = next.target?.mercenary;
			const hasActions = Boolean(player || pet || mercenary);
			text('[data-auto-toggle]', hasActions ? '取消选择' : next.autoCombat?.active ? '停止战斗' : '自动战斗');
			$('[data-auto-toggle]').setAttribute('aria-pressed', String(!hasActions && Boolean(next.autoCombat?.active)));
			$('[data-auto-toggle]').classList.toggle('clear-selection', hasActions);
			$('[data-player-actions]').hidden = !player;
			$('[data-pet-actions]').hidden = !pet;
			$('[data-mercenary-actions]').hidden = !mercenary;
			$('[data-target]').hidden = hasActions;
			$('.battle-status').classList.toggle('has-player-actions', hasActions);
			for (const button of root.querySelectorAll('[data-mercenary-action]')) button.disabled = !mercenary?.canOperate;
			text('[data-mercenary-action=aggressive]', mercenary?.aggressive ? '主动' : '被动');
			$('[data-mercenary-action=aggressive]').dataset.mode = mercenary?.aggressive ? 'active' : 'passive';
			$('[data-mercenary-action=aggressive]').title = mercenary?.aggressive ? '当前主动攻击，点击切换为被动攻击' : '当前被动攻击，点击切换为主动攻击';
			if (mercenaryConfirmation && (!mercenary?.canOperate || mercenary.id !== mercenaryConfirmation.id)) {
				mercenaryConfirmation.dismiss();
				mercenaryConfirmation = null;
			}
			for (const button of root.querySelectorAll('[data-pet-action]')) button.disabled = !pet?.canOperate;
			if (petConfirmation && (!pet?.canOperate || pet.id !== petConfirmation.id)) {
				petConfirmation.dismiss();
				petConfirmation = null;
			}
			for (const button of root.querySelectorAll('[data-player-action]')) button.disabled = !player?.name || (button.dataset.playerAction === 'friend' && player.friend);
			$('[data-player-action=friend]').title = player?.friend ? '已是好友' : '加好友';
			$('[data-interact]').hidden = !next.target?.interaction || (player && next.target.interaction === '交易');
			text('[data-interact]', next.target?.interaction);
			text('[data-name]', next.name);
			text('[data-job]', `Lv.${next.level} ${next.job}`);
			$('[data-ap-row]').hidden = !(next.maxAp > 0);
			$('[data-hp]').classList.toggle('low-hp', next.maxHp > 0 && next.hp / next.maxHp < 0.25);
			for (const type of ['hp', 'sp', 'ap']) {
				const max = next[{ hp: 'maxHp', sp: 'maxSp', ap: 'maxAp' }[type]];
				$(`[data-${type}]`).max = Math.max(1, max || 0);
				$(`[data-${type}]`).value = next[type] || 0;
				text(`[data-${type}-text]`, `${next[type] ?? 0} / ${max ?? 0}`);
			}
			text('[data-map-name]', next.mapName);
			text('[data-coordinates]', next.position?.map(Math.floor).join(', '));
			const icons = $('[data-status-icons]');
			const iconKey = JSON.stringify(next.statuses?.map(status => [status.id, status.icon]));
			if (icons.dataset.key !== iconKey) {
				icons.dataset.key = iconKey;
				icons.replaceChildren(
					...(next.statuses || [])
						.filter(status => status.icon)
						.slice(0, 4)
						.map(status => {
							const img = document.createElement('img');
							img.src = status.icon;
							img.alt = '';
							return img;
						})
				);
			}
			drawMap($('[data-mini-map]'));
			renderDetails();
			inventoryPanel?.update();
			equipmentPanel?.update();
			skillsPanel?.update();
			attributesPanel?.update();
			petPanel?.update();
			companionsPanel?.update();
			mailPanel?.update();
			bankPanel?.update();
			vendingPanel?.update();
			tradePanel?.update();
			shopPanel?.update();
			containerPanel?.update();
			questsPanel?.update();
			chatPanel?.refresh();
			socialPanel?.update();
			selectionPanel?.update();
			materialsPanel?.update();
			refinementPanel?.update();
			enchantPanel?.update();
			menuSelects.sync();
		},
		setMap(image) {
			mapImage = image;
			drawMap($('[data-mini-map]'));
		},
		setMessages(next) {
			if (!next.length) unreadChat = 0;
			const lastId = messages.at(-1)?.id || 0;
			if (currentPanel !== 'chat' || chatFilter !== 'all')
				unreadChat += next.filter(m => m.id > lastId && m.incomingPrivate).length;
			messages = next;
			updateMessages();
		},
		showInteraction(state) {
			if (!state) {
				if (serverState) close(false);
				return;
			}
			if (serverState?.token === state.token && currentPanel === 'npc') {
				serverState = state;
				updateNPCCutin(body, state);
				return;
			}
			interactionPress = null;
			serverState = state;
			open(
				[
					'shop',
					'trade',
					'vending',
					'mail',
					'pet',
					'companions',
					'bank',
					'storage',
					'selection',
					'materials',
					'refinement',
					'enchant',
					'information',
					'equipment',
					'transformation'
				].includes(state.kind)
					? state.kind
					: 'npc'
			);
		},
		openPrivate: name => open('chat', name),
		openShortcuts: index => open('shortcuts', index),
		updateShortcuts(state) {
			shortcutPanel?.updateIcons(actions.shortcutCandidates());
			text('[data-shortcut-page-label]', `${state.page + 1}/${state.pages}`);
			for (const button of root.querySelectorAll('[data-shortcut]')) {
				const slot = state.slots[Number(button.dataset.shortcut)];
				button.dataset.shortcutKind = slot?.binding ? (slot.binding.isSkill ? 'skill' : 'item') : 'empty';
				button.hidden = !slot;
				button.disabled = Boolean(slot?.unavailable);
				button.classList.toggle('selected-skill', Boolean(slot && state.pending?.index === slot.index));
				if (!slot) continue;
				button.setAttribute(
					'aria-label',
					`位置 ${slot.index + 1}：${slot.name}${slot.reason ? '，' + slot.reason : ''}`
				);
				button.setAttribute('aria-disabled', String(!slot.available));
				const seconds = Math.ceil((slot.cooldown || 0) / 1000);
				const cooldownText = seconds > 999 ? `${Math.min(999, Math.ceil(seconds / 60))}m` : String(seconds);
				const key = JSON.stringify([slot.icon, slot.amount, slot.empty, cooldownText]);
				if (button.dataset.content !== key) {
					button.dataset.content = key;
					button.replaceChildren();
					if (slot.empty) button.textContent = '＋';
					else {
						const img = document.createElement('img');
						img.alt = '';
						if (slot.icon) img.src = slot.icon;
						const count = document.createElement('small');
						count.textContent = slot.amount;
						button.append(img, count);
						if (slot.cooldown > 0) {
							const cooldown = document.createElement('b');
							cooldown.className = 'slot-cooldown';
							cooldown.textContent = cooldownText;
							button.append(cooldown);
						}
					}
				}
			}
			$('.battle-status').hidden = Boolean(state.pending);
			$('.skill-prompt').hidden = !state.pending;
			$('.skill-actions').hidden = !state.pending;
			$('.shortcut-tools').hidden = Boolean(state.pending);
			text(
				'[data-skill-prompt]',
				state.pending ? `${state.pending.name}：${state.pending.ground ? '点击地面施放' : '点击有效目标'}` : ''
			);
			$('[data-skill-self]').hidden = !state.pending?.self;
		},
		notice(message) {
			noticeUntil = performance.now() + 3000;
			text('[data-target]', message);
		},
		close,
		destroy() {
			releaseChatPreviewLayout();
			chatPreview.destroy();
			releaseNotificationInset();
			menuSelects.destroy();
			close(false);
			abort.abort();
			root.replaceChildren();
		}
	};
}
