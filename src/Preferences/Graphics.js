/**
 * Preferences/Graphics.js
 *
 * Graphics preferences
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
import Preferences from 'Core/Preferences.js';
import { getClientDefaults } from 'Core/ClientDefaults.js';

const defaultGraphicsSettings = {
	screensize: '1024x768',
	damageSkin: 0,
	damageMotion: 0,
	// Not exposed in settings until the shader supports it.
	fxaaSubpix: 0.25,
	...getClientDefaults('graphics')
};

/**
 * Export
 */
const cleanDefaults = JSON.parse(JSON.stringify(defaultGraphicsSettings));
const GraphicsSettings = Preferences.get('Graphics', defaultGraphicsSettings, 1.1);
GraphicsSettings.defaults = cleanDefaults;

export default GraphicsSettings;
