import EntityManager from 'Renderer/EntityManager.js';
import Session from 'Engine/SessionStorage.js';
import { PET_EVOLUTION_INTIMACY } from 'DB/Pets/PetRules.js';
import PetInformations from 'UI/Components/PetInformations/PetInformations.js';
import { showToast } from 'UI/Components/Toast.js';
import Platform from 'UI/Platform.js';
import { receiveGamePetResult } from 'UI/Game/GamePet.js';
/**
 * UI/Components/PetEvolution/PetEvolution.js
 *
 * Display Pet Evolution
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Preferences from 'Core/Preferences.js';
import Renderer from 'Renderer/Renderer.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import ItemInfo from 'UI/Components/ItemInfo/ItemInfo.js';
import htmlText from './PetEvolution.html?raw';
import cssText from './PetEvolution.css?raw';

/**
 * Create Component
 */
const PetEvolution = new GUIComponent('PetEvolution', cssText);

PetEvolution.render = () => htmlText;

/**
 * Variables
 */
let currentMaterials = [];
let targetEvoPetEggId = 0;
let evolutionContext = null;
let requestPending = false;

/**
 * @var {Preferences} Window preferences
 */
const _preferences = Preferences.get(
	'PetEvolution',
	{
		x: 200,
		y: 200,
		show: true
	},
	1.0
);

/**
 * Initialize component
 */
PetEvolution.init = function init() {
	this.draggable('.titlebar');

	const root = PetEvolution.getRoot();

	const closeBtn = root.querySelector('.close');
	if (closeBtn) {
		closeBtn.addEventListener('mousedown', e => e.stopImmediatePropagation());
		closeBtn.addEventListener('click', () => {
			onClose();
		});
	}

	const cancelBtn = root.querySelector('.big_cancel');
	if (cancelBtn) {
		cancelBtn.addEventListener('click', () => {
			onClose();
		});
	}

	const evolveBtn = root.querySelector('.evolve');
	if (evolveBtn) {
		evolveBtn.addEventListener('click', () => {
			onRequestEvolve();
		});
	}
};

PetEvolution.onAppend = function onAppend() {
	const rect = this._host.getBoundingClientRect();
	const hostHeight = rect.height || 380;
	const hostWidth = rect.width || 280;
	this._host.style.top = `${Math.min(Math.max(0, _preferences.y), Renderer.height - hostHeight)}px`;
	this._host.style.left = `${Math.min(Math.max(0, _preferences.x), Renderer.width - hostWidth)}px`;
};

/**
 * Once remove from body, save user preferences
 */
PetEvolution.onRemove = function onRemove() {
	_preferences.show = this._host.style.display !== 'none';
	_preferences.y = parseInt(this._host.style.top, 10);
	_preferences.x = parseInt(this._host.style.left, 10);
	_preferences.save();

	// Clear variables
	currentMaterials = [];
	targetEvoPetEggId = 0;
	evolutionContext = null;
	requestPending = false;
};

/**
 * Update UI
 *
 * @param {object} pet evolution info
 */
PetEvolution.SetInfo = function SetInfo(baseJobID, targetEggID) {
	const root = PetEvolution.getRoot();
	const baseData = DB.getPetByJobID(baseJobID);

	if (!baseData?.Evolution?.[targetEggID]) {
		console.warn('Pet Base Data data not found');
		return;
	}

	const evoData = DB.getPetByEggID(targetEggID);
	if (!evoData) {
		console.warn('Evo Data data not found');
		return;
	}

	evolutionContext = {
		owner: Session.Entity,
		petId: Session.petId,
		pet: EntityManager.get(Session.petId),
		job: baseJobID
	};
	requestPending = false;
	const submit = root.querySelector('.evolve');
	if (submit) submit.disabled = false;

	for (const [selector, illustration] of [
		['.base_pet_illust', baseData.PetIllust],
		['.target_pet_illust', evoData.PetIllust]
	]) {
		const element = root.querySelector(selector);
		if (!element) continue;
		element.style.backgroundImage = '';
		if (illustration) {
			Client.loadFile('data/texture/userinterface/illust/' + illustration, url => {
				if (targetEvoPetEggId === evoData.PetEggID) element.style.backgroundImage = `url(${url})`;
			});
		}
	}

	targetEvoPetEggId = evoData.PetEggID;

	const basePetEggEl = root.querySelector('.base_petEggId');
	if (basePetEggEl) {
		basePetEggEl.textContent = DB.getItemInfo(baseData.PetEggID).identifiedDisplayName;
		basePetEggEl.setAttribute('data-index', baseData.PetEggID);
		basePetEggEl.addEventListener('click', onItemInfo);
	}

	const targetPetEggEl = root.querySelector('.target_petEggId');
	if (targetPetEggEl) {
		targetPetEggEl.textContent = DB.getItemInfo(evoData.PetEggID).identifiedDisplayName;
		targetPetEggEl.setAttribute('data-index', evoData.PetEggID);
		targetPetEggEl.addEventListener('click', onItemInfo);
	}

	// === Evolution Requirements ===
	const reqBox = root.querySelector('.evo_requirements');
	if (!reqBox) {
		return;
	}
	reqBox.innerHTML = '';

	const materials = baseData.Evolution[targetEggID];

	// Save materials for later checks
	currentMaterials = materials;

	// Title
	const title = document.createElement('div');
	title.className = 'evo_requirements_title';
	title.textContent = DB.getMessage(2569);
	reqBox.appendChild(title);

	// Spacer / empty row
	const spacer = document.createElement('div');
	spacer.className = 'evo_requirement_spacer';
	spacer.style.height = '20px';
	reqBox.appendChild(spacer);

	// Materials
	materials.forEach(mat => {
		const item = DB.getItemInfo(mat.MaterialID);
		const itemName = item ? item.identifiedDisplayName || item.Name : `Item ${mat.MaterialID}`;

		const row = document.createElement('div');
		row.className = 'evo_requirement_row';

		// Create clickable item name span
		const nameSpan = document.createElement('span');
		nameSpan.className = 'evo_item_name';
		nameSpan.textContent = itemName;
		nameSpan.setAttribute('data-index', mat.MaterialID);
		nameSpan.style.cursor = 'pointer';
		nameSpan.addEventListener('click', onItemInfo);

		// Create amount span
		const amountSpan = document.createElement('span');
		amountSpan.className = 'evo_item_amount';
		amountSpan.textContent = ` - ${mat.Amount} 个`;

		// Append spans to row
		row.appendChild(nameSpan);
		row.appendChild(amountSpan);

		reqBox.appendChild(row);
	});

	// Spacer / empty row
	const spacer2 = document.createElement('div');
	spacer2.className = 'evo_requirement_spacer2';
	spacer2.style.height = '35px';
	reqBox.appendChild(spacer2);

	// Title
	const title2 = document.createElement('div');
	title2.className = 'evo_requirements_title2';
	title2.textContent = DB.getMessage(2570);
	reqBox.appendChild(title2);
};

/**
 * Check if player has enough materials for evolution
 *
 * @return {boolean} True if player has enough materials, false otherwise
 */
PetEvolution.hasEnoughMaterials = function () {
	if (!currentMaterials) {
		return false;
	}

	for (const mat of currentMaterials) {
		const item = Inventory.getUI().getItemById(mat.MaterialID);
		const count = item ? item.count : 0;

		if (count < mat.Amount) {
			return false;
		}
	}

	return true;
};

/**
 * Send a request to evolve the pet.
 * If the player has enough materials, send a PACKET.CZ.PET_EVOLUTION packet.
 * If the player does not have enough materials, display an error message.
 */
function onRequestEvolve() {
	if (requestPending) return;
	if (
		!evolutionContext ||
		!Session.Playing ||
		!Session.Entity ||
		Session.Entity !== evolutionContext.owner ||
		Session.petId !== evolutionContext.petId ||
		!evolutionContext.pet ||
		EntityManager.get(Session.petId) !== evolutionContext.pet ||
		Session.pet.job !== evolutionContext.job ||
		Session.Entity.action === Session.Entity.ACTION.DIE ||
		Session.pet.friendly < PET_EVOLUTION_INTIMACY ||
		PetInformations.accessory
	) {
		onClose();
		showToast(document.body, '宠物状态已变化，请重新打开进化窗口', 'error');
		return;
	}
	if (PetEvolution.hasEnoughMaterials() === true) {
		const pkt = new PACKET.CZ.PET_EVOLUTION();
		pkt.evolutionPetEggITID = targetEvoPetEggId;
		requestPending = true;
		PetEvolution.getRoot().querySelector('.evolve').disabled = true;
		Network.sendPacket(pkt);
	} else {
		ChatBox.addText(DB.getMessage(2574), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
	}
}

/**
 * Closing window
 */
function onClose() {
	if (PetEvolution._host) {
		PetEvolution._host.style.display = 'none';
	}

	// Clear variables
	currentMaterials = [];
	targetEvoPetEggId = 0;
	evolutionContext = null;
	requestPending = false;
}

PetEvolution.invalidatePet = function invalidatePet(gid) {
	if (evolutionContext?.petId === gid) onClose();
};

/**
 * Get item info (open description window)
 */
function onItemInfo(event) {
	event.stopImmediatePropagation();

	const ITID = parseInt(event.currentTarget.getAttribute('data-index'), 10);
	const item = DB.getItemInfo(ITID);

	if (!item) {
		return;
	}

	// Hack
	item.ITID = ITID;
	item.IsIdentified = 1;

	// Don't add the same UI twice, remove it
	if (ItemInfo.uid === item.ITID) {
		ItemInfo.remove();
		return;
	}

	// Add ui to window
	ItemInfo.append();
	ItemInfo.uid = item.ITID;
	ItemInfo.setItem(item);
}

/**
 * Handle the result of a pet evolution request
 * @param {PACKET.ZC.PET_EVOLUTION} pkt
 */
function onPetEvolveResult(pkt) {
	if (!Platform.isMobile && !requestPending) return;
	requestPending = false;
	const submit = PetEvolution.getRoot()?.querySelector('.evolve');
	if (submit) submit.disabled = false;
	if (Platform.isMobile) {
		if (pkt) receiveGamePetResult('evolve', pkt.result);
		return;
	}
	if (pkt) {
		switch (pkt.result) {
			case 0: // Unknown Error
				ChatBox.addText(DB.getMessage(2571), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
				break;
			case 1: // No pet can be summoned.
				ChatBox.addText(DB.getMessage(2572), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
				break;
			case 2: // It is not requested petal
				ChatBox.addText(DB.getMessage(2573), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
				break;
			case 3:
			case 4: // Lack of required materials for evolution
				ChatBox.addText(DB.getMessage(2575), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
				break;
			case 5: // Pet can only be evolved when intimacy is Loyal
				ChatBox.addText(DB.getMessage(2576), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
				break;
			case 6: // Success
				if (PetEvolution._host) {
					PetEvolution._host.style.display = 'none';
				}
				break;
			default:
				break;
		}
	}
}

/**
 * Packet Hooks to functions
 */
Network.hookPacket(PACKET.ZC.PET_EVOLUTION_RESULT, onPetEvolveResult);

/**
 * Create component and export it
 */
export default UIManager.addComponent(PetEvolution);
