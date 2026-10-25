/**
 * UI/Components/NpcBox/NpcBox.js
 *
 * NPC Box windows
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import { formatNPCMarkup as processText } from 'Utils/RagnarokText.js';
import { ensureReadableText } from 'Utils/ReadableText.js';
import KEYS from 'Controls/KeyEventHandler.js';
import Renderer from 'Renderer/Renderer.js';
import UIManager from 'UI/UIManager.js';
import { hasHigherFocusedWindow } from 'UI/Game/DialogueKeyboardFocus.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import ItemInfo from 'UI/Components/ItemInfo/ItemInfo.js';
import { prepareNpcNaviLinks, handleNpcNaviClick } from 'UI/Game/NpcNaviLinks.js';
import htmlText from './NpcBox.html?raw';
import cssText from './NpcBox.css?raw';
import NpcMenu from 'UI/Components/NpcMenu/NpcMenu.js';
import InputBox from 'UI/Components/InputBox/InputBox.js';

/**
 * Create NpcBox component
 */
const NpcBox = new GUIComponent('NpcBox', cssText);

NpcBox.render = () => htmlText;

/**
 * Freeze mouse — NPC dialog blocks interaction
 */
NpcBox.mouseMode = GUIComponent.MouseMode.FREEZE;

/**
 * @var {boolean} does the box need to be clean up?
 */
let _needCleanUp = false;

/**
 * @var {integer} NPC GID
 */
NpcBox.ownerID = 0;

/**
 * Initialize Component
 */
NpcBox.init = function init() {
	this._host.style.top = `${Math.max(100, Renderer.height / 2 - 200)}px`;
	this._host.style.left = `${Math.max(Renderer.width / 3, 20)}px`;

	const root = NpcBox.getRoot();

	const nextBtn = root.querySelector('.next');
	if (nextBtn) {
		nextBtn.addEventListener('click', () => NpcBox.next());
	}

	const closeBtn = root.querySelector('.close');
	if (closeBtn) {
		closeBtn.addEventListener('click', () => NpcBox.close());
	}

	const content = root.querySelector('.content');
	if (content) {
		content.addEventListener('mousedown', e => e.stopImmediatePropagation());
	}

	// Event delegation for item links inside shadow DOM
	root.addEventListener('click', e => {
		const itemLink = e.target.closest('.item-link');
		if (itemLink) {
			const itemId = parseInt(itemLink.dataset.itemId, 10);
			if (!itemId) {
				return;
			}
			if (ItemInfo.uid === itemId) {
				ItemInfo.remove();
				return;
			}
			ItemInfo.append();
			ItemInfo.uid = itemId;
			ItemInfo.setItem({ ITID: itemId, IsIdentified: true });
			return;
		}
		handleNpcNaviClick(e);
	});
	root.addEventListener('keydown', handleNpcNaviClick);

	this.draggable();
};

/**
 * Once NPC Box is removed from HTML, clean up data
 */
NpcBox.onRemove = function onRemove() {
	const root = NpcBox.getRoot();

	const nextBtn = root.querySelector('.next');
	if (nextBtn) {
		nextBtn.classList.remove('is-visible');
		nextBtn.style.display = '';
	}

	const closeBtn = root.querySelector('.close');
	if (closeBtn) {
		closeBtn.classList.remove('is-visible');
		closeBtn.style.display = '';
	}

	const content = root.querySelector('.content');
	if (content) {
		content.textContent = '';
	}

	_needCleanUp = false;
	NpcBox.ownerID = 0;

	const cutin = document.getElementById('cutin');
	if (cutin) {
		document.body.removeChild(cutin);
	}
};

function _isVisible(el) {
	return !!el && getComputedStyle(el).display !== 'none';
}

/**
 * Add support for Enter key
 */
NpcBox.onKeyDown = function onKeyDown(event) {
	if (hasHigherFocusedWindow(this, UIManager.components)) return true;
	if (NpcMenu._host && NpcMenu._host.style.display !== 'none' && NpcMenu.__active) {
		return true;
	}

	if (InputBox._host && InputBox._host.style.display !== 'none' && InputBox.__active) {
		return true;
	}

	if (this._host.style.display === 'none') {
		return true;
	}

	const root = NpcBox.getRoot();

	switch (event.which) {
		case KEYS.SPACE:
		case KEYS.ENTER: {
			const nextBtn = root.querySelector('.next');
			if (_isVisible(nextBtn)) {
				this.next();
				break;
			}
			const closeBtn = root.querySelector('.close');
			if (_isVisible(closeBtn)) {
				this.close();
				break;
			}
			return true;
		}

		case KEYS.ESCAPE: {
			const closeBtn = root.querySelector('.close');
			if (_isVisible(closeBtn)) {
				this.close();
				break;
			}
			return true;
		}

		default:
			return true;
	}

	event.stopImmediatePropagation();
	return false;
};

/**
 * Add text to box
 *
 * @param {string} text to display
 * @param {number} gid - npc id
 */
NpcBox.setText = function setText(text, gid) {
	const root = NpcBox.getRoot();
	const content = root.querySelector('.content');
	NpcBox.ownerID = gid;

	if (_needCleanUp) {
		_needCleanUp = false;
		content.textContent = '';
	}

	const div = document.createElement('div');
	div.innerHTML = processText(text);
	content.appendChild(div);
	ensureReadableText(div);
	prepareNpcNaviLinks(div);
};

/**
 * Add next button
 *
 * @param {number} gid - npc id
 */
NpcBox.addNext = function addNext(gid) {
	NpcBox.ownerID = gid;
	const root = NpcBox.getRoot();
	const nextBtn = root.querySelector('.next');
	const closeBtn = root.querySelector('.close');
	if (closeBtn) {
		closeBtn.classList.remove('is-visible');
		closeBtn.style.display = '';
	}
	if (nextBtn) {
		nextBtn.classList.add('is-visible');
		nextBtn.style.display = '';
	}
};

/**
 * Add close button
 *
 * @param {number} gid - npc id
 */
NpcBox.addClose = function addClose(gid) {
	NpcBox.ownerID = gid;
	const root = NpcBox.getRoot();
	const closeBtn = root.querySelector('.close');
	const nextBtn = root.querySelector('.next');
	if (nextBtn) {
		nextBtn.classList.remove('is-visible');
		nextBtn.style.display = '';
	}
	if (closeBtn) {
		closeBtn.classList.add('is-visible');
		closeBtn.style.display = '';
	}
};

/**
 * Press "next" button
 */
NpcBox.next = function next() {
	_needCleanUp = true;
	const root = NpcBox.getRoot();
	const nextBtn = root.querySelector('.next');
	if (nextBtn) {
		nextBtn.classList.remove('is-visible');
		nextBtn.style.display = '';
	}
	this.onNextPressed(NpcBox.ownerID);
};

/**
 * Press "close" button
 */
NpcBox.close = function close() {
	_needCleanUp = true;
	const root = NpcBox.getRoot();
	const closeBtn = root.querySelector('.close');
	if (closeBtn) {
		closeBtn.classList.remove('is-visible');
		closeBtn.style.display = '';
	}
	this.onClosePressed(NpcBox.ownerID);
};

/**
 * Callback
 */
NpcBox.onClosePressed = function onClosePressed() {};
NpcBox.onNextPressed = function onNextPressed() {};

/**
 * Create component based on view file and export it
 */
export default UIManager.addComponent(NpcBox);
