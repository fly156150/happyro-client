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
import { getClientDefaults } from 'Core/ClientDefaults.js';
import Platform from 'UI/Platform.js';
import { menuDensity } from 'UI/Mobile/game/MenuLayout.js';

// Classify the landscape play area even when the launch page is still portrait.
const spacious =
	menuDensity(Math.max(window.innerWidth, window.innerHeight), Math.min(window.innerWidth, window.innerHeight)) ===
	'spacious';
const defaults = getClientDefaults('camera');
const landscapeZoom = spacious ? defaults.tabletLandscapeZoom : defaults.phoneLandscapeZoom;
const portraitZoom = spacious ? defaults.tabletPortraitZoom : defaults.phonePortraitZoom;
export const DEFAULT_CAMERA_ZOOM = Platform.isMobile ? landscapeZoom : defaults.desktopZoom;

/** Apply mobile portrait framing without changing the saved zoom. */
export function viewportCameraZoom(zoom, step, maximum) {
	return Platform.isMobile && Platform.orientation === 'portrait'
		? Math.min(zoom + ((portraitZoom - landscapeZoom) / 15) * step, maximum)
		: zoom;
}

/**
 * Export
 */
export default Preferences.get(
	'Camera',
	{
		smooth: defaults.smooth,
		zoom: DEFAULT_CAMERA_ZOOM,
		indoorZoom: DEFAULT_CAMERA_ZOOM
	},
	1.1
);
