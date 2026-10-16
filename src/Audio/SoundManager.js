/** Shared, buffered short sound playback for desktop and mobile. */
import Client from 'Core/Client.js';
import CombatDiagnostics from 'Core/CombatDiagnostics.js';
import Preferences from 'Preferences/Audio.js';
import glMatrix from 'Utils/gl-matrix.js';
import Session from 'Engine/SessionStorage.js';
import BufferSoundPlayer from './BufferSoundPlayer.js';

async function loadAudio(filename) {
	const url = await new Promise((resolve, reject) => Client.loadFile(`data/wav/${filename}`, resolve, reject));
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15000);
	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) {
			throw new Error(`Sound HTTP ${response.status}`);
		}
		return await response.arrayBuffer();
	} finally {
		clearTimeout(timeout);
	}
}

const player = new BufferSoundPlayer({ load: loadAudio, diagnostics: CombatDiagnostics });
player.setVolume(Preferences.Sound.volume);

class SoundManager {
	static play(filename, volume = 1, priority = false) {
		if (Preferences.Sound.play && !document.hidden) {
			player.play(filename, volume, priority);
		}
	}

	static preload(filenames) {
		if (!Preferences.Sound.play) {
			return;
		}
		for (const filename of Array.isArray(filenames) ? filenames : [filenames]) {
			player.preload(filename);
		}
	}

	static playPosition(filename, position) {
		const dist = Math.floor(glMatrix.vec2.dist(position, Session.Entity.position));
		const volume = Math.max(1 - Math.abs(((dist - 1) * (1 - 0.01)) / (25 - 1) + 0.01), 0.1);
		this.play(filename, volume, position === Session.Entity.position);
	}

	static stop(filename) {
		player.stop(filename);
	}

	static setVolume(volume) {
		Preferences.Sound.volume = Math.max(0, Math.min(volume, 1));
		Preferences.save();
		player.setVolume(Preferences.Sound.play ? Preferences.Sound.volume : 0);
		if (Preferences.Sound.play && !document.hidden) player.activate();
	}
}

function activate() {
	if (Preferences.Sound.play && !document.hidden) {
		player.setVolume(Preferences.Sound.volume);
		player.activate();
	}
}

// Capture runs before controls consume the event, including inside shadow roots.
document.addEventListener('pointerup', activate, true);
document.addEventListener('keydown', activate, true);
document.addEventListener('visibilitychange', () => {
	if (document.hidden) {
		player.suspend();
	} else if (player.context) {
		activate();
	}
});
window.addEventListener('pagehide', () => player.suspend());
window.addEventListener('pageshow', () => {
	if (player.context) {
		activate();
	}
});

export default SoundManager;
