/**
 * UI/Components/NpcMenu/NpcMenu.js
 *
 * Display npc menu
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import KEYS from 'Controls/KeyEventHandler.js';
import DB from 'DB/DBManager.js';
import Renderer from 'Renderer/Renderer.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import htmlText from './NpcMenu.html?raw';
import cssText from './NpcMenu.css?raw';
import InputBox from 'UI/Components/InputBox/InputBox.js';

/**
 * Create NPC Menu component
 */
const NpcMenu = new GUIComponent('NpcMenu', cssText);

NpcMenu.render = () => htmlText;

/**
 * Freeze mouse — NPC menu blocks interaction
 */
NpcMenu.mouseMode = GUIComponent.MouseMode.FREEZE;

/**
 * @var {number} index selected in menu
 */
let _index = 0;

/**
 * @var {number} NPC ID
 */
let _ownerID = 0;

/**
 * Helper: escape HTML
 */
function _escapeHTML(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Initialize component
 */
NpcMenu.init = function init() {
	const root = NpcMenu.getRoot();

	const okBtn = root.querySelector('.ok');
	if (okBtn) {
		okBtn.addEventListener('click', () => validate());
	}

	const cancelBtn = root.querySelector('.cancel');
	if (cancelBtn) {
		cancelBtn.addEventListener('click', () => cancel());
	}

	this._host.style.top = `${Math.max(376, Renderer.height / 2 + 76)}px`;
	this._host.style.left = `${Math.max(Renderer.width / 3, 20)}px`;

	this.draggable();

	const content = root.querySelector('.content');
	if (content) {
		content.addEventListener('mousedown', e => {
			const div = e.target.closest('div');
			if (div && content.contains(div)) {
				selectIndex(div);
			}
			e.stopImmediatePropagation();
		});

		content.addEventListener('dblclick', e => {
			const div = e.target.closest('div');
			if (div && content.contains(div)) {
				validate();
			}
		});
	}
};

/**
 * Clean up events
 */
NpcMenu.onRemove = function onRemove() {
	const root = NpcMenu.getRoot();
	const content = root.querySelector('.content');
	if (content) {
		content.innerHTML = '';
	}
};

/**
 * Bind KeyDown event
 */
NpcMenu.onKeyDown = function onKeyDown(event) {
	if (InputBox._host && InputBox._host.style.display !== 'none' && InputBox.__active) {
		return true;
	}

	if (this._host.style.display === 'none') {
		return true;
	}

	const root = NpcMenu.getRoot();
	const content = root.querySelector('.content');

	switch (event.which) {
		case KEYS.SPACE:
		case KEYS.ENTER:
			validate();
			break;

		case KEYS.ESCAPE:
			cancel();
			break;

		case KEYS.UP: {
			const divs = content.querySelectorAll('div[data-index]');
			_index = Math.max(_index - 1, 0);

			divs.forEach(d => d.classList.remove('selected'));
			if (divs[_index]) {
				divs[_index].classList.add('selected');
				divs[_index].scrollIntoView({ block: 'nearest' });
			}
			break;
		}

		case KEYS.DOWN: {
			const divs = content.querySelectorAll('div[data-index]');
			_index = Math.min(_index + 1, divs.length - 1);

			divs.forEach(d => d.classList.remove('selected'));
			if (divs[_index]) {
				divs[_index].classList.add('selected');
				divs[_index].scrollIntoView({ block: 'nearest' });
			}
			break;
		}

		default:
			return true;
	}

	event.stopImmediatePropagation();
	return false;
};

/**
 * Initialize menu
 *
 * @param {string} menu
 * @param {number} gid - npc id
 */
NpcMenu.setMenu = function setMenu(menu, gid) {
	const root = NpcMenu.getRoot();
	const content = root.querySelector('.content');
	const list = menu.split(':');

	_ownerID = gid;
	_index = 0;

	content.innerHTML = '';

	let j = 0;
	for (let i = 0, count = list.length; i < count; ++i) {
		if (list[i].length) {
			const div = document.createElement('div');
			div.innerHTML = DB.formatMsgToHtml(_escapeHTML(list[i]));
			div.dataset.index = j++;
			content.appendChild(div);
		}
	}

	const first = content.querySelector('div[data-index]');
	if (first) {
		first.classList.add('selected');
	}
};

/** Place NPC choices beside their visible dialogue after append restores drag position. */
NpcMenu.positionByDialogue = function positionByDialogue(dialogue) {
	if (!dialogue.__active || !dialogue._host?.isConnected || dialogue._host.style.display === 'none') return;
	const anchor = dialogue.getRoot().querySelector('#NpcBox').getBoundingClientRect();
	const menu = this.getRoot().querySelector('#NpcMenu').getBoundingClientRect();
	const gap = 8;
	let left = anchor.left;
	let top = anchor.bottom + gap;
	if (top + menu.height > Renderer.height) {
		top = anchor.top;
		left = anchor.right + gap;
		if (left + menu.width > Renderer.width) {
			left = anchor.left - menu.width - gap;
			if (left < 0) {
				left = anchor.left;
				top = anchor.top - menu.height - gap;
			}
		}
	}
	this._host.style.left = `${Math.max(0, Math.min(left, Renderer.width - menu.width))}px`;
	this._host.style.top = `${Math.max(0, Math.min(top, Renderer.height - menu.height))}px`;
};

/**
 * Submit an index
 */
function validate() {
	NpcMenu.onSelectMenu(_ownerID, _index + 1);
}

/**
 * Pressed cancel, client send "255" as value
 */
function cancel() {
	NpcMenu.onSelectMenu(_ownerID, 255);
}

/**
 * Select an index, change background color
 */
function selectIndex(div) {
	const root = NpcMenu.getRoot();
	const content = root.querySelector('.content');
	const divs = content.querySelectorAll('div[data-index]');
	divs.forEach(d => d.classList.remove('selected'));
	div.classList.add('selected');

	_index = parseInt(div.dataset.index, 10);
}

/**
 * Abstract callback to define
 */
NpcMenu.onSelectMenu = function onSelectMenu(/* gid, index */) {};

/**
 * Create component and export it
 */
export default UIManager.addComponent(NpcMenu);
