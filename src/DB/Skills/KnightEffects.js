import SK from './SkillConst.js';

// Native STR where available; procedural rings use existing kRO textures.
// Area bursts snapshot the cast position. Only personal buff flashes follow
// the recipient, and they are one-shot effects, not client-side status timers.
const str = (file, extra = {}) => ({
	type: 'STR',
	file,
	texturePath: file.slice(0, file.lastIndexOf('/') + 1),
	attachedEntity: false,
	...extra
});
const ring = (color, extra = {}) => ({
	type: '3D',
	file: `effect/ring_${color}.tga`,
	duration: 650,
	sizeStart: 25,
	sizeEnd: 110,
	alphaMax: 0.8,
	fadeOut: true,
	rotateWithCamera: true,
	attachedEntity: false,
	zOffset: 1,
	...extra
});
const buff = color => [
	ring(color === 'green' ? 'white' : color, {
		attachedEntity: true,
		poszEnd: 2,
		...(color === 'green' ? { red: 0.4, green: 1, blue: 0.5 } : {})
	})
];

export const knightRenderEffects = {
	'knight:ignition': [
		str('new_ignitionbreak/new_ignitionbreak/new_ignitionbreak'),
		str('new_ignitionbreak/new_ignitionbreak_bottom/new_ignitionbreak_bottom', { renderBeforeEntities: true })
	],
	'knight:wind': [
		str('new_windcutter/new_windcutter/new_windcutter'),
		str('new_windcutter/new_windcutter_bottom_01clock/new_windcutter_bottom_01clock', {
			renderBeforeEntities: true
		}),
		str('new_windcutter/new_windcutter_bottom_05clock/new_windcutter_bottom_05clock', {
			renderBeforeEntities: true
		})
	],
	'knight:wind-hit': [str('new_windcutter/new_windcutter_target/new_windcutter_target')],
	'knight:sonic-flight': [
		ring('blue', {
			toSrc: true,
			matchTravelDuration: true,
			duration: 200,
			sizeStart: 45,
			sizeEnd: 65
		})
	],
	'knight:sonic-hit': [ring('white', { duration: 300, sizeStart: 15, sizeEnd: 90 })],
	'knight:spear-hit': [str('earthhit')],
	'knight:phantom': [str('pierce', { attachedEntity: true })],
	'knight:storm': [
		ring('white', { angle: 90, zOffset: 0.1, sizeEnd: 330, duration: 800 }),
		ring('blue', { sizeEnd: 180, duration: 500 })
	],
	'knight:howl': [str('dragon_h')],
	'knight:relax': buff('green'),
	'knight:deathbound': buff('purple'),
	'knight:crush': buff('red'),
	'knight:refresh': buff('white'),
	'knight:giant': buff('red'),
	'knight:stone': buff('yellow'),
	'knight:vitality': buff('green'),
	'knight:spirit': buff('yellow'),
	'knight:abundance': buff('blue')
};

const success = name => ({ successEffectId: `knight:${name}` });
export const knightSkillEffects = {
	[SK.LK_TENSIONRELAX]: success('relax'),
	// Modern server sends a no-damage success packet once, followed by splash
	// damage packets. Never replay the entire burst for each victim/hit.
	[SK.RK_IGNITIONBREAK]: success('ignition'),
	[SK.RK_WINDCUTTER]: { ...success('wind'), hitEffectId: 'knight:wind-hit' },
	[SK.RK_SONICWAVE]: {
		effectId: 832,
		beforeHitEffectId: 'knight:sonic-flight',
		hitEffectId: 'knight:sonic-hit'
	},
	[SK.RK_HUNDREDSPEAR]: { hitEffectId: 'knight:spear-hit' },
	// The success packet also covers pulling allies without inflicting damage.
	[SK.RK_PHANTOMTHRUST]: { successEffectIdOnCaster: 'knight:phantom' },
	[SK.RK_STORMBLAST]: success('storm'),
	[SK.RK_DRAGONHOWLING]: success('howl'),
	[SK.RK_DEATHBOUND]: success('deathbound'),
	[SK.RK_CRUSHSTRIKE]: success('crush'),
	[SK.RK_REFRESH]: success('refresh'),
	[SK.RK_GIANTGROWTH]: success('giant'),
	[SK.RK_STONEHARDSKIN]: success('stone'),
	[SK.RK_VITALITYACTIVATION]: success('vitality'),
	[SK.RK_FIGHTINGSPIRIT]: success('spirit'),
	[SK.RK_ABUNDANCE]: success('abundance')
};
