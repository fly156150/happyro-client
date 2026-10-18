import { expect, it, vi } from 'vitest';
vi.mock('Core/Context.js', () => ({ default: { isFullScreen: () => false, Is: { POPUP: false } } }));
import IntroPreferences from '../../src/UI/Components/Intro/Preferences.js';
import Graphics from '../../src/Preferences/Graphics.js';
import html from '../../src/UI/Components/Intro/Intro.html?raw';
import { settingsSnapshot, saveGameSettings } from '../../src/UI/Game/GameSettings.js';
vi.mock('Renderer/Renderer.js', () => ({ default: { resize: vi.fn() } }));
vi.mock('Audio/BGM.js', () => ({ default: { setVolume: vi.fn(), play: vi.fn(), stop: vi.fn() } }));
vi.mock('Audio/SoundManager.js', () => ({ default: { setVolume: vi.fn(), stop: vi.fn() } }));

it('keeps startup quality numeric so subsequent in-game settings remain valid', () => {
 document.body.innerHTML = html;
 document.querySelector('.quality').value = '75';
 document.querySelector('.screensize').value = '1024x768';
 IntroPreferences.save(document);
 expect(Graphics.quality).toBe(75);
 expect(JSON.parse(localStorage.getItem('Graphics')).quality).toBe(75);
 expect(saveGameSettings(settingsSnapshot())).toBe('设置已保存');
});
