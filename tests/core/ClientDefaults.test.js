import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import schema from '../../src/Core/ClientDefaults.schema.json';
const platform = vi.hoisted(() => ({ isMobile: true, orientation: 'portrait' }));
vi.mock('UI/Platform.js', () => ({ default: platform }));
vi.mock('Renderer/Renderer.js', () => ({ default: { resize: vi.fn() } }));
vi.mock('Audio/BGM.js', () => ({ default: { setVolume: vi.fn(), stop: vi.fn(), play: vi.fn() } }));
vi.mock('Audio/SoundManager.js', () => ({ default: { setVolume: vi.fn(), stop: vi.fn() } }));
let Configs;
beforeEach(async () => {
	vi.resetModules(); localStorage.clear(); platform.isMobile = true; platform.orientation = 'portrait';
	vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 844);
	Configs = (await import('../../src/Core/Configs.js')).default;
});
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
const configure = value => Configs.set('clientDefaults', value);
it('uses the schema for every default and returns independent category lists', async () => {
	const { getClientDefaults } = await import('../../src/Core/ClientDefaults.js');
	for (const field of Object.values(schema.fields)) {
		const [section, ...keys] = field.path.split('.');
		expect(keys.reduce((value, key) => value[key], getClientDefaults(section))).toEqual(field.default);
	}
	getClientDefaults('pickup').categories.length = 0;
	expect(getClientDefaults('pickup').categories).toHaveLength(4);
});
it('applies environment defaults without losing explicit false or zero values', async () => {
	configure({ camera: { phoneLandscapeZoom: 105, phonePortraitZoom: 160, smooth: false }, audio: { BGM: { play: false, volume: 0 } }, map: { effect: false }, interface: { toastDuration: 4 } });
	const camera = await import('../../src/Preferences/Camera.js');
	expect(camera.default).toMatchObject({ zoom: 105, indoorZoom: 105, smooth: false });
	expect(camera.viewportCameraZoom(camera.default.zoom, 15, 325)).toBe(160);
	platform.orientation = 'landscape'; expect(camera.viewportCameraZoom(camera.default.zoom, 15, 325)).toBe(105);
	expect((await import('../../src/Preferences/Audio.js')).default.BGM).toEqual({ play: false, volume: 0 });
	expect((await import('../../src/Preferences/Map.js')).default.effect).toBe(false);
	expect((await import('../../src/Preferences/Interface.js')).default.toastDuration).toBe(4);
});
it('uses separate tablet and desktop camera defaults and stable rotation offsets', async () => {
	configure({ camera: { tabletLandscapeZoom: 135, tabletPortraitZoom: 175, desktopZoom: 145 } });
	vi.stubGlobal('innerWidth', 768); vi.stubGlobal('innerHeight', 1024);
	const camera = await import('../../src/Preferences/Camera.js');
	expect(camera.DEFAULT_CAMERA_ZOOM).toBe(135);
	for (const orientation of ['portrait', 'landscape', 'portrait']) {
		platform.orientation = orientation;
		expect(camera.viewportCameraZoom(135, 15, 325)).toBe(orientation === 'portrait' ? 175 : 135);
	}
	platform.isMobile = false; vi.resetModules();
	const configs = (await import('../../src/Core/Configs.js')).default;
	configs.set('clientDefaults', { camera: { desktopZoom: 145 } });
	expect((await import('../../src/Preferences/Camera.js')).DEFAULT_CAMERA_ZOOM).toBe(145);
});
it('preserves saved personal settings and resets to deployment defaults', async () => {
	configure({ camera: { phoneLandscapeZoom: 105, phonePortraitZoom: 160 }, graphics: { quality: 70, fpslimit: 30 }, audio: { BGM: { volume: 0.2 }, Sound: { play: false } }, interface: { toastDuration: 3 } });
	localStorage.setItem('Camera', JSON.stringify({ _version: 1.1, zoom: 120 }));
	localStorage.setItem('Graphics', JSON.stringify({ _version: 1.1, quality: 90 }));
	localStorage.setItem('Audio', JSON.stringify({ _version: 1, BGM: { play: true, volume: 0.8 }, Sound: { play: true, volume: 0.7 } }));
	localStorage.setItem('Interface', JSON.stringify({ _version: 1, toastDuration: 8 }));
	const camera = await import('../../src/Preferences/Camera.js');
	expect(camera.default.zoom).toBe(120); expect(camera.DEFAULT_CAMERA_ZOOM).toBe(105);
	expect(camera.viewportCameraZoom(camera.default.zoom, 15, 325)).toBe(175);
	const { settingsSnapshot, saveGameSettings } = await import('../../src/UI/Game/GameSettings.js');
	expect(settingsSnapshot()).toMatchObject({ graphics: { quality: 90, fpslimit: 30 }, audio: { BGM: { volume: 0.8 } }, interface: { toastDuration: 8 } });
	const reset = settingsSnapshot(true);
	expect(reset).toMatchObject({ graphics: { quality: 70 }, audio: { BGM: { volume: 0.2 }, Sound: { play: false } }, interface: { toastDuration: 3 } });
	expect(saveGameSettings(reset)).toBe('设置已保存');
	expect(settingsSnapshot()).toMatchObject(reset);
});
it('applies combat and pickup defaults while retaining character preferences', async () => {
	configure({ autoCombat: { ranges: { search: 25, activity: 40 }, teleport: { enabled: false, waitSeconds: 4, intervalSeconds: 8 } }, pickup: { enabled: true, range: 9, batchSeconds: 7, categories: ['card'] } });
	const { createAutoCombatController } = await import('../../src/UI/Game/AutoCombatController.js');
	expect(createAutoCombatController({}).snapshot()).toMatchObject({ active: false, ranges: { search: 25, activity: 40 }, teleport: { enabled: false, waitSeconds: 4, intervalSeconds: 8 } });
	const { loadAutoCombatSettings } = await import('../../src/UI/Game/AutoCombatSettings.js');
	const saved = { species: [], skills: [], ranges: { search: 10, activity: 20 }, teleport: { enabled: true, waitSeconds: 6, intervalSeconds: 9 } };
	localStorage.setItem('combat-test', JSON.stringify(saved));
	expect(createAutoCombatController({}, loadAutoCombatSettings('combat-test')).snapshot()).toMatchObject(saved);
	const pickup = await import('../../src/UI/Game/PickupSettings.js');
	expect(pickup.loadPickupSettings()).toEqual({ enabled: true, range: 9, batchSeconds: 7, categories: ['card'], excluded: [] });
	const personal = { enabled: false, range: 3, batchSeconds: 10, categories: ['equipment'], excluded: [{ id: 501, name: '红色药水' }] };
	expect(pickup.savePickupSettings(personal)).toBe(true); expect(pickup.loadPickupSettings()).toEqual(personal);
	expect(pickup.pickupDefaults()).toMatchObject({ enabled: true, range: 9, categories: ['card'] });
});

it('loads recovery deployment defaults without changing saved character choices', async () => {
 configure({autoRecovery:{hp:{trigger:80,target:100},sp:{trigger:50,target:90}}});
 const {defaultRecoverySettings}=await import('../../src/UI/Game/RecoverySettings.js');
 expect(defaultRecoverySettings()).toEqual({hp:{enabled:false,trigger:80,target:100,items:[]},sp:{enabled:false,trigger:50,target:90,items:[]}});
 const {loadAutoCombatSettings,saveAutoCombatSettings}=await import('../../src/UI/Game/AutoCombatSettings.js');
 const recovery=defaultRecoverySettings();recovery.hp.trigger=35;recovery.hp.items=[501];
 saveAutoCombatSettings('saved-recovery',{species:[],skills:[],ranges:{search:20,activity:30},recovery});
 expect(loadAutoCombatSettings('saved-recovery').recovery.hp).toMatchObject({trigger:35,items:[501]});
 expect(defaultRecoverySettings().hp.items).toEqual([]);
});
