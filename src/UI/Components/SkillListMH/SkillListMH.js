/**
 * UI/Components/SkillListMH/SkillListMH.js
 *
 * Character Skill Window for Mercenary and Homunculus
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import KEYS from 'Controls/KeyEventHandler.js';
import { createSkillList } from '../SkillList/SkillListCommon.js';
import htmlText from '../SkillList/SkillList/SkillList.html?raw';
import cssText from '../SkillList/SkillList/SkillList.css?raw';

/**
 * Build a Homunculus/Mercenary skill window on top of the shared SkillList
 * factory, using its list-only (old-style) mode and layering the MH-specific
 * bits (window name, titlebar text, drag origin, Escape-to-close) on top.
 */
function createSkillListMH(type) {
	const name = `SkillList${type === 'homunculus' ? 'HOM' : 'MER'}`;

	const component = createSkillList({
		name,
		htmlText,
		cssText,
		listOnly: true,
		dragFrom: 'SkillListMH',
		titlebarText: type === 'homunculus' ? '生命体技能' : '佣兵技能',
		containerSelector: '.SkillList',
		preferenceDefaults: {
			x: 100,
			y: 200,
			width: 8,
			height: 5,
			show: false
		}
	});

	component.onKeyDown = function onKeyDown(event) {
		if ((event.which === KEYS.ESCAPE || event.key === 'Escape') && this.ui.is(':visible')) {
			this.toggle();
		}
	};

	return component;
}

export default {
	homunculus: createSkillListMH('homunculus'),
	mercenary: createSkillListMH('mercenary')
};
