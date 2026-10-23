/**
 * Renderer/MapRenderer.js
 *
 * Rendering sprite in 2D or 3D context
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Thread from 'Core/Thread.js';
import SoundManager from 'Audio/SoundManager.js';
import CombatDiagnostics from 'Core/CombatDiagnostics.js';
import BGM from 'Audio/BGM.js';
import DB from 'DB/DBManager.js';
import UIManager from 'UI/UIManager.js';
import Background from 'UI/Background.js';
import Cursor from 'UI/CursorManager.js';
import Platform from 'UI/Platform.js';
import Session from 'Engine/SessionStorage.js';
import MemoryManager from 'Core/MemoryManager.js';
import Mouse from 'Controls/MouseEventHandler.js';
import Renderer from 'Renderer/Renderer.js';
import Camera from 'Renderer/Camera.js';
import EntityManager from 'Renderer/EntityManager.js';
import GridSelector from 'Renderer/Map/GridSelector.js';
import Ground from 'Renderer/Map/Ground.js';
import Altitude from 'Renderer/Map/Altitude.js';
import Water from 'Renderer/Map/Water.js';
import Models from 'Renderer/Map/Models.js';
import AnimatedModels from 'Renderer/Map/AnimatedModels.js';
import GR2ModelRenderer from 'Renderer/GR2/GR2ModelRenderer.js';
import Sounds from 'Renderer/Map/Sounds.js';
import Effects from 'Renderer/Map/Effects.js';
import SpriteRenderer from 'Renderer/SpriteRenderer.js';
import EffectManager from 'Renderer/EffectManager.js';
import SignboardManager from 'Renderer/SignboardManager.js';
import ScreenEffectManager from 'Renderer/ScreenEffectManager.js';
import Sky from 'Renderer/Effects/Sky.js';
import Damage from 'Renderer/Effects/Damage.js';
import GraphicsSettings from 'Preferences/Graphics.js';
import MapPreferences from 'Preferences/Map.js';
import glMatrix from 'Utils/gl-matrix.js';
import PACKETVER from 'Network/PacketVerManager.js';
import JoystickUI from 'UI/Components/JoystickUI/JoystickUI.js';

import PostProcess from 'Renderer/Effects/PostProcess.js';
import Bloom from 'Renderer/Effects/Shaders/Bloom.js';
import VerticalFlip from 'Renderer/Effects/Shaders/VerticalFlip.js';
import GaussianBlur from 'Renderer/Effects/Shaders/GaussianBlur.js';
import CAS from 'Renderer/Effects/Shaders/CAS.js';
import FXAA from 'Renderer/Effects/Shaders/FXAA.js';
import Vibrance from 'Renderer/Effects/Shaders/Vibrance.js';
import Cartoon from 'Renderer/Effects/Shaders/Cartoon.js';
import Blind from 'Renderer/Effects/Shaders/Blind.js';

import Upsampling from 'Renderer/Effects/Shaders/Upsampling.js';
import WebGL from 'Utils/WebGL.js';

const mat4 = glMatrix.mat4;
const _pos = new Uint16Array(2);
/**
 * Renderer Namespace
 */
class MapRenderer {
	/**
	 * @var {string} current map's name
	 */
	static currentMap = '';

	static loadGeneration = 0;

	/**
	 * @var {object} Global Light Structure
	 */
	static light = null;

	/**
	 * @var {object} Water Structure
	 */
	static water = null;

	/**
	 * @var {array} Sounds object list
	 */
	static sounds = null;

	/**
	 * @var {array} Effects object list
	 */
	static effects = null;

	/**
	 * @var {array} is loading a map ?
	 */
	static loading = false;

	/**
	 * @var {Float32Array} diffuse Modified diffuse color
	 */
	static diffuse = null;

	/**
	 * @var {Object} Fog structure
	 */
	static fog = {
		use: MapPreferences.useFog,
		exist: true,
		far: 30,
		near: 180,
		factor: 1.0,
		color: new Float32Array([1, 1, 1])
	};

	/**
	 * Load a map
	 *
	 * @param {string} mapname to load
	 */
	static setMap(mapname, { force = false } = {}) {
		if (this.loading) this.cancelLoad();
		const generation = ++this.loadGeneration;

		// Support for instance map
		// Is it always 3 digits ?
		mapname = mapname
			.replace(/^(\d{3})(\d@)/, '$2') // 0061@tower   -> 1@tower
			.replace(/^\d{3}#/, ''); // 003#prontera -> prontera

		// Clean objects
		SoundManager.stop();
		Renderer.stop();
		UIManager.removeComponents();
		Cursor.setType(Cursor.ACTION.DEFAULT);

		// Don't reload a map when it's just a local teleportation
		if (force || this.currentMap !== mapname) {
			this.loading = true;
			BGM.stop();
			this.currentMap = mapname;

			// Parse the filename (ugly RO)
			const filename = mapname.replace(/\.gat$/i, '.rsw');

			Background.setLoading(() => {
				if (!this.loading || generation !== this.loadGeneration) return;
				const handlers = {
					MAP_PROGRESS: onProgressUpdate,
					MAP_WORLD: onWorldComplete,
					MAP_GROUND: onGroundComplete,
					MAP_ALTITUDE: onAltitudeComplete,
					MAP_MODELS: onModelsComplete,
					MAP_ANIMATED_MODEL: onAnimatedModelComplete
				};
				for (const [type, handler] of Object.entries(handlers)) {
					Thread.hook(type, event => {
						if (!this.loading || generation !== this.loadGeneration || event.generation !== generation)
							return;
						try {
							handler.call(this, event.data);
						} catch (error) {
							this.failLoad(generation, {
								code: 'render_failed',
								resource: filename,
								message: error.message
							});
						}
					});
				}
				try {
					this.free();
					Renderer.remove();
					Thread.send('LOAD_MAP', { filename, generation }, (success, error) => {
						if (!this.loading || generation !== this.loadGeneration) return;
						if (!success) {
							this.failLoad(generation, error);
							return;
						}
						try {
							onMapComplete.call(this, generation);
						} catch (cause) {
							this.failLoad(generation, {
								code: 'render_failed',
								resource: filename,
								message: cause.message
							});
						}
					});
				} catch (error) {
					this.failLoad(generation, { code: 'render_failed', resource: filename, message: error.message });
				}
			});

			return;
		}

		this.loading = true;
		try {
			const gl = Renderer.getContext();
			EntityManager.free();
			Damage.free(gl);
			EffectManager.free(gl);
			JoystickUI.onRestore();

			// Basic TP
			Mouse.intersect = false;
			Background.remove(() => {
				if (!this.loading || generation !== this.loadGeneration) return;
				try {
					this.onLoad();
					Sky.setUpCloudData();
					Renderer.render(this.onRender);
					Mouse.intersect = true;
					this.onReady();
					this.loading = false;
				} catch (error) {
					this.failLoad(generation, { code: 'render_failed', resource: mapname, message: error.message });
				}
			});
		} catch (error) {
			this.failLoad(generation, { code: 'render_failed', resource: mapname, message: error.message });
		}
	}

	/** Invalidate all pending worker and background callbacks. */
	static cancelLoad() {
		const generation = this.loadGeneration;
		const wasLoading = this.loading;
		this.loadGeneration++;
		this.loading = false;
		this.currentMap = '';
		if (wasLoading) Thread.send('CANCEL_MAP', { generation });
	}

	static failLoad(generation, error) {
		if (!this.loading || generation !== this.loadGeneration) return;
		const mapName = this.currentMap;
		this.cancelLoad();
		try {
			this.free();
		} catch (cleanupError) {
			console.error('Map cleanup failed', cleanupError);
		}
		Renderer.stop();
		Mouse.intersect = false;
		this.onError({ ...error, mapName, generation });
	}

	/**
	 * Clean up data
	 */
	static free() {
		const gl = Renderer.getContext();

		EntityManager.free();
		EntityManager.clearLifeCache();
		GridSelector.free(gl);
		Sounds.free();
		Effects.free();
		Ground.free(gl);
		Water.free(gl);
		Models.free(gl);
		AnimatedModels.free(gl);
		GR2ModelRenderer.free(gl);
		Damage.free(gl);
		EffectManager.free(gl);
		SignboardManager.free();
		SoundManager.stop();
		BGM.stop();

		// Release WebGL resources for post-processing effects
		PostProcess.clean(gl);

		Mouse.intersect = false;

		this.light = null;
		this.water = null;
		this.sounds = null;
		this.effects = null;
	}

	/**
	 * Rendering world
	 *
	 * @param {number} tick - game tick
	 * @param {object} gl context
	 */
	static onRender(tick, gl) {
		let diagnosticStage = CombatDiagnostics.begin();
		PostProcess.prepare(gl);

		const fog = MapRenderer.fog;
		fog.use = MapPreferences.fog;
		const light = MapRenderer.light;

		let x, y;

		// Clean mouse position in world
		Mouse.world.x = -1;
		Mouse.world.y = -1;
		Mouse.world.z = -1;

		// Update camera
		Camera.update(tick);

		const modelView = Camera.modelView;
		const projection = Camera.projection;
		const normalMat = Camera.normalMat;

		// Render Ground
		Ground.render(gl, modelView, projection, normalMat, fog, light);
		diagnosticStage = CombatDiagnostics.end('map.ground', diagnosticStage);

		// Spam map effects
		Effects.spam(Session.Entity.position, tick);

		if (Mouse.intersect && Altitude.intersect(modelView, projection, _pos)) {
			x = _pos[0];
			y = _pos[1];
			const isWalkable = Altitude.getCellType(x, y) & Altitude.TYPE.WALKABLE;

			Mouse.world.x = x;
			Mouse.world.y = y;
			Mouse.world.z = Altitude.getCellHeight(x, y);

			if (isWalkable && (!Platform.isMobile || Session.captchaGetIdOnFloorClick)) {
				if (Session.captchaGetIdOnFloorClick) {
					// render Grid Selector on floor range
					const range = Session.captchaGetIdOnFloorRange;

					// render on range
					const cells = Altitude.getCellsInSquareRange(x, y, range);
					cells.forEach(cell => {
						GridSelector.render(gl, modelView, projection, fog, cell.x, cell.y);
					});
				}
				GridSelector.render(gl, modelView, projection, fog, x, y);
			}

			// NO walk cursor
			// TODO: Know the packet version for this feature
			if (PACKETVER.value >= 20200101) {
				if (Cursor.getActualType() === Cursor.ACTION.NOWALK && isWalkable) {
					Cursor.setType(Cursor.ACTION.DEFAULT, false);
				}
				if (Cursor.getActualType() === Cursor.ACTION.DEFAULT && !isWalkable) {
					Cursor.setType(Cursor.ACTION.NOWALK, false);
				}
			}
		}

		diagnosticStage = CombatDiagnostics.end('map.environment', diagnosticStage);
		// Display zone effects and entities
		Sky.render(gl, modelView, projection, fog, tick);

		Models.render(gl, modelView, projection, normalMat, fog, light);
		AnimatedModels.render(gl, modelView, projection, normalMat, fog, light, tick);
		// GR2 mobs render here with the opaque world models, before EntityManager.render below
		// -- hence the 1-frame lag documented in GR2ModelRenderer.render (syncFromEntity reads the
		// entity pose one frame stale). Ordering is intentional (opaque geometry pass).
		GR2ModelRenderer.render(gl, modelView, projection, normalMat, fog, light, tick);
		diagnosticStage = CombatDiagnostics.end('map.models', diagnosticStage);

		// Render transparent elements before ground
		ScreenEffectManager.render(gl, modelView, projection, fog, tick, true);

		EffectManager.render(gl, modelView, projection, fog, tick, true);
		diagnosticStage = CombatDiagnostics.end('map.effects.before', diagnosticStage);

		//Render Entities (no effects)
		EntityManager.render(gl, modelView, projection, fog, false);
		diagnosticStage = CombatDiagnostics.end('map.entities', diagnosticStage);

		// Rendering water (after sprites, billboard projection pushes it to back)
		Water.render(gl, modelView, projection, fog, light, tick);
		diagnosticStage = CombatDiagnostics.end('map.water', diagnosticStage);

		EffectManager.render(gl, modelView, projection, fog, tick, false);
		diagnosticStage = CombatDiagnostics.end('map.effects.after', diagnosticStage);
		EntityManager.render(gl, modelView, projection, fog, true);
		diagnosticStage = CombatDiagnostics.end('map.effectEntities', diagnosticStage);

		Damage.render(gl, modelView, projection, fog, tick);
		diagnosticStage = CombatDiagnostics.end('map.damage', diagnosticStage);

		// Render signboards
		SignboardManager.render(gl, modelView, projection);

		// Screen overlayed Effects
		ScreenEffectManager.render(gl, modelView, projection, fog, tick);

		// Play sounds
		Sounds.render(Session.Entity.position, tick);
		diagnosticStage = CombatDiagnostics.end('map.overlays', diagnosticStage);

		// Find entity over the cursor
		if (Mouse.intersect) {
			const entity = EntityManager.intersect();
			EntityManager.setOverEntity(entity);
		}

		diagnosticStage = CombatDiagnostics.end('map.picking', diagnosticStage);
		// Clean up
		MemoryManager.clean(gl, tick);
		diagnosticStage = CombatDiagnostics.end('map.cleanup', diagnosticStage);

		// Finalize frame with post-processing effects
		PostProcess.render(gl);
		CombatDiagnostics.end('map.postprocess', diagnosticStage);
	}

	/**
	 * Callback to execute once the map is loaded
	 */
	static onLoad() {}

	static onError(error) {
		UIManager.showErrorBox(error.message).ui.css('zIndex', 1000);
	}

	/** Called only after scene initialization and rendering startup succeed. */
	static onReady() {}
}

/**
 * Received progress from Thread
 *
 * @param {number} percent (progress)
 */
function onProgressUpdate(percent) {
	Background.setPercent(percent);
}

/**
 * Received parsed world
 */
function onWorldComplete(data) {
	this.light = data.light;
	this.water = data.water;
	this.sounds = data.sound;
	this.effects = data.effect;
	this.diffuse = new Float32Array(this.light.diffuse);

	// Set default env color
	this.light.env = new Float32Array([
		1 - (1 - this.light.diffuse[0]) * (1 - this.light.ambient[0]),
		1 - (1 - this.light.diffuse[1]) * (1 - this.light.ambient[1]),
		1 - (1 - this.light.diffuse[2]) * (1 - this.light.ambient[2])
	]);

	// Calculate light direction
	this.light.direction = new Float32Array(3);
	const longitude = (this.light.longitude * Math.PI) / 180;
	const latitude = (this.light.latitude * Math.PI) / 180;

	const dirMat4 = mat4.create();
	// Original client first rotates around X then Y, but then multiplies matrixes in reverse order
	// Which means we have to rotate Y first then X
	mat4.rotateY(dirMat4, dirMat4, longitude);
	mat4.rotateX(dirMat4, dirMat4, latitude);
	const dirVec = mat4.multiplyVec3([0, 1, 0], dirMat4);

	this.light.direction[0] = -dirVec[0];
	this.light.direction[1] = -dirVec[1];
	this.light.direction[2] = -dirVec[2];
}

/**
 * Received ground data from Thread
 */
function onGroundComplete(data) {
	const gl = Renderer.getContext();

	this.water.mesh = data.waterMesh;
	this.water.vertCount = data.waterVertCount;

	Ground.init(gl, data);
	Water.init(gl, this.water);

	// Initialize sounds
	this.sounds.forEach(sound => {
		const tmp = -sound.pos[1];
		sound.pos[0] += data.width;
		sound.pos[1] = sound.pos[2] + data.height;
		sound.pos[2] = tmp;
		sound.range *= 0.2;
		sound.tick = 0;
		sound.cycle = !sound.cycle ? 7 : sound.cycle;
		Sounds.add(sound);
	});

	this.effects.forEach(effect => {
		// Note: effects objects do not need to be centered in a cell
		// as we apply +0.5 in the shader, we have to revert it.
		const tmp = -effect.pos[1] + 1; //WTF????????
		effect.pos[0] += data.width - 0.5;
		effect.pos[1] = effect.pos[2] + data.height - 0.5;
		effect.pos[2] = tmp;

		effect.tick = 0;

		Effects.add(effect);
	});

	this.effects.length = 0;
	this.sounds.length = 0;
}

/**
 * Receiving parsed GAT from Thread
 */
function onAltitudeComplete(data) {
	const gl = Renderer.getContext();
	Altitude.init(data);
	GridSelector.init(gl);
}

/**
 * Receiving parsed RSMs from Thread
 */
function onModelsComplete(data) {
	Models.init(Renderer.getContext(), data);
}

/**
 * Receiving animated RSM model from Thread
 */
function onAnimatedModelComplete(data) {
	const gl = Renderer.getContext();
	AnimatedModels.add(gl, data);
}

/**
 * Register PostProcessing Modules in pass order
 */
function registerPostProcessModules(gl) {
	if (WebGL.detectBadWebGL(gl)) {
		GraphicsSettings.bloom = false;
	} else {
		PostProcess.register(Bloom, gl);
	}
	PostProcess.register(GaussianBlur, gl);
	PostProcess.register(FXAA, gl);
	PostProcess.register(CAS, gl);
	PostProcess.register(Cartoon, gl);
	PostProcess.register(Vibrance, gl);
	PostProcess.register(VerticalFlip, gl);
	PostProcess.register(Blind, gl);

	// Final Pass GPU Upsampling for Performance Mode
	PostProcess.register(Upsampling, gl);
}

/**
 * Once the map finished to load
 */
function onMapComplete(generation) {
	const worldResource = this.currentMap.replace(/\.gat$/i, '.rsw');
	const mapInfo = DB.getMap(worldResource);

	// Play BGM
	BGM.play((mapInfo && mapInfo.mp3) || '01.mp3');

	// Apply fog to map
	this.fog.exist = !!(mapInfo && mapInfo.fog);
	if (this.fog.exist) {
		this.fog.near = mapInfo.fog.near * 240;
		this.fog.far = mapInfo.fog.far * 240;
		this.fog.factor = mapInfo.fog.factor;
		this.fog.color.set(mapInfo.fog.color);
	}

	// Initialize renderers
	Renderer.init();
	const gl = Renderer.getContext();

	SpriteRenderer.init(gl);
	Sky.init(gl, worldResource);
	Damage.init(gl);
	EffectManager.init(gl);
	ScreenEffectManager.init(gl, worldResource);
	registerPostProcessModules(gl);
	JoystickUI.onRestore();

	// Starting to render
	Background.remove(() => {
		if (!MapRenderer.loading || generation !== MapRenderer.loadGeneration) return;
		try {
			MapRenderer.onLoad();
			Sky.setUpCloudData();
			ScreenEffectManager.startMapflagEffect(worldResource);

			// Display game
			Renderer.show();
			Renderer.render(MapRenderer.onRender);
			Mouse.intersect = true;
			MapRenderer.onReady();
			MapRenderer.loading = false;
		} catch (error) {
			MapRenderer.failLoad(generation, {
				code: 'render_failed',
				resource: worldResource,
				message: error.message
			});
		}
	});
}

/**
 * Export
 */
export default MapRenderer;
