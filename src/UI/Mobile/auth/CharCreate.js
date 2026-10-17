/**
 * UI/Mobile/auth/CharCreate.js
 *
 * Mobile character-creation screen. Presentation-only: data logic lives in
 * Components/CharCreate/CharCreateCommon.js (shared with desktop).
 *
 * CharCreateCommon writes to:
 *   .title              (applyRaceMessages — sets localized screen title)
 *   .human_title, .human_desc, .doram_title, .doram_desc
 *   .hair_style_title, .hair_color_title
 *   .hair-style div#<race>_<gender>  (show/hide per selection)
 *   #human, #doram, #style_model     (canvas contexts)
 */

import { createCharCreate } from 'UI/Components/CharCreate/CharCreateCommon.js';
import { loadAppearanceColors } from './AppearancePreviews.js';
import { createMobileInputEditor } from '../game/MobileInputEditor.js';
import { withMobileShell } from '../Shell.js';
import tokens from '../tokens.css?raw';
import shellCSS from '../Shell.css?raw';
import screenCSS from './CharCreate.css?raw';

const hairstyles = ['human', 'doram']
	.flatMap(race =>
		['male', 'female'].map(
			gender => `
	<div id="${race}_${gender}" class="hair-style">
		${Array.from(
			{ length: race === 'human' ? 23 : 6 },
			(_, i) => `
			<span class="styleCol style${i + 1}">
				<input type="radio" name="hstyle" id="${i + 1}_${race}_${gender}" class="hstyle" />
				<label for="${i + 1}_${race}_${gender}" class="hstyle_button" aria-label="发型 ${i + 1}"><span class="hair-preview" aria-hidden="true"><ui-image src="make_character_ver2/img_hairstyle${race === 'human' ? (gender === 'male' ? '' : '_girl') : (gender === 'male' ? '_doramboy' : '_doramgirl')}${String(i + 1).padStart(2, '0')}.bmp"></ui-image></span></label>
			</span>`
		).join('')}
	</div>`
		)
	)
	.join('');

const colors = Array.from(
	{ length: 9 },
	(_, i) => `
	<span class="colorCol cstyle0${i}">
		<input type="radio" name="hcolor" id="${i}_color" class="hcolor" />
		<label for="${i}_color" class="hcolor_button" aria-label="发色 ${i + 1}"><span class="color-swatch" data-color="${i}" aria-hidden="true"></span></label>
	</span>`
).join('');

const htmlText = `<div class="page">
	<header class="top-bar">
		<h1 class="screen-title title">创建角色</h1>
		<button class="return" type="button">返回</button>
	</header>

	<div class="create-layout">
	<div class="create-identity">
	<div class="name-field">
		<span class="field-label">角色名称</span>
		<input type="text" id="char_name" maxlength="24"
			autocomplete="off" autocorrect="off" spellcheck="false"
			enterkeyhint="done" placeholder="输入角色名" />
	</div>

	<div class="race-section">
		<p class="section-title">种族</p>
		<div class="races">
			<div>
				<input type="radio" name="race" id="human_race" checked class="race" />
				<label for="human_race" class="human_label">
					<strong class="human_title"></strong>
					<canvas id="human" width="65" height="130"></canvas>
					<span class="human_desc"></span>
				</label>
			</div>
			<div>
				<input type="radio" name="race" id="doram_race" class="race" />
				<label for="doram_race" class="doram_label">
					<strong class="doram_title"></strong>
					<canvas id="doram" width="65" height="130"></canvas>
					<span class="doram_desc"></span>
				</label>
			</div>
		</div>
	</div>

	</div>
	<div id="style" class="style-section">
		<div class="gender-row">
			<span id="male_container">
				<input type="radio" name="gender" id="male" checked />
				<label for="male" class="male_button">男</label>
			</span>
			<span id="female_container">
				<input type="radio" name="gender" id="female" />
				<label for="female" class="female_button">女</label>
			</span>
		</div>

		<div class="model-row">
			<button class="rot_left"  type="button" aria-label="向左旋转">◀</button>
			<canvas id="style_model" width="65" height="130"></canvas>
			<button class="rot_right" type="button" aria-label="向右旋转">▶</button>
		</div>

		<div class="appearance-options">
		<div>
			<p class="section-title hair_style_title">发型</p>
			${hairstyles}
		</div>

		<div>
			<p class="section-title hair_color_title">发色</p>
			<div class="color-row">${colors}</div>
		</div>
	</div>

	</div>
	</div>
	<button class="make" type="button">创建角色</button>
</div>`;

const CharCreate = withMobileShell(
	createCharCreate({
		name: 'MobileCharCreate',
		htmlText,
		cssText: tokens + shellCSS + screenCSS,
		hasRace: true,
		gridHairstyle: true,
		humanCanvasSelector: '#human',
		doramCanvasSelector: '#doram',
		modelCanvasSelector: '#style_model',
		nameInputSelector: '#char_name',
		nameInputEvent: 'click',
		cancelSelectors: ['.return'],
		draggable: false,
		autofocus: false,
		centered: false,
		activationEvent: 'click',
		nativeControls: true,
		bitmapSkin: false,
		onAppearanceChange(root, { race, gender, hair, color }) {
			loadAppearanceColors(root);
			root.querySelectorAll('.hstyle').forEach(input => {
				input.checked = input.id === `${hair}_${race}_${gender}`;
			});
			root.querySelectorAll('.hcolor').forEach(input => {
				input.checked = input.id === `${color}_color`;
			});
		},
	})
);

// Reuse the game editor only in landscape; portrait keeps native name entry.
const append = CharCreate.onAppend;
const remove = CharCreate.onRemove;
let disposeNameEditor;
CharCreate.onAppend = function () {
 append?.call(this);
 disposeNameEditor?.();
 disposeNameEditor = createMobileInputEditor(this._host, {
  enabled: () => window.innerWidth > window.innerHeight
 });
};
CharCreate.onRemove = function () {
 disposeNameEditor?.();
 disposeNameEditor = null;
 remove?.call(this);
};
export default CharCreate;
