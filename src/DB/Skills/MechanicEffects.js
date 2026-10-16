import SK from './SkillConst.js';
import SC from '../Status/StatusConst.js';

// Verified against the deployed kRO resource set. STR animations use textures
// relative to their own directory. Older procedural effects have no standalone
// STR: compose their projectiles, steam and fields using native effect textures.
const str = (file, extra = {}) => ({
	type: 'STR', file, texturePath: file.slice(0, file.lastIndexOf('/') + 1), ...extra
});
const particle = (file, extra = {}) => ({
	type: '3D', file: `effect/${file}`, duration: 500, sizeStart: 35, sizeEnd: 80,
	fadeOut: true, alphaMax: 0.85, zOffset: 1, rotateWithCamera: true, ...extra
});
const ring = (color, extra = {}) => particle(`ring_${color}.tga`, {
	angle: 90, zOffset: 0.1, sizeStart: 30, sizeEnd: 180, ...extra
});
const steam = extra => particle('smoke.tga', {
	duplicate: 5, timeBetweenDupli: 60, sizeStart: 25, sizeEnd: 85,
	posxStartRand: 0.4, posyStartRand: 0.4, poszStart: 0, poszEnd: 2, ...extra
});
const projectile = (file, extra = {}) => particle(file, {
	toSrc: true, matchTravelDuration: true, duration: 200, sizeStart: 35, sizeEnd: 35, ...extra
});
const cannon = 'new_armscannon/new_armscannon_explosion/new_armscannon_explosion';
const cannonFloor = 'new_armscannon/new_armscannon_explosion_bottom/new_armscannon_explosion_bottom';

export const mechanicRenderEffects = {
	'mechanic:knuckle': [projectile('extremityfist.tga', { sizeStart: 55, sizeEnd: 55 })],
	'mechanic:impact': [particle('ring_white.tga', { sizeStart: 15, sizeEnd: 100, duration: 300 })],
	'mechanic:pile': [particle('ring_white.tga', { sizeStart: 100, sizeEnd: 10, duration: 200 }), steam({ duplicate: 3 })],
	'mechanic:vulcan': [str('new_vulcanarm/new_vulcanarm/new_vulcanarm'),
		str('new_vulcanarm/new_vulcanarm_bottom/new_vulcanarm_bottom', { renderBeforeEntities: true })],
	'mechanic:flame': [projectile('fireparticle.tga', { duplicate: 6, timeBetweenDupli: 35, sizeStart: 40, sizeEnd: 80 })],
	'mechanic:fire-hit': [str('firehit1')],
	'mechanic:cold': [projectile('ice.tga', { duplicate: 3, timeBetweenDupli: 50 })],
	'mechanic:ice-hit': [particle('ice.tga', { duplicate: 4, timeBetweenDupli: 25,
		posxEndRand: 1, posyEndRand: 1, poszEnd: 1.5, sizeEnd: 15 })],
	'mechanic:cannon': [str(cannon), str(cannonFloor, { renderBeforeEntities: true })],
	'mechanic:acceleration': [ring('yellow'), steam({ attachedEntity: true })],
	'mechanic:hover': [steam({ attachedEntity: true, poszStart: -0.5, poszEnd: 0 }), { wav: 'effect/hovering' }],
	'mechanic:slide': [steam({ duration: 350, sizeEnd: 45 })],
	'mechanic:self-destruct': [str(cannon), str(cannonFloor, { renderBeforeEntities: true }), steam({ duplicate: 8 })],
	'mechanic:shape': [ring('white', { sizeEnd: 130 }), particle('ring_blue.tga', { poszEnd: 3 })],
	'mechanic:cool': [steam({ blue: 1, red: 0.6, green: 0.8, duplicate: 8 })],
	'mechanic:scan': [ring('red', { sizeEnd: 360, duration: 900 }), { wav: 'effect/infraredscan' }],
	'mechanic:analyze': [particle('target1.bmp', { sizeStart: 100, sizeEnd: 60, duration: 800 }), { wav: 'effect/analyze' }],
	'mechanic:magnetic': [ring('purple', { sizeEnd: 300, duration: 900 }), { wav: 'effect/magneticfield' }],
	'mechanic:repair': [str('repairweapon')],
	'mechanic:axe-flight': [str('new_axeboomerang/new_axeboomerang/new_axeboomerang', { travelsFromOther: true })],
	'mechanic:axe-hit': [str('new_axeboomerang/new_axeboomerang_hit/new_axeboomerang_hit')],
	'mechanic:power-swing': [str('powerswing')],
	'mechanic:axe-tornado': [str('new_axetornado/new_axetornado/new_axetornado'),
		str('new_axetornado/new_axetornado_bottom/new_axetornado_bottom', { renderBeforeEntities: true })],
	'mechanic:construct': [ring('yellow', { sizeEnd: 120 }), steam({ duplicate: 3 })],
	'mechanic:dismantle': [steam({ duplicate: 6 })],
	// Persistent fields follow the master, and stop when its server status ends.
	'mechanic:barrier': [ring('yellow', { attachedEntity: true, duration: 1400,
		sizeStart: 240, sizeEnd: 260, alphaMax: 0.35 })],
	'mechanic:stealth': [ring('white', { attachedEntity: true, duration: 1400,
		sizeStart: 240, sizeEnd: 260, alphaMax: 0.25 })]
};

const hit = name => ({ hitEffectId: `mechanic:${name}` });
const success = name => ({ successEffectId: `mechanic:${name}` });
export const mechanicSkillEffects = {
	[SK.NC_BOOSTKNUCKLE]: { beforeHitEffectId: 'mechanic:knuckle', ...hit('impact') },
	[SK.NC_PILEBUNKER]: hit('pile'),
	[SK.NC_VULCANARM]: hit('vulcan'),
	[SK.NC_FLAMELAUNCHER]: { beforeHitEffectId: 'mechanic:flame', ...hit('fire-hit') },
	[SK.NC_COLDSLOWER]: { beforeHitEffectId: 'mechanic:cold', ...hit('ice-hit') },
	[SK.NC_ARMSCANNON]: hit('cannon'),
	[SK.NC_ACCELERATION]: success('acceleration'),
	[SK.NC_HOVERING]: success('hover'),
	[SK.NC_F_SIDESLIDE]: success('slide'),
	[SK.NC_B_SIDESLIDE]: success('slide'),
	[SK.NC_SELFDESTRUCTION]: success('self-destruct'),
	[SK.NC_SHAPESHIFT]: success('shape'),
	[SK.NC_EMERGENCYCOOL]: success('cool'),
	[SK.NC_INFRAREDSCAN]: { effectId: 'mechanic:scan' },
	[SK.NC_ANALYZE]: success('analyze'),
	[SK.NC_MAGNETICFIELD]: { effectId: 'mechanic:magnetic' },
	[SK.NC_NEUTRALBARRIER]: {}, // Server status controls the field's lifetime.
	[SK.NC_STEALTHFIELD]: {},
	[SK.NC_REPAIR]: success('repair'),
	[SK.NC_AXEBOOMERANG]: { beforeHitEffectId: 'mechanic:axe-flight', ...hit('axe-hit') },
	[SK.NC_POWERSWING]: hit('power-swing'),
	[SK.NC_AXETORNADO]: success('axe-tornado'),
	[SK.NC_SILVERSNIPER]: { groundCastEffectId: 'mechanic:construct' },
	[SK.NC_MAGICDECOY]: { groundCastEffectId: 'mechanic:construct' },
	[SK.NC_DISJOINT]: success('dismantle')
};
export const mechanicStatusEffects = {
	[SC.NEUTRALBARRIER_MASTER]: 'mechanic:barrier',
	[SC.STEALTHFIELD_MASTER]: 'mechanic:stealth'
};
