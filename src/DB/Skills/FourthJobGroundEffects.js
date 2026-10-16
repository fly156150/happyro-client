import SU from './SkillUnitConst.js';

// Paths verified against the deployed kRO GRF. These are zone layers, not
// cast/hit animations: their lifetime belongs to the server's skill unit.
export const fourthJobGroundResources = {
	UNT_RAIN_OF_CRYSTAL: [
		['rain_of_crystal/rain_of_crystal_attack/rain_of_crystal_attack', false],
		['rain_of_crystal/rain_of_crystal_attack_bottom/rain_of_crystal_attack_bottom', true]
	],
	UNT_STAR_CANNON: [
		['sky_emperor/ske_star_cannon/star_cannon/ske_star_cannon', false],
		['sky_emperor/ske_star_cannon/star_cannon_bottom/ske_star_cannon_bottom', true]
	],
	UNT_GRENADES_DROPPING: [
		['night_watch/nw_grenades_dropping/grenades_dropping/grenades_dropping', false],
		['night_watch/nw_grenades_dropping/grenades_dropping_bottom/grenades_dropping_bottom', true]
	],
	UNT_FUUMASHOUAKU: [['shinkiro_shiranui/ss_fuumashouaku/fuumashouaku/fuumashouaku', false]],
	UNT_TWINKLING_GALAXY: [
		...Array.from({length: 4}, (_, index) => [`sky_emperor/ske_twinkling_galaxy/twinkling_galaxy/ske_twinkling_galaxy0${index}`, false]),
		['sky_emperor/ske_twinkling_galaxy/twinkling_galaxy_bottom/ske_twinkling_galaxy_bottom', true]
	],
	UNT_MYSTERY_ILLUSION: [
		['mystery_illusion/mystery_illusion/mystery_illusion', false],
		['mystery_illusion/mystery_illusion_bottom/mystery_illusion_bottom', true]
	],
	UNT_STRANTUM_TREMOR: [
		['strantumtremor/strantumtremor/strantumtremor', false],
		['strantumtremor/strantumtremor_bottom/strantumtremor_bottom', true]
	],
	UNT_VIOLENT_QUAKE: [
		['violentquake/violentquake_bottom/violentquake_bottom', true]
	],
	UNT_ASTRAL_STRIKE: [
		['astralstrike/astralstrike_bottom/astralstrike_bottom', true]
	],
	UNT_ALL_BLOOM: [
		['allbloom/allbloom/allbloom', false],
		['allbloom/allbloom_bottom/allbloom_bottom', true]
	],
	UNT_TORNADO_STORM: [
		['tornadostorm/tornadostorm/tornadostorm', false],
		['tornadostorm/tornadostorm_bottom/tornadostorm_bottom', true]
	],
	UNT_CROSS_RAIN: [
		['crossrain/cross_rain/cross_rain', false],
		['crossrain/cross_rain_bottom/cross_rain_bottom', true]
	],
	UNT_ABYSS_SQUARE: [
		['abyss_square/abyss_square/abyss_square', false],
		['abyss_square/abyss_square_bottom/abyss_square_bottom', true]
	],
	UNT_LIGHTNING_LAND: [
		['lightning_land/lightning_land/lightning_land', false],
		['lightning_land/lightning_land_bottom/lightning_land_bottom', true]
	],
	UNT_VENOM_SWAMP: [['venom_swamp/venom_swamp_bottom/venom_swamp_bottom', true]],
	UNT_CONFLAGRATION: [
		['conflagration/conflagration/conflagration', false],
		['conflagration/conflagration_bottom/conflagration_bottom', true]
	]
};

for (const trap of ['DEEPBLINDTRAP', 'SOLIDTRAP', 'SWIFTTRAP', 'FLAMETRAP']) {
	const name = trap.toLowerCase();
	fourthJobGroundResources[`UNT_${trap}`] = [
		[`${name}/${name}/${name}`, false],
		[`${name}/${name}_bottom/${name}_bottom`, true]
	];
}

for (const element of ['WATER', 'GROUND', 'WIND', 'FIRE']) {
	const name = `acidified_zone_${element.toLowerCase()}`;
	fourthJobGroundResources[`UNT_ACIDIFIED_ZONE_${element}`] = [
		[`${name}/${name}_a_loop/${name}_a_loop`, false],
		[`${name}/${name}_a_loop_bottom/${name}_a_loop_bottom`, true]
	];
}

export const fourthJobGroundUnits = {};
export const fourthJobGroundEffects = {};
export const fourthJobGroundEndEffects = {};

// Canonical BSON names are explicit here: lifecycle phases must never be
// guessed into the ordinary cast/hit mapping or played on the caster.
export const fourthJobBsonGroundStages = {
	UNT_TOTEM_OF_TUTELARY: {
		active: [
			'totem_of_tutelary_start',
			'totem_of_tutelary_bottom_start',
			'totem_of_tutelary_loop',
			'totem_of_tutelary_bottom_loop'
		],
		end: ['totem_of_tutelary_end', 'totem_of_tutelary_bottom_end']
	},
	UNT_HYUN_ROKS_BREEZE: { active: ['hyun_roks_breeze', 'hyun_roks_breeze_bottom'], end: [] },
	UNT_GROUND_GRAVITATION: {
		active: [
			'ground_gravitation_start',
			'ground_gravitation_bottom_start',
			'ground_gravitation_loop',
			'ground_gravitation_bottom_loop'
		],
		end: []
	},
	UNT_JACK_FROST_NOVA: {
		active: [
			'jack_frost_nova_start',
			'jack_frost_nova_start_bottom',
			'jack_frost_nova_loop',
			'jack_frost_nova_loop_bottom'
		],
		end: ['jack_frost_nova_end']
	},
	UNT_SHINKIROU: {
		active: ['shinkirou_idle_start', 'shinkirou_idle_loop'],
		end: ['shinkirou_idle_end']
	}
};
export const fourthJobBsonGroundNames = new Set(
	Object.values(fourthJobBsonGroundStages).flatMap(stages => [...stages.active, ...stages.end])
);

for (const [unit, stages] of Object.entries(fourthJobBsonGroundStages)) {
	fourthJobGroundUnits[SU[unit]] = `fourth:ground:${unit}`;
	if (stages.end.length) fourthJobGroundEndEffects[SU[unit]] = `fourth:ground-end:${unit}`;
}

export function registerFourthJobBsonGroundEffects(bson, effectTable) {
	for (const [unit, stages] of Object.entries(fourthJobBsonGroundStages)) {
		for (const [phase, names] of Object.entries(stages)) {
			if (!names.length) continue;
			const id = phase === 'end' ? fourthJobGroundEndEffects[SU[unit]] : fourthJobGroundUnits[SU[unit]];
			effectTable[id] = names.map(name => {
				const entry = bson[name];
				if (!entry?.FilePath) throw new Error(`Missing fourth-job ground phase: ${name}`);
				const file = entry.FilePath.replaceAll('\\', '/').replace(/\.str$/i, '');
				return {
					type: 'STR',
					file,
					texturePath: file.slice(0, file.lastIndexOf('/') + 1),
					renderBeforeEntities: !!entry.IsFloor,
					xOffset: entry.PosX || 0,
					yOffset: entry.PosY || 0,
					wav: entry.SoundPath ? entry.SoundPath.replaceAll('\\', '/').replace(/\.wav$/i, '') : null,
					delayStart: phase === 'end' ? 0 : entry.StartDelayTime || 0,
					repeat: phase !== 'end' && !!entry.IsInfinite,
					attachedEntity: phase !== 'end'
				};
			});
		}
	}
}

for (const [unit, layers] of Object.entries(fourthJobGroundResources)) {
	if (!Number.isInteger(SU[unit])) throw new Error(`Unknown fourth-job unit: ${unit}`);
	const effectId = `fourth:ground:${unit}`;
	fourthJobGroundUnits[SU[unit]] = effectId;
	fourthJobGroundEffects[effectId] = layers.map(([file, floor]) => ({
		type: 'STR',
		file,
		texturePath: file.slice(0, file.lastIndexOf('/') + 1),
		attachedEntity: true,
		renderBeforeEntities: floor
	}));
}
