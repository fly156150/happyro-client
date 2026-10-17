/**
 * UI/Mobile/auth/CharSelect.js
 *
 * Mobile character-select screen. Presentation-only: data logic lives in
 * Components/CharSelect/CharSelectCommon.js (shared with desktop).
 *
 * CharSelectCommon (V4 grid path) writes directly into these class names:
 *   .job .lvl .map .exp .hp .sp .str .agi .vit .int .dex .luk (via charinfo.querySelector)
 *   .ok (via style.display)
 *   #slot0…#slot14 .name (via slot canvas)
 * The class contract must be preserved exactly.
 */

import { createCharSelect } from 'UI/Components/CharSelect/CharSelectCommon.js';
import { createCharacterPreviewRenderer } from './CharacterPreview.js';
import { withMobileShell } from '../Shell.js';
import tokens from '../tokens.css?raw';
import shellCSS from '../Shell.css?raw';
import screenCSS from './CharSelect.css?raw';
import rawHTML from './CharSelect.html?raw';

const slots = Array.from(
	{ length: 15 },
	(_, i) => `
	<button class="char_canvas" id="slot${i}" type="button" aria-label="角色栏 ${i + 1}">
		<span class="character-preview"><canvas width="157" height="195"></canvas></span>
		<span class="name"></span>
		<span class="empty-placeholder" hidden aria-hidden="true"><span class="empty-plus">+</span><span>创建角色</span></span>
		<span class="timedelete slot${i} hidden"></span>
	</button>`
).join('');

const htmlText = rawHTML.replace('CHAR_SLOTS_PLACEHOLDER', slots);

const CharSelect = withMobileShell(
	createCharSelect({
		name: 'MobileCharSelect',
		htmlText,
		cssText: tokens + shellCSS + screenCSS,
		gridLayout: true,
		renderCharacterPreview: createCharacterPreviewRenderer(),
		deleteReservation: true,
		deletionEnabled: false,
		resetSelectionOnLogin: true,
		defaultMaxSlots: 15,
		activationEvent: 'click',
		bitmapSkin: false,
		onSlotChange(slot, { index, character }) {
			slot.dataset.empty = String(!character);
			slot.querySelector('.empty-placeholder').hidden = !!character;
			slot.setAttribute('aria-label', character?.name || `创建角色，角色栏 ${index + 1}`);
		},
		onSelectionChange(root, { index, character, maxSlots }) {
			root.querySelectorAll('.char_canvas').forEach((slot, i) => {
				slot.hidden = i >= maxSlots;
				slot.setAttribute('aria-pressed', String(i === index));
			});
			root.querySelector('.selection-label').textContent =
				character?.name || (index < maxSlots ? `角色栏 ${index + 1}` : '');
			// Engine controls .ok via style.display.
			// .make is not managed by the engine in grid mode, so we handle it here.
			root.querySelector('.make').hidden = !!character;
		},
	})
);

export default CharSelect;
