/**
 * UI/Components/HomunInformations/HomunInformations.js
 *
 * Display homunculus informations
 *
 * @author IssID
 */

import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Preferences from 'Core/Preferences.js';
import Renderer from 'Renderer/Renderer.js';
import EntityManager from 'Renderer/EntityManager.js';
import KEYS from 'Controls/KeyEventHandler.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import SkillListMH from 'UI/Components/SkillListMH/SkillListMH.js';
import Session from 'Engine/SessionStorage.js';
import AIDriver from 'Core/AIDriver.js';
import Configs from 'Core/Configs.js';
import PACKETVER from 'Network/PacketVerManager.js';
import 'UI/Elements/Elements.js';
import htmlText from './HomunInformations.html?raw';
import cssText from './HomunInformations.css?raw';

let autoFeedInterval;
const autoFeedIntervalMs = 1000 * 60 * 1; // feed every 1 minutes when auto feed is enabled
const autoFeedPercent = 30;

/**
 * Create Component
 */
const HomunInformations = new GUIComponent('HomunInformations', cssText);

HomunInformations.render = () => htmlText;

HomunInformations.captureKeyEvents = true;
HomunInformations.renamePending = false;
HomunInformations.renameAllowed = true;

HomunInformations.setRenamePending = function setRenamePending(pending) {
	this.renamePending = pending;
	const disabled = pending || !this.renameAllowed;
	for (const selector of ['.name', '.modify']) {
		const control = this.getRoot()?.querySelector(selector);
		if (control) {
			control.classList.toggle('disabled', disabled);
			control.disabled = disabled;
		}
	}
};

/**
 * @var {Preferences} Window preferences (localStorage)
 */
const _preferences = Preferences.get(
	'HomunInformations',
	{
		x: 100,
		y: 200,
		show: false,
		autoFeed: 0
	},
	1.0
);

HomunInformations.base_exp = 0;
HomunInformations.base_exp_next = 1;

/**
 * Initialize component
 */
HomunInformations.init = function init() {
	const root = HomunInformations.getRoot();

	this.draggable('.content');

	const baseEl = root.querySelector('.base');
	if (baseEl) {
		baseEl.addEventListener('mousedown', e => {
			e.stopImmediatePropagation();
		});
	}

	const closeBtn = root.querySelector('.close');
	if (closeBtn) {
		closeBtn.addEventListener('click', () => {
			this._host.style.display = 'none';
			SkillListMH.homunculus.ui.hide();
		});
	}

	const modifyBtn = root.querySelector('.modify');
	if (modifyBtn) {
		modifyBtn.addEventListener('click', () => {
			const input = root.querySelector('.name');
			if (input) {
				HomunInformations.reqNameEdit(input.value);
			}
		});
	}

	const feedBtn = root.querySelector('.feed');
	if (feedBtn) {
		feedBtn.addEventListener('click', () => {
			HomunInformations.reqHomunFeed();
		});
	}

	const delBtn = root.querySelector('.del');
	if (delBtn) {
		delBtn.addEventListener('click', () => {
			HomunInformations.reqDeleteHomun();
		});
	}

	const autoFeedBtn = root.querySelector('.homun_auto_feed');
	if (autoFeedBtn) {
		autoFeedBtn.addEventListener('click', () => {
			homunToggleAutoFeed();
		});
	}

	if (!_preferences.show) {
		this._host.style.display = 'none';
	}

	const skillBtn = root.querySelector('.skill');
	if (skillBtn) {
		skillBtn.addEventListener('click', () => {
			SkillListMH.homunculus.toggle();
		});
	}

};

HomunInformations.onAppend = function onAppend() {
	const root = HomunInformations.getRoot();

	Client.loadFile(DB.INTERFACE_PATH + `checkbox_${_preferences.autoFeed ? '1' : '0'}.bmp`, data => {
		const el = root.querySelector('.homun_auto_feed');
		if (el) {
			el.style.backgroundImage = `url(${data})`;
		}
	});

	if (PACKETVER.value < 20170920) {
		if (Configs.get('enableHomunAutoFeed', false)) {
			HomunInformations.startAutoFeed();
		} else {
			const feeding = root.querySelector('.feeding');
			if (feeding) {
				feeding.style.display = 'none';
			}
		}
	}

	this._host.style.top = `${Math.min(Math.max(0, _preferences.y), Renderer.height - this._host.getBoundingClientRect().height)}px`;
	this._host.style.left = `${Math.min(Math.max(0, _preferences.x), Renderer.width - this._host.getBoundingClientRect().width)}px`;
};

// feed homunculus every 1 minutes when enableHomunAutoFeed is enabled
HomunInformations.startAutoFeed = function startAutoFeed() {
	window.clearInterval(autoFeedInterval);
	autoFeedInterval = window.setInterval(
		autoFeedCheck,
		Number(Configs.get('homunAutoFeedTimeMs')) || autoFeedIntervalMs
	);
	autoFeedCheck();
};

HomunInformations.stopAutoFeed = function stopAutoFeed() {
	window.clearInterval(autoFeedInterval);
};

/**
 * Checks if homun should be fed or not
 */
function autoFeedCheck() {
	if (_preferences.autoFeed != 1) {
		return;
	}

	const player = Session.Entity;
	if (!player) {
		return;
	}
	if (player.life.hp <= 0) {
		return;
	}

	if (!Session.homunId) {
		return;
	}
	const entity = EntityManager.get(Session.homunId);
	if (!entity) {
		return;
	}
	if (entity.life.hp <= 0) {
		return;
	}
	if (entity.life.hunger > Number(Configs.get('homunAutoFeedPercent', autoFeedPercent))) {
		return;
	}
	HomunInformations.sendHomunFeed();
}

/**
 * Once remove from body, save user preferences
 */
HomunInformations.onRemove = function onRemove() {
	this.setRenamePending(false);
	_preferences.show = this._host.style.display !== 'none';
	_preferences.y = parseInt(this._host.style.top, 10);
	_preferences.x = parseInt(this._host.style.left, 10);
	_preferences.save();
	HomunInformations.stopAutoFeed();
	this.stopAI();
};

/**
 * Process shortcut
 *
 * @param {object} key
 */
HomunInformations.onShortCut = function onShortCut(key) {
	switch (key.cmd) {
		case 'TOGGLE':
			if (!this._host) return;
			if (Session.homunId && EntityManager.get(Session.homunId)) {
				if (this._host.style.display === 'none') {
					this._host.style.display = '';
					this.focus();
				} else {
					this._host.style.display = 'none';
					SkillListMH.homunculus.ui.hide();
				}
			} else {
				SkillListMH.homunculus.ui.hide();
				this._host.style.display = 'none';
			}
			break;
		case 'AGGRESSIVE':
			this.toggleAggressive();
			break;
	}
};

/**
 * Handle keyboard events inside shadow DOM
 * Protects input fields from being consumed by global handlers
 */
HomunInformations.onKeyDown = function onKeyDown(event) {
	const focused = this.getRoot().activeElement;

	if (this.isEditableFocused()) {
		if (event.which === KEYS.ESCAPE || event.key === 'Escape') {
			focused.blur();
			event.stopImmediatePropagation();
			return false;
		}
		if (event.which === KEYS.ENTER) {
			if (focused.classList.contains('name')) {
				HomunInformations.reqNameEdit(focused.value);
			}
			event.stopImmediatePropagation();
			return false;
		}
		event.stopImmediatePropagation();
		return true;
	}

	if ((event.which === KEYS.ESCAPE || event.key === 'Escape') && this._host.style.display !== 'none') {
		this._host.style.display = 'none';
	}

	return true;
};

/**
 * Update UI
 *
 * @param {object} homunculus info
 */
HomunInformations.setInformations = function setInformations(info) {
	const root = HomunInformations.getRoot();

	if (!this.__loaded) {
		this.append();
		this._host.style.display = 'none';
	}

	if (info.szName) {
		const nameInput = root.querySelector('.name');
		if (nameInput) {
			nameInput.value = info.szName;
		}
	}
	if (info.nLevel !== undefined) {
		const levelEl = root.querySelector('.level');
		if (levelEl) {
			levelEl.textContent = info.nLevel;
		}
	}

	if (info.atk !== undefined) {
		const el = root.querySelector('.stats .atk');
		if (el) {
			el.textContent = info.atk;
		}
	}
	if (info.Matk !== undefined) {
		const el = root.querySelector('.stats .Matk');
		if (el) {
			el.textContent = info.Matk;
		}
	}
	if (info.hit !== undefined) {
		const el = root.querySelector('.stats .hit');
		if (el) {
			el.textContent = info.hit;
		}
	}
	if (info.critical !== undefined) {
		const el = root.querySelector('.stats .critical');
		if (el) {
			el.textContent = info.critical;
		}
	}
	if (info.def !== undefined) {
		const el = root.querySelector('.stats .def');
		if (el) {
			el.textContent = info.def;
		}
	}
	if (info.Mdef !== undefined) {
		const el = root.querySelector('.stats .Mdef');
		if (el) {
			el.textContent = info.Mdef;
		}
	}
	if (info.flee !== undefined) {
		const el = root.querySelector('.stats .flee');
		if (el) {
			el.textContent = info.flee;
		}
	}
	if (info.aspd !== undefined) {
		const el = root.querySelector('.stats .aspd');
		if (el) {
			el.textContent = Math.floor(200 - info.aspd / 10);
		}
	}

	if (info.hp !== undefined && info.maxHP !== undefined) {
		this.setHpSpBar('hp', info.hp, info.maxHP);
	}
	if (info.sp !== undefined && info.maxSP !== undefined) {
		this.setHpSpBar('sp', info.sp, info.maxSP);
	}

	if (info.exp !== undefined && info.maxEXP !== undefined) {
		HomunInformations.base_exp = info.exp;
		HomunInformations.base_exp_next = info.maxEXP;
		this.setExp(info.exp, info.maxEXP);
	}

	if (info.nFullness !== undefined) {
		this.setHunger(info.nFullness);
	}
	if (info.nRelationship !== undefined) {
		this.setIntimacy(info.nRelationship);
	}

	if (info.bModified !== undefined) {
		this.renameAllowed = !(info.bModified & 1);
		this.setRenamePending(false);
	}

	if (info.SKPoint !== undefined) {
		SkillListMH.homunculus.setPoints(info.SKPoint);
	}
};

/**
 * Set hp and sp bar
 */
HomunInformations.setHpSpBar = function setHpSpBar(type, val, val2) {
	const root = HomunInformations.getRoot();
	const perc = Math.floor((val * 100) / val2);
	const color = perc < 25 ? 'red' : 'blue';

	const valueEl = root.querySelector(`.${type}_value`);
	if (valueEl) {
		valueEl.textContent = val;
	}

	const maxValueEl = root.querySelector(`.${type}_max_value`);
	if (maxValueEl) {
		maxValueEl.textContent = val2;
	}

	const percEl = root.querySelector(`.${type}_perc`);
	if (percEl) {
		percEl.textContent = `${perc}%`;
	}

	if (perc <= 0) {
		root.querySelectorAll(`.${type}_bar div`).forEach(el => {
			el.style.backgroundImage = 'none';
		});
	}

	Client.loadFile(DB.INTERFACE_PATH + `basic_interface/gze${color}_left.bmp`, function (url) {
		const el = root.querySelector(`.${type}_bar_left`);
		if (el) {
			el.style.backgroundImage = `url(${url})`;
		}
	});

	Client.loadFile(DB.INTERFACE_PATH + `basic_interface/gze${color}_mid.bmp`, function (url) {
		const el = root.querySelector(`.${type}_bar_middle`);
		if (el) {
			Object.assign(el.style, {
				backgroundImage: `url(${url})`,
				width: `${Math.floor(Math.min(perc, 100) * 0.75)}px`
			});
		}
	});

	Client.loadFile(DB.INTERFACE_PATH + `basic_interface/gze${color}_right.bmp`, function (url) {
		const el = root.querySelector(`.${type}_bar_right`);
		if (el) {
			Object.assign(el.style, {
				backgroundImage: `url(${url})`,
				left: `${Math.floor(Math.min(perc, 100) * 1.27)}px`
			});
		}
	});

	const summaryEl = root.querySelector(`.${type}2`);
	if (summaryEl) {
		summaryEl.textContent = `${val}/${val2}`;
	}
};

/**
 * Set intimacy
 *
 * @param {number} intimacy
 */
HomunInformations.setIntimacy = function setIntimacy(val) {
	const root = HomunInformations.getRoot();
	const el = root.querySelector('.intimacy');
	if (el) {
		el.textContent = DB.getMessage(val < 100 ? 672 : val < 250 ? 673 : val < 600 ? 669 : val < 900 ? 674 : 675);
	}
};

/**
 * Set exp value
 */
HomunInformations.setExp = function setExp(exp, maxEXP) {
	const root = HomunInformations.getRoot();
	if (!root) {
		return;
	}

	const canvas = root.querySelector('.block2 canvas.life.title_exp');
	if (!canvas) {
		return;
	}
	const ctx = canvas.getContext('2d');

	const width = 60,
		height = 5;
	const exp_per = exp / maxEXP;

	ctx.fillStyle = '#424242';
	ctx.fillRect(1, 1, width - 2, height - 2);

	ctx.fillStyle = '#205cc3';
	ctx.fillRect(1, 1, Math.round((width - 2) * exp_per), 3);

	const expEl = root.querySelector('.exp');
	if (expEl) {
		expEl.textContent = `${exp}/${maxEXP}`;
	}
};

/**
 * Set hunger value
 *
 * @param {number} hunger
 */
HomunInformations.setHunger = function setHunger(val) {
	const root = HomunInformations.getRoot();
	if (!root) {
		return;
	}

	const canvas = root.querySelector('.block2 canvas.life.title_hunger');
	if (!canvas) {
		return;
	}
	const ctx = canvas.getContext('2d');

	const width = 60,
		height = 5;
	const hunger_per = val / 100;

	ctx.fillStyle = '#424242';
	ctx.fillRect(1, 1, width - 2, height - 2);

	ctx.fillStyle = hunger_per < 0.25 ? '#ff1e00' : '#205cc3';
	ctx.fillRect(1, 1, Math.round((width - 2) * hunger_per), 3);

	const hungerEl = root.querySelector('.hunger');
	if (hungerEl) {
		hungerEl.textContent = `${val}/100`;
	}
};

HomunInformations.toggleAggressive = function toggleAggressive() {
	AIDriver.HOM_AGGRESSIVE = !AIDriver.HOM_AGGRESSIVE;
	localStorage.setItem('HOM_AGGRESSIVE', AIDriver.HOM_AGGRESSIVE ? '1' : '0');
};

HomunInformations.startAI = function startAI() {
	if (!this.AILoop) {
		AIDriver.reset(true);
		this.AILoop = setInterval(() => {
			if (Session.homunId) {
				const entity = EntityManager.get(Session.homunId);
				if (entity) {
					AIDriver.exec(`AI(${Session.homunId})`);
				}
			}
		}, 100);
	}
};

HomunInformations.stopAI = function stopAI() {
	if (this.AILoop) {
		this.AILoop = clearInterval(this.AILoop);
	}
};

HomunInformations.resetAI = function resetAI() {
	this.stopAI();
	this.startAI();
};

HomunInformations.setFeedConfig = function setFeedConfig(flag) {
	_preferences.autoFeed = flag;
	_preferences.save();
	const root = HomunInformations.getRoot();
	if (root) {
		Client.loadFile(DB.INTERFACE_PATH + `checkbox_${_preferences.autoFeed ? '1' : '0'}.bmp`, data => {
			const el = root.querySelector('.homun_auto_feed');
			if (el) {
				el.style.backgroundImage = `url(${data})`;
			}
		});
	}
	autoFeedCheck();
};

/**
 * Toggle AutoFeed
 */
function homunToggleAutoFeed() {
	HomunInformations.setFeedConfig(_preferences.autoFeed == 1 ? 0 : 1);
	if (PACKETVER.value < 20170920) {
		return;
	}
	HomunInformations.onConfigUpdate(3, _preferences.autoFeed ? 1 : 0);
}

/**
 * Functions defined in Engine/MapEngine/Homun.js
 */
HomunInformations.reqHomunFeed = function reqHomunFeed() {};
HomunInformations.reqNameEdit = function reqNameEdit() {};
HomunInformations.reqAttack = function reqAttack() {};
HomunInformations.reqMoveTo = function reqMoveTo() {};
HomunInformations.reqMoveToOwner = function reqMoveToOwner() {};

HomunInformations.reqHomunAction = function reqHomunAction() {};
HomunInformations.onConfigUpdate = function onConfigUpdate(/* type, value*/) {};

/**
 * Create component and export it
 */
export default UIManager.addComponent(HomunInformations);
