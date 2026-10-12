/**
 * Preferences/Camera.js
 *
 * Camera user preferences
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Preferences from 'Core/Preferences.js';
import Platform from 'UI/Platform.js';
import { menuDensity } from 'UI/Mobile/game/MenuLayout.js';

// Classify the landscape play area even when the launch page is still portrait.
const spacious =
	menuDensity(Math.max(window.innerWidth, window.innerHeight), Math.min(window.innerWidth, window.innerHeight)) ===
	'spacious';
// Two normal zoom-out steps (15 each) beyond the phone default.
export const DEFAULT_CAMERA_ZOOM = Platform.isMobile ? (spacious ? 140 : 110) : 125;

/** Apply the phone portrait framing without changing the saved zoom. */
export function viewportCameraZoom(zoom, step, maximum) {
	return Platform.isMobile && !spacious && Platform.orientation === 'portrait'
		? Math.min(zoom + 3 * step, maximum)
		: zoom;
}

/**
 * Export
 */
export default Preferences.get(
	'Camera',
	{
		smooth: true,
		zoom: DEFAULT_CAMERA_ZOOM,
		indoorZoom: DEFAULT_CAMERA_ZOOM
	},
	1.1
);
