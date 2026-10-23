/**
 * Preferences/Audio.js
 *
 * Audio preferences
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Preferences from 'Core/Preferences.js';
import { getClientDefaults } from 'Core/ClientDefaults.js';

/**
 * Export
 */
export default Preferences.get(
	'Audio',
	getClientDefaults('audio'),
	1.0
);
