import SK from './SkillConst.js';
import StatusConst from '../Status/StatusConst.js';
import effectMetadata from './FourthJobEffectMetadata.js';

// Explicit associations with STR assets in the deployed kRO resource set.
// Each nested STR uses textures relative to its own directory.
// Expanded-job effects are already loaded from ez2streffect.bson; do not
// duplicate those entries here, as that would play the same STR twice.
export const fourthJobEffectResources = {
	ABC_ABYSS_FLAME: {
		beginCastEffectId: [
			'ABYSS_CHASER/ABC_ABYSS_FLAME/abyss_flame_cast/abyss_flame_cast',
			'ABYSS_CHASER/ABC_ABYSS_FLAME/abyss_flame_cast_bottom/abyss_flame_cast_bottom'
		],
		successEffectId: ['ABYSS_CHASER/ABC_ABYSS_FLAME/abyss_flame/abyss_flame'],
		hitEffectId: ['ABYSS_CHASER/ABC_ABYSS_FLAME/abyss_flame_hit/abyss_flame_hit']
	},
	ABC_ABYSS_FLAME_ATK: {
		successEffectId: ['ABYSS_CHASER/ABC_ABYSS_FLAME/abyss_flame_target/abyss_flame_target'],
		hitEffectId: ['ABYSS_CHASER/ABC_ABYSS_FLAME/abyss_flame_hit/abyss_flame_hit']
	},
	ABC_CHASING_BREAK: {
		successEffectId: ['ABYSS_CHASER/ABC_CHASING_BREAK/chasing_break/chasing_break'],
		hitEffectId: ['abyss_dagger/abyss_dagger_hit/abyss_dagger_hit']
	},
	ABC_CHASING_SHOT: {
		beginCastEffectId: [
			'ABYSS_CHASER/ABC_CHASING_SHOT/chasing_shot_cast/chasing_shot_cast',
			'ABYSS_CHASER/ABC_CHASING_SHOT/chasing_shot_cast_bottom/chasing_shot_cast_bottom'
		],
		beforeHitEffectId: {
			files: ['ABYSS_CHASER/ABC_CHASING_SHOT/chasing_shot_single/chasing_shot_single'],
			travelsFromOther: true
		},
		hitEffectId: [
			'ABYSS_CHASER/ABC_CHASING_SHOT/chasing_shot_hit/chasing_shot_hit',
			'ABYSS_CHASER/ABC_CHASING_SHOT/chasing_shot_hitsub/chasing_shot_hitsub'
		]
	},
	ABC_HIT_AND_SLIDING: {
		hitEffectId: ['abyss_dagger/abyss_dagger_hit/abyss_dagger_hit']
	},
	NW_WILD_SHOT: {
		beginCastEffectId: ['NIGHT_WATCH/NW_WILD_SHOT/wild_shot_cast/wild_shot_cast'],
		successEffectId: ['NIGHT_WATCH/NW_WILD_SHOT/wild_shot/wild_shot'],
		hitEffectId: ['NIGHT_WATCH/NW_WILD_SHOT/wild_shot_hit/wild_shot_hit']
	},
	NW_MIDNIGHT_FALLEN: {
		beginCastEffectId: ['NIGHT_WATCH/NW_MIDNIGHT_FALLEN/midnight_fallen_cast_bottom/midnight_fallen_cast_bottom'],
		groundCastEffectId: ['NIGHT_WATCH/NW_MIDNIGHT_FALLEN/midnight_fallen_bottom/midnight_fallen_bottom'],
		hitEffectId: ['NIGHT_WATCH/NW_MAGAZINE_FOR_ONE/magazine_for_one']
	},
	SKE_SKY_SUN: {
		successEffectId: 'SKY_EMPEROR/SKE_SKY_SUN/sky_sun/sky_sun',
		hitEffectId: [
			'SKY_EMPEROR/SKE_SKY_SUN/sky_sun_hit/sky_sun_hit',
			'SKY_EMPEROR/SKE_SUNSET_BLAST/sunset_blast_small'
		]
	},
	CD_DIVINUS_FLOS: {
		successEffectId: [
			'CARDINAL/CD_DIVINUS_FLOS/divinus_flos/divinus_flos',
			'CARDINAL/CD_DIVINUS_FLOS/divinus_flos_bottom/divinus_flos_bottom'
		],
		beginCastEffectId: [
			'CARDINAL/CD_DIVINUS_FLOS/divinus_flos_cast/divinus_flos_cast',
			'CARDINAL/CD_DIVINUS_FLOS/divinus_flos_cast_bottom/divinus_flos_cast_bottom'
		],
		hitEffectId: 'CARDINAL/CD_DIVINUS_FLOS/divinus_flos_hit/divinus_flos_hit'
	},
	EM_PSYCHIC_STREAM: {
		successEffectId: [
			'ELEMENTAL_MASTER/EM_PSYCHIC_STREAM/psychic_stream/psychic_stream',
			'ELEMENTAL_MASTER/EM_PSYCHIC_STREAM/psychic_stream_bottom/psychic_stream_bottom'
		],
		beginCastEffectId: 'ELEMENTAL_MASTER/EM_PSYCHIC_STREAM/psychic_stream_cast/psychic_stream_cast',
		hitEffectId: 'ELEMENTAL_MASTER/EM_PSYCHIC_STREAM/psychic_stream_hit/psychic_stream_hit'
	},
	HN_OVERCOMING_CRISIS: {
		successEffectId: [
			'HYPER_NOVICE/HN_OVERCOMING_CRISIS/overcoming_crisis/overcoming_crisis',
			'HYPER_NOVICE/HN_OVERCOMING_CRISIS/overcoming_crisis_bottom/overcoming_crisis_bottom'
		]
	},
	IG_IMPERIAL_PRESSURE: {
		beginCastEffectId: 'IMPERIAL_GUARD/IG_IMPERIAL_PRESSURE/imperal_pressure_cast/imperal_pressure_cast',
		successEffectId: [
			'IMPERIAL_GUARD/IG_IMPERIAL_PRESSURE/imperal_pressure/imperal_pressure',
			'IMPERIAL_GUARD/IG_IMPERIAL_PRESSURE/imperal_pressure_bottom/imperal_pressure_bottom'
		],
		hitEffectId: 'new_rayofgenesis/new_rayofgenesis_hit/new_rayofgenesis_hit'
	},
	IQ_BLAZING_FLAME_BLAST: {
		successEffectId: 'INQUISITOR/IQ_BLAZING_FLAME_BLAST/blazing_flame_blast/blazing_flame_blast',
		beginCastEffectId: [
			'INQUISITOR/IQ_BLAZING_FLAME_BLAST/blazing_flame_blast_cast/blazing_flame_blast_cast',
			'INQUISITOR/IQ_BLAZING_FLAME_BLAST/blazing_flame_blast_cast_bottom/blazing_flame_blast_cast_bottom'
		],
		hitEffectId: 'INQUISITOR/IQ_BLAZING_FLAME_BLAST/blazing_flame_blast_hit/blazing_flame_blast_hit'
	},
	SH_CHUL_HO_BATTERING: {
		successEffectId: [
			'SPIRIT_HANDLER/SH_CHUL_HO_BATTERING/chul_ho_battering/chul_ho_battering',
			'SPIRIT_HANDLER/SH_CHUL_HO_BATTERING/chul_ho_battering_bottom/chul_ho_battering_bottom'
		],
		beginCastEffectId: 'SPIRIT_HANDLER/SH_CHUL_HO_BATTERING/chul_ho_battering_cast/chul_ho_battering_cast',
		hitEffectId: 'SPIRIT_HANDLER/SH_CHUL_HO_BATTERING/chul_ho_battering_hit/chul_ho_battering_hit'
	},
	SH_HYUN_ROK_SPIRIT_POWER: {
		successEffectId: [
			'SPIRIT_HANDLER/SH_HYUN_ROK_SPIRIT_POWER/hyun_rok_spirit_power/hyun_rok_spirit_power',
			'SPIRIT_HANDLER/SH_HYUN_ROK_SPIRIT_POWER/hyun_rok_spirit_power_bottom/hyun_rok_spirit_power_bottom'
		],
		beginCastEffectId: [
			'SPIRIT_HANDLER/SH_HYUN_ROK_SPIRIT_POWER/hyun_rok_spirit_power_cast/hyun_rok_spirit_power_cast',
			'SPIRIT_HANDLER/SH_HYUN_ROK_SPIRIT_POWER/hyun_rok_spirit_power_cast_bottom/hyun_rok_spirit_power_cast_bottom'
		],
		hitEffectId: 'SPIRIT_HANDLER/SH_HYUN_ROK_SPIRIT_POWER/hyun_rok_spirit_power_hit/hyun_rok_spirit_power_hit'
	},
	SKE_SKY_MOON: {
		successEffectId: [
			'SKY_EMPEROR/SKE_SKY_MOON/sky_moon/sky_moon',
			'SKY_EMPEROR/SKE_SKY_MOON/sky_moon_bottom/sky_moon_bottom'
		],
		beginCastEffectId: [
			'SKY_EMPEROR/SKE_SKY_MOON/sky_moon_cast/sky_moon_cast',
			'SKY_EMPEROR/SKE_SKY_MOON/sky_moon_cast_bottom/sky_moon_cast_bottom'
		],
		hitEffectId: 'SKY_EMPEROR/SKE_SKY_MOON/sky_moon_hit/sky_moon_hit'
	},
	SKE_STAR_LIGHT_KICK: {
		successEffectId: [
			'SKY_EMPEROR/SKE_STAR_LIGHT_KICK/star_light_kick/star_light_kick',
			'SKY_EMPEROR/SKE_STAR_LIGHT_KICK/star_light_kick_bottom/star_light_kick_bottom'
		],
		hitEffectId: 'SKY_EMPEROR/SKE_STAR_LIGHT_KICK/star_light_kick_hit/star_light_kick_hit'
	},
	IG_IMPERIAL_CROSS: {
		successEffectId: 'IMPERIAL_GUARD/IG_IMPERIAL_CROSS/imperial_cross/imperial_cross',
		hitEffectId: 'IMPERIAL_GUARD/IG_OVERSLASH/new_overslash/new_overslash_hit/new_overslash_hit'
	},
	IG_RADIANT_SPEAR: {
		beginCastEffectId: 'IMPERIAL_GUARD/IG_RADIANT_SPEAR/radiant_spear_cast/radiant_spear_cast',
		hitEffectId: 'new_banishingpoint/new_banishingpoint_target/new_banishingpoint_target',
		successEffectId: [
			'IMPERIAL_GUARD/IG_RADIANT_SPEAR/radiant_spear_leftdown/radiant_spear_leftdown',
			'IMPERIAL_GUARD/IG_RADIANT_SPEAR/radiant_spear_leftdown_bottom/radiant_spear_leftdown_bottom',
			'IMPERIAL_GUARD/IG_RADIANT_SPEAR/radiant_spear_rightdown/radiant_spear_rightdown',
			'IMPERIAL_GUARD/IG_RADIANT_SPEAR/radiant_spear_rightdown_bottom/radiant_spear_rightdown_bottom'
		]
	},
	TR_RHYTHMICAL_WAVE: {
		successEffectId: [
			'TROUBADOUR_TROUVERE/TR_RHYTHMICAL_WAVE/rhythmical_wave/rhythmical_wave',
			'TROUBADOUR_TROUVERE/TR_RHYTHMICAL_WAVE/rhythmical_wave_bottom/rhythmical_wave_bottom'
		],
		beginCastEffectId: [
			'TROUBADOUR_TROUVERE/TR_RHYTHMICAL_WAVE/rhythmical_wave_cast/rhythmical_wave_cast',
			'TROUBADOUR_TROUVERE/TR_RHYTHMICAL_WAVE/rhythmical_wave_cast_bottom/rhythmical_wave_cast_bottom'
		],
		hitEffectId: 'TROUBADOUR_TROUVERE/TR_RHYTHMICAL_WAVE/rhythmical_wave_hit/rhythmical_wave_hit'
	},
	BO_DUST_EXPLOSION: {
		successEffectId: 'BIOLO/BO_DUST_EXPLOSION/dust_explosion/dust_explosion',
		hitEffectId: [
			'BIOLO/BO_DUST_EXPLOSION/dust_explosion_hit/dust_explosion_hit',
			'BIOLO/BO_DUST_EXPLOSION/dust_explosion_hit_bottom/dust_explosion_hit_bottom'
		]
	},
	BO_MYSTERY_POWDER: {
		successEffectId: 'BIOLO/BO_MYSTERY_POWDER/mistery_powder/mistery_powder',
		hitEffectId: 'BIOLO/BO_MYSTERY_POWDER/mistery_powder_hit/mistery_powder_hit'
	},
	MT_ENERGY_CANNONADE: {
		successEffectId: 'MEISTER/MT_ENERGY_CANNONADE/energy_cannonade/energy_cannonade',
		beginCastEffectId: [
			'MEISTER/MT_ENERGY_CANNONADE/energy_cannonade_cast/energy_cannonade_cast',
			'MEISTER/MT_ENERGY_CANNONADE/energy_cannonade_cast_bottom/energy_cannonade_cast_bottom'
		],
		hitEffectId: 'MEISTER/MT_ENERGY_CANNONADE/energy_cannonade_hit/energy_cannonade_hit'
	},
	MT_POWERFUL_SWING: {
		successEffectId: [
			'MEISTER/MT_POWERFUL_SWING/powerful_swing/powerful_swing',
			'MEISTER/MT_POWERFUL_SWING/powerful_swing_bottom/powerful_swing_bottom'
		],
		hitEffectId: 'MEISTER/MT_POWERFUL_SWING/powerful_swing_hit/powerful_swing_hit'
	},
	MT_RUSH_STRIKE: {
		successEffectId: [
			'MEISTER/MT_RUSH_STRIKE/rush_strike/rush_strike',
			'MEISTER/MT_RUSH_STRIKE/rush_strike_bottom/rush_strike_bottom'
		],
		hitEffectId: 'new_axe_stomp/new_axe_stomp_hit/new_axe_stomp_hit'
	},
	BO_EXPLOSIVE_POWDER: {
		successEffectId: ['BIOLO/EXPLOSIVE_POWDER/explosive_powder/explosive_powder']
	},
	BO_MAYHEMIC_THORNS: {
		successEffectId: [
			'BIOLO/MAYHEMIC_THORNS/mayhemic_thorns/mayhemic_thorns',
			'BIOLO/MAYHEMIC_THORNS/mayhemic_thorns_bottom/mayhemic_thorns_bottom'
		]
	},
	MT_MIGHTY_SMASH: {
		successEffectId: ['MEISTER/MIGHTY_SMASH/mighty_smash/mighty_smash']
	},
	MT_SPARK_BLASTER: {
		successEffectId: [
			'MEISTER/SPARK_BLASTER/spark_blaster/spark_blaster',
			'MEISTER/SPARK_BLASTER/spark_blaster_bottom/spark_blaster_bottom'
		]
	},
	MT_TRIPLE_LASER: {
		hitEffectId: ['MEISTER/TRIPLE_LASER/triple_laser/triple_laser']
	},
	DK_DRAGONIC_BREATH: {
		successEffectId: [
			'DRAGON_KNIGHT/DRAGONIC_BREATH/dragonic_breath/dragonic_breath',
			'DRAGON_KNIGHT/DRAGONIC_BREATH/dragonic_breath_bottom/dragonic_breath_bottom'
		],
		hitEffectId: 'DRAGON_KNIGHT/DRAGONIC_BREATH/dragonic_breath_hit/dragonic_breath_hit'
	},
	DK_DRAGONIC_PIERCE: {
		beginCastEffectId: 'DRAGON_KNIGHT/DK_DRAGONIC_PIERCE/dragonic_pierce_cast/dragonic_pierce_cast',
		hitEffectId: [
			'DRAGON_KNIGHT/DK_DRAGONIC_PIERCE/dragonic_pierce_hit/dragonic_pierce_hit',
			'DRAGON_KNIGHT/DK_DRAGONIC_PIERCE/dragonic_pierce_hit_bottom/dragonic_pierce_hit_bottom'
		]
	},
	SHC_CROSS_SLASH: {
		successEffectId: 'SHADOW_CROSS/SHC_CROSS_SLASH/cross_slash/cross_slash',
		hitEffectId: 'shadow_stab/shadow_stab_hit1/shadow_stab_hit1'
	},
	AG_ENERGY_CONVERSION: {
		beginCastEffectId: [
			'ARCHMAGE/AG_ENERGY_CONVERSION/energy_conversion_cast/energy_conversion_cast',
			'ARCHMAGE/AG_ENERGY_CONVERSION/energy_conversion_cast_bottom/energy_conversion_cast_bottom'
		],
		effectId: 'ARCHMAGE/AG_ENERGY_CONVERSION/energy_conversion/energy_conversion'
	},
	WH_WILD_WALK: {
		beginCastEffectId: [
			'WINDHAWK/WH_WILD_WALK/wild_walk_cast/wild_walk_cast',
			'WINDHAWK/WH_WILD_WALK/wild_walk_cast_bottom/wild_walk_cast_bottom'
		],
		successEffectId: 'WINDHAWK/WH_WILD_WALK/wild_walk/wild_walk',
		hitEffectId: 'WINDHAWK/WH_WILD_WALK/wild_walk_hit/wild_walk_hit'
	},
	WH_CALAMITYGALE: {
		beginCastEffectId: '4wh_calumitygale/calumitygale_cast/calumitygale_cast',
		effectId: '4wh_calumitygale/calumitygale/calumitygale'
	},
	DK_SERVANTWEAPON: {
		beginCastEffectId: 'servantweapon/servantweapon_cast/servantweapon_cast',
		successEffectId: { files: 'servantweapon/servantweapon/servantweapon', attachedEntity: true }
	},
	DK_SERVANTWEAPON_ATK: {
		beforeHitEffectId: {
			files: [
				'servantweapon/servantweapon_shoot/servantweapon_shoot',
				'servantweapon/servantweapon_shoot_bottom/servantweapon_shoot_bottom'
			],
			travelsFromOther: true
		},
		hitEffectId: [
			'servantweapon/servantweapon_hit/servantweapon_hit',
			'servantweapon/servantweapon_hit_bottom/servantweapon_hit_bottom'
		]
	},
	DK_SERVANT_W_SIGN: { effectId: 'servant_sign/servant_sign_down/servant_sign_down' },
	DK_SERVANT_W_PHANTOM: {
		// The server acknowledges the jump even when there is no marked target to damage.
		successEffectId: 'servant_phantom/servant_phantom_down/servant_phantom_down',
		hitEffectId: 'servant_phantom/servant_phantom_hit/servant_phantom_hit'
	},
	DK_SERVANT_W_DEMOL: { hitEffectId: 'servant_demolition/servant_demolition_hit/servant_demolition_hit' },
	DK_CHARGINGPIERCE: { effectId: 'new_chargingpierce/new_chargingpierce_cast/new_chargingpierce_cast' },
	DK_HACKANDSLASHER: {
		successEffectId: 'hackandslash/hackandslash/hackandslash',
		hitEffectId: 'hackandslash/hackandslash_hit/hackandslash_hit'
	},
	// Secondary damage packets carry their own skill ID.
	DK_HACKANDSLASHER_ATK: { hitEffectId: 'hackandslash/hackandslash_hit/hackandslash_hit' },
	DK_DRAGONIC_AURA: { hitEffectId: 'dragonnic_ora/dragonnic_ora_hit/dragonnic_ora_hit' },
	DK_MADNESS_CRUSHER: { hitEffectId: 'madness_crusher/madness_crusher/madness_crusher' },
	DK_VIGOR: { effectId: 'vigor/vigor_cast/vigor_cast' },
	DK_STORMSLASH: { hitEffectId: 'stormslash/stormslash/stormslash_1' },
	MT_A_MACHINE: {
		beginCastEffectId: 'a_machine/a_machine_cast/a_machine_cast',
		hitEffectId: 'a_machine/a_machine_hit/a_machine_hit'
	},
	SHC_SHADOW_EXCEED: { effectId: 'shadow_exceed/shadow_exceed/shadow_exceed' },
	SHC_DANCING_KNIFE: {
		successEffectId: 'dancing_knife/dancing_knife_cast/dancing_knife_cast',
		hitEffectId: 'dancing_knife/dancing_knife_hit/dancing_knife_hit'
	},
	SHC_SAVAGE_IMPACT: { hitEffectId: 'savage_impact/savage_impact_hit/savage_impact_hit' },
	SHC_ETERNAL_SLASH: { hitEffectId: 'eternal_slash/eternal_slash_hit/eternal_slash_hit' },
	SHC_SHADOW_STAB: { hitEffectId: 'shadow_stab/shadow_stab/shadow_stab' },
	SHC_IMPACT_CRATER: { hitEffectId: 'impact_crater/impact_crater_hit/impact_crater_hit' },
	SHC_FATAL_SHADOW_CROW: { hitEffectId: 'fatal_shadow_crow/fatal_shadow_crow_hit/fatal_shadow_crow_hit' },
	SHC_POTENT_VENOM: { effectId: 'new_potent_venom/new_potent_venom' },
	SHC_ENCHANTING_SHADOW: {
		effectId: [
			'enchanting_shadow/enchanting_shadow/new_enchanting_shadow',
			'enchanting_shadow/enchanting_shadow_bottom/new_enchanting_shadow_bottom'
		]
	},
	MT_AXE_STOMP: {
		successEffectId: [
			'new_axe_stomp/new_axe_stomp/new_axe_stomp',
			'new_axe_stomp/new_axe_stomp_bottom/new_axe_stomp_bottom'
		],
		hitEffectId: 'new_axe_stomp/new_axe_stomp_hit/new_axe_stomp_hit'
	},
	MT_RUSH_QUAKE: {
		successEffectId: [
			'new_rush_quake/new_rush_quake/new_rush_quake',
			'new_rush_quake/new_rush_quake_bottom/new_rush_quake'
		],
		hitEffectId: 'new_rush_quake/new_rush_quake_hit/new_rush_quake_hit'
	},
	MT_D_MACHINE: {
		beginCastEffectId: [
			'new_d_machine/new_d_machine_cast/new_d_machine_cast',
			'new_d_machine/new_d_machine_cast_bottom/new_d_machine_cast_bottom'
		],
		effectId: 'new_d_machine/new_d_machine/new_d_machine'
	},
	AG_DEADLY_PROJECTION: {
		beginCastEffectId: 'deadly_projection/deadly_projection_cast/deadly_projection_cast',
		hitEffectId: 'deadly_projection/deadly_projection_hit/deadly_projection_hit'
	},
	AG_DESTRUCTIVE_HURRICANE: {
		beginCastEffectId: 'destructive_hurricane/destructive_hurricane_cast/destructive_hurricane_cast',
		hitEffectId: 'destructive_hurricane/destructive_hurricane_hit/destructive_hurricane_hit'
	},
	AG_MYSTERY_ILLUSION: {
		beginCastEffectId: 'mystery_illusion/mystery_illusion_cast/mystery_illusion_cast',
		hitEffectId: 'mystery_illusion/mystery_illusion_hit/mystery_illusion_hit'
	},
	AG_VIOLENT_QUAKE: {
		beginCastEffectId: 'violentquake/violentquake_cast/violentquake_cast'
	},
	AG_VIOLENT_QUAKE_ATK: {
		groundCastEffectId: 'violentquake/violentquake/violentquake_01',
		hitEffectId: 'violentquake/violentquake_hit/violentquake_hit'
	},
	AG_SOUL_VC_STRIKE: { hitEffectId: 'soul_vc_strike/soul_vc_strike_hit/soul_vc_strike_hit' },
	AG_STRANTUM_TREMOR: { hitEffectId: 'strantumtremor/strantumtremor_hit/strantumtremor_hit' },
	AG_ALL_BLOOM: { beginCastEffectId: 'allbloom/allbloom_cast/allbloom_cast' },
	AG_ALL_BLOOM_ATK: {
		groundCastEffectId: 'allbloom/allbloom_bomb/allbloom_bomb01',
		hitEffectId: 'allbloom/allbloom_hit/allbloom_hit'
	},
	AG_ALL_BLOOM_ATK2: {
		groundCastEffectId: 'allbloom/allbloom_bomb/allbloom_bomb02',
		hitEffectId: 'allbloom/allbloom_hit/allbloom_hit'
	},
	AG_CRYSTAL_IMPACT: { hitEffectId: 'crystal_impact/crystal_impact_hit/crystal_impact_hit' },
	AG_TORNADO_STORM: { hitEffectId: 'tornadostorm/tornadostorm_hit/tornadostorm_hit' },
	AG_ASTRAL_STRIKE: {
		beginCastEffectId: 'astralstrike/astralstrike_cast/astralstrike_cast',
		groundCastEffectId: 'astralstrike/astralstrike/astralstrike'
	},
	AG_ASTRAL_STRIKE_ATK: { hitEffectId: 'astralstrike/astralstrike_sub_1/astralstrike_sub_1' },
	AG_CRIMSON_ARROW_ATK: { hitEffectId: 'crimsonarrow/crimsonarrow_hit/crimsonarrow_hit' },
	AG_CRYSTAL_IMPACT_ATK: { hitEffectId: 'crystal_impact/crystal_impact_hit/crystal_impact_hit' },
	AG_DESTRUCTIVE_HURRICANE_CLIMAX: { hitEffectId: 'destructive_hurricane/destructive_hurricane_hit/destructive_hurricane_hit' },
	AG_CLIMAX: { effectId: 'climax/climax/climax' },
	AG_ROCK_DOWN: { hitEffectId: 'rockdown/rockdown_hit/rockdown_hit' },
	AG_STORM_CANNON: { hitEffectId: 'stormcannon/stormcannon/stormcannon' },
	AG_CRIMSON_ARROW: { hitEffectId: 'crimsonarrow/crimsonarrow_hit/crimsonarrow_hit' },
	AG_FROZEN_SLASH: { hitEffectId: 'frozen_slash/frozen_slash_hit/frozen_slash_hit' },
	AG_RAIN_OF_CRYSTAL: {
		beginCastEffectId: [
			'rain_of_crystal/rain_of_crystal_casting/rain_of_crystal_casting',
			'rain_of_crystal/rain_of_crystal_casting_bottom/rain_of_crystal_casting_bottom'
		]
	},
	CD_DILECTIO_HEAL: {
		beginCastEffectId: ['new_dilectioheal/new_dilectioheal_cast/new_dilectioheal_cast', 'new_dilectioheal/new_dilectioheal_cast_bottom/new_dilectioheal_cast_bottom'],
		effectId: ['new_dilectioheal/new_dilectioheal_target/new_dilectioheal_target', 'new_dilectioheal/new_dilectioheal_target_bottom/new_dilectioheal_target_bottom']
	},
	CD_MEDIALE_VOTUM: { effectId: 'medialevotum/medialevotum/medialevotum' },
	CD_ARGUTUS_VITA: { effectId: 'argutusvita/argutusvita/argutusvita' },
	CD_ARGUTUS_TELUM: { effectId: 'argutustelum/argutustelum/argutustelum' },
	CD_ARBITRIUM: { hitEffectId: 'arbitrium/arbitrium_hit/arbitrium_hit' },
	CD_PRESENS_ACIES: { effectId: 'presensacies/presensacies/presensacies' },
	CD_EFFLIGO: { hitEffectId: 'effligo/effligo_hit/effligo_hit' },
	CD_COMPETENTIA: { effectId: 'competentia/competentia/competentia' },
	CD_PNEUMATICUS_PROCELLA: {
		beginCastEffectId: 'pneumaticusprocella/pneumaticusprocella_cast/pneumaticusprocella_cast',
		hitEffectId: 'pneumaticusprocella/pneumaticusprocella_target/pneumaticusprocella_target'
	},
	CD_RELIGIO: { effectId: 'religio/religio/religio' },
	CD_BENEDICTUM: { effectId: 'benedictum/benedictum/benedictum' },
	CD_PETITIO: { hitEffectId: 'petitio/petitio/petitio' },
	CD_REPARATIO: {
		beginCastEffectId: [
			'new_reparatio/new_reparatio_cast/new_reparatio_cast',
			'new_reparatio/new_reparatio_cast_bottom/new_reparatio_cast_bottom'
		],
		effectId: [
			'new_reparatio/new_reparatio_target/new_reparatio_target',
			'new_reparatio/new_reparatio_target_bottom/new_reparatio_target_bottom'
		]
	},
	WH_WIND_SIGN: { effectId: 'windsign/windsign/windsign' },
	WH_HAWKRUSH: { hitEffectId: 'hawkrush/hawkrush/hawkrush' },
	WH_GALESTORM: {
		beginCastEffectId: 'galestorm/galestorm_cast/galestorm_cast',
		successEffectId: 'galestorm/galestorm/galestorm',
		beforeHitEffectId: { files: 'galestorm/galestorm_arrow/galestorm_arrow', travelsFromOther: true },
		hitEffectId: 'galestorm/galestorm_hit/galestorm_hit'
	},
	WH_CRESCIVE_BOLT: {
		beginCastEffectId: 'crescivebolt/crescivebolt_cast/crescivebolt_cast',
		beforeHitEffectId: { files: 'crescivebolt/crescivebolt/crescivebolt', travelsFromOther: true },
		hitEffectId: 'crescivebolt/crescivebolt_hit/crescivebolt_hit'
	},
	WH_DEEPBLINDTRAP: {
		beginCastEffectId: 'deepblindtrap/deepblindtrap_cast/deepblindtrap_cast',
		hitEffectId: 'deepblindtrap/deepblindtrap_hit/deepblindtrap_hit'
	},
	WH_SOLIDTRAP: {
		beginCastEffectId: 'solidtrap/solidtrap_cast/solidtrap_cast',
		hitEffectId: 'solidtrap/solidtrap_hit/solidtrap_hit'
	},
	WH_SWIFTTRAP: {
		beginCastEffectId: 'swifttrap/swifttrap_cast/swifttrap_cast',
		hitEffectId: 'swifttrap/swifttrap_hit/swifttrap_hit'
	},
	WH_FLAMETRAP: {
		beginCastEffectId: 'flametrap/flametrap_cast/flametrap_cast',
		hitEffectId: 'flametrap/flametrap_hit/flametrap_hit'
	},
	IG_GUARD_STANCE: { effectId: 'guard_stance/guard_stance/guard_stance' },
	IG_REBOUND_SHIELD: { effectId: 'rebound_shield/rebound_shield/rebound_shield' },
	IG_ATTACK_STANCE: { effectId: 'attack_stance/attack_stance/attack_stance' },
	IG_HOLY_SHIELD: { effectId: 'holy_shield/holy_shield/holy_shield' },
	IG_GRAND_JUDGEMENT: { hitEffectId: 'grand_judgement/grand_judgement/grand_judgement' },
	IG_JUDGEMENT_CROSS: { hitEffectId: 'judgement_cross/judgement_cross/judgement_cross' },
	IG_SHIELD_SHOOTING: { hitEffectId: 'shield_shooting/shield_shooting_hit/shield_shooting_hit' },
	IG_OVERSLASH: { hitEffectId: 'overslash/overslash_hit/overslash_hit' },
	IG_CROSS_RAIN: {
		beginCastEffectId: [
			'crossrain/cross_rain_cast/cross_rain_cast',
			'crossrain/cross_rain_cast_bottom/cross_rain_cast_bottom'
		]
	},
	IG_ULTIMATE_SACRIFICE: {
		effectId: [
			'ultimate_sacrifice/ultimatesacrifice/ultimatesacrifice',
			'ultimate_sacrifice/ultimatesacrifice_bottom/ultimatesacrifice_bottom',
			'ultimate_sacrifice/ultimatesacrifice_shine/ultimatesacrifice_shine'
		]
	},
	ABC_ABYSS_DAGGER: {
		successEffectId: 'abyss_dagger/abyss_dagger/abyss_dagger',
		hitEffectId: 'abyss_dagger/abyss_dagger_hit/abyss_dagger_hit'
	},
	ABC_UNLUCKY_RUSH: {
		successEffectIdOnCaster: 'unlucky_rush/unlucky_rush_cast/unlucky_rush_cast',
		hitEffectId: 'unlucky_rush/unlucky_rush_hit/unlucky_rush_hit'
	},
	ABC_CHAIN_REACTION_SHOT: {
		beginCastEffectId: [
			'chain_reaction_shot/chain_reaction_shot_cast/chain_reaction_shot_cast',
			'chain_reaction_shot/chain_reaction_shot_cast_bottom/chain_reaction_shot_cast_bottom'
		],
		beforeHitEffectId: 'chain_reaction_shot/chain_reaction_shot/chain_reaction_shot',
		hitEffectId: 'chain_reaction_shot/chain_reaction_shot_hit/chain_reaction_shot_hit'
	},
	ABC_CHAIN_REACTION_SHOT_ATK: {
		hitEffectId: 'chain_reaction_shot/chain_reaction_shot_hitsub/chain_reaction_shot_hitsub'
	},
	ABC_FROM_THE_ABYSS: {
		effectId: 'from_the_abyss/from_the_abyss_shadowball_create/from_the_abyss_shadowball_create'
	},
	ABC_FROM_THE_ABYSS_ATK: { hitEffectId: 'from_the_abyss/from_the_abyss_attack/from_the_abyss_attack' },
	ABC_ABYSS_SLAYER: {
		beginCastEffectId: [
			'4abc_abyss_slayer/abyss_slayer_cast/abyss_slayer_cast',
			'4abc_abyss_slayer/abyss_slayer_cast_bottom/abyss_slayer_cast_bottom'
		],
		effectId: '4abc_abyss_slayer/abyss_slayer/abyss_slayer'
	},
	ABC_ABYSS_STRIKE: {
		beginCastEffectId: [
			'abyss_strike/abyss_strike_cast/abyss_strike_cast',
			'abyss_strike/abyss_strike_cast_bottom/abyss_strike_cast_bottom'
		],
		groundCastEffectId: [
			'abyss_strike/abyss_strike/abyss_strike',
			'abyss_strike/abyss_strike_bottom/abyss_strike_bottom',
			'abyss_strike/abyss_strike_ground/abyss_strike_ground',
			'abyss_strike/abyss_strike_ground_bottom/abyss_strike_ground_bottom'
		],
		hitEffectId: 'abyss_strike/abyss_strike_hit/abyss_strike_hit'
	},
	ABC_DEFT_STAB: { hitEffectId: 'deft_stab/deft_stab/deft_stab' },
	ABC_ABYSS_SQUARE: { hitEffectId: 'abyss_square/abyss_square_hit/abyss_square_hit' },
	ABC_FRENZY_SHOT: {
		beforeHitEffectId: 'frenzy_shot/frenzy_shot/frenzy_shot',
		hitEffectId: 'frenzy_shot/frenzy_shot_hit/frenzy_shot_hit'
	},
	BO_ACIDIFIED_ZONE_WATER: {
		beginCastEffectId: [
			'acidified_zone_water/acidified_zone_water_cast/acidified_zone_water_cast',
			'acidified_zone_water/acidified_zone_water_cast_bottom/acidified_zone_water_cast_bottom'
		],
		hitEffectId: 'acidified_zone_water/acidified_zone_water_hit/acidified_zone_water_hit'
	},
	BO_ACIDIFIED_ZONE_GROUND: {
		beginCastEffectId: [
			'acidified_zone_ground/acidified_zone_ground_cast/acidified_zone_ground_cast',
			'acidified_zone_ground/acidified_zone_ground_cast_bottom/acidified_zone_ground_cast_bottom'
		],
		hitEffectId: 'acidified_zone_ground/acidified_zone_ground_hit/acidified_zone_ground_hit'
	},
	BO_ACIDIFIED_ZONE_WIND: {
		beginCastEffectId: [
			'acidified_zone_wind/acidified_zone_wind_cast/acidified_zone_wind_cast',
			'acidified_zone_wind/acidified_zone_wind_cast_bottom/acidified_zone_wind_cast_bottom'
		],
		hitEffectId: 'acidified_zone_wind/acidified_zone_wind_hit/acidified_zone_wind_hit'
	},
	BO_ACIDIFIED_ZONE_FIRE: {
		beginCastEffectId: [
			'acidified_zone_fire/acidified_zone_fire_cast/acidified_zone_fire_cast',
			'acidified_zone_fire/acidified_zone_fire_cast_bottom/acidified_zone_fire_cast_bottom'
		],
		hitEffectId: 'acidified_zone_fire/acidified_zone_fire_hit/acidified_zone_fire_hit'
	},
	BO_RESEARCHREPORT: { effectId: 'research_report/researchreport/researchreport' },
	BO_WOODEN_FAIRY: {
		beginCastEffectId: [
			'wooden_fairy/wooden_cast/wooden_cast',
			'wooden_fairy/wooden_cast_bottom/wooden_cast_bottom'
		],
		effectId: 'wooden_fairy/fairy_dusty/fairy_dusty'
	},
	BO_HELLTREE: {
		beginCastEffectId: [
			'helltree/helltree_cast/helltree_cast',
			'helltree/helltree_cast_bottom/helltree_cast_bottom'
		],
		effectId: 'helltree/hell_dusty/hell_dusty'
	},
	EM_SPELL_ENCHANTING: { effectId: 'spell_enchanting/spell_enchanting/spell_enchanting' },
	EM_INCREASING_ACTIVITY: {
		beginCastEffectId: [
			'increasing_activity/increasing_activity_cast/increasing_activity_cast',
			'increasing_activity/increasing_activity_cast_bottom/increasing_activity_cast_bottom'
		],
		effectId: 'increasing_activity/increasing_activity/increasing_activity'
	},
	EM_ACTIVITY_BURN: {
		beginCastEffectId: [
			'activity_burn/activity_burn_cast/activity_burn_cast',
			'activity_burn/activity_burn_cast_bottom/activity_burn_cast_bottom'
		],
		effectId: 'activity_burn/activity_burn/activity_burn'
	},
	EM_TERRA_DRIVE: {
		beginCastEffectId: ['terradrive/terradrive_cast/terradrive_cast', 'terradrive/terradrive_cast_bottom/terradrive_cast_bottom'],
		groundCastEffectId: ['terradrive/terradrive/terradrive', 'terradrive/terradrive_bottom/terradrive_bottom'],
		hitEffectId: 'terradrive/terradrive_hit/terradrive_hit'
	},
	EM_DIAMOND_STORM: {
		beginCastEffectId: [
			'diamond_storm/diamond_storm_cast/diamond_storm_cast',
			'diamond_storm/diamond_storm_cast_bottom/diamond_storm_cast_bottom'
		],
		groundCastEffectId: [
			'diamond_storm/diamond_storm/diamond_storm',
			'diamond_storm/diamond_storm_bottom/diamond_storm_bottom'
		],
		hitEffectId: 'diamond_storm/diamond_storm_hit/diamond_storm_hit'
	},
	EM_LIGHTNING_LAND: {
		beginCastEffectId: [
			'lightning_land/lightning_land_cast/lightning_land_cast',
			'lightning_land/lightning_land_cast_bottom/lightning_land_cast_bottom'
		],
		hitEffectId: 'lightning_land/lightning_land_hit/lightning_land_hit'
	},
	EM_VENOM_SWAMP: {
		beginCastEffectId: [
			'venom_swamp/venom_swamp_cast/venom_swamp_cast',
			'venom_swamp/venom_swamp_cast_bottom/venom_swamp_cast_bottom'
		],
		hitEffectId: 'venom_swamp/venom_swamp_hit/venom_swamp_hit'
	},
	EM_CONFLAGRATION: {
		beginCastEffectId: [
			'conflagration/conflagration_cast/conflagration_cast',
			'conflagration/conflagration_cast_bottom/conflagration_cast_bottom'
		],
		hitEffectId: 'conflagration/conflagration_hit/conflagration_hit'
	},
	EM_ELEMENTAL_BUSTER: { beginCastEffectId: 'elemental_buster/elemental_buster_cast/elemental_buster_cast' },
	EM_ELEMENTAL_BUSTER_FIRE: {
		successEffectId: [
			'elemental_buster/elemental_buster/elemental_buster_fire/elemental_buster_fire',
			'elemental_buster/elemental_buster/elemental_buster_fire_bottom/elemental_buster_fire_bottom'
		],
		hitEffectId: 'elemental_buster/elemental_buster_hit/elemental_buster_fire_hit/elemental_buster_fire_hit'
	},
	EM_ELEMENTAL_BUSTER_WATER: {
		successEffectId: [
			'elemental_buster/elemental_buster/elemental_buster_water/elemental_buster_water',
			'elemental_buster/elemental_buster/elemental_buster_water_bottom/elemental_buster_water_bottom'
		],
		hitEffectId: 'elemental_buster/elemental_buster_hit/elemental_buster_water_hit/elemental_buster_water_hit'
	},
	EM_ELEMENTAL_BUSTER_WIND: {
		successEffectId: [
			'elemental_buster/elemental_buster/elemental_buster_wind/elemental_buster_wind',
			'elemental_buster/elemental_buster/elemental_buster_wind_bottom/elemental_buster_wind_bottom'
		],
		hitEffectId: 'elemental_buster/elemental_buster_hit/elemental_buster_wind_hit/elemental_buster_wind_hit'
	},
	EM_ELEMENTAL_BUSTER_GROUND: {
		successEffectId: [
			'elemental_buster/elemental_buster/elemental_buster_land/elemental_buster_land',
			'elemental_buster/elemental_buster/elemental_buster_land_bottom/elemental_buster_land_bottom'
		],
		hitEffectId: 'elemental_buster/elemental_buster_hit/elemental_buster_land_hit/elemental_buster_land_hit'
	},
	EM_ELEMENTAL_BUSTER_POISON: {
		successEffectId: [
			'elemental_buster/elemental_buster/elemental_buster_poison/elemental_buster_poison',
			'elemental_buster/elemental_buster/elemental_buster_poison_bottom/elemental_buster_poison_bottom'
		],
		hitEffectId: 'elemental_buster/elemental_buster_hit/elemental_buster_poison_hit/elemental_buster_poison_hit'
	},
	IQ_JUDGE: {
		effectId: ['4ig_judge/judge_start/judge_start', '4ig_judge/judge/judge', '4ig_judge/judge_aura/judge_aura']
	},
	TR_MYSTIC_SYMPHONY: {
		beginCastEffectId: 'mysticsymphony/mysticsymphony_cast/mysticsymphony_cast',
		successEffectId: 'mysticsymphony/mysticsymphony/mysticsymphony'
	},
	TR_KVASIR_SONATA: {
		beginCastEffectId: ['4tr_kvasirsonata/kvasirsonata_cast/kvasirsonata_cast', '4tr_kvasirsonata/kvasirsonata_cast_bottom/kvasirsonata_cast_bottom'],
		successEffectId: '4tr_kvasirsonata/kvasirsonata/kvasirsonata'
	},
	TR_NIPELHEIM_REQUIEM: {
		beginCastEffectId: 'nipelheim/nipelheim_cast/nipelheim_cast',
		successEffectId: 'nipelheim/nipelheim/nipelheim'
	},
	TR_PRON_MARCH: {
		beginCastEffectId: ['pronmarch/pronmarch_cast/pronmarch_cast', 'pronmarch/pronmarch_cast_bottom/pronmarch_cast_bottom'],
		successEffectId: 'pronmarch/pronmarch/pronmarch'
	},
	TR_METALIC_FURY: { hitEffectId: 'metalicfury/metalicfury/metalicfury' },
	TR_ROSEBLOSSOM: {
		beginCastEffectId: [
			'roseblossom/roseblossom_cast/roseblossom_cast',
			'roseblossom/roseblossom_cast_bottom/roseblossom_cast_bottom'
		],
		beforeHitEffectId: 'roseblossom/roseblossom_shot/roseblossom_shot',
		hitEffectId: 'roseblossom/roseblossom_hit/roseblossom_hit'
	},
	TR_ROSEBLOSSOM_ATK: { hitEffectId: 'roseblossom/roseblossom_rose/roseblossom_rose' },
	TR_RHYTHMSHOOTING: {
		beginCastEffectId: [
			'rhythmshooting/rhythmshooting_cast/rhythmshooting_cast',
			'rhythmshooting/rhythmshooting_cast_bottom/rhythmshooting_cast_bottom'
		],
		beforeHitEffectId: 'rhythmshooting/rhythmshooting_shot/rhythmshooting_shot',
		hitEffectId: 'rhythmshooting/rhythmshooting_hit/rhythmshooting_hit'
	},
	TR_SOUNDBLEND: {
		beginCastEffectId: [
			'soundblend/soundblend_cast/soundblend_cast',
			'soundblend/soundblend_cast_bottom/soundblend_cast_bottom'
		],
		effectId: ['soundblend/soundblend/soundblend', 'soundblend/soundblend_red/soundblend_red']
	},
	TR_AIN_RHAPSODY: {
		beginCastEffectId: 'ain_rhapsody/ain_rhapsody_cast/ain_rhapsody_cast',
		effectId: 'ain_rhapsody/ain_rhapsody/ain_rhapsody'
	},
	TR_GEF_NOCTURN: {
		beginCastEffectId: [
			'gef_nocturn/gef_nocturn_cast/gef_nocturn_cast',
			'gef_nocturn/gef_nocturn_cast_bottom/gef_nocturn_cast_bottom'
		],
		effectId: 'gef_nocturn/gef_nocturn/gef_nocturn'
	},
	TR_ROKI_CAPRICCIO: {
		beginCastEffectId: [
			'roki_capriccio/roki_capriccio_cast/roki_capriccio_cast',
			'roki_capriccio/roki_capriccio_cast_bottom/roki_capriccio_cast_bottom'
		],
		effectId: 'roki_capriccio/roki_capriccio/roki_capriccio'
	},
	TR_MUSICAL_INTERLUDE: {
		beginCastEffectId: 'musical_interlude/musical_interlude_cast/musical_interlude_cast',
		effectId: 'musical_interlude/musical_interlude/musical_interlude'
	},
	TR_JAWAII_SERENADE: {
		beginCastEffectId: [
			'jawaii_serenade/jawaii_serenade_cast/jawaii_serenade_cast',
			'jawaii_serenade/jawaii_serenade_cast_bottom/jawaii_serenade_cast_bottom'
		],
		effectId: 'jawaii_serenade/jawaii_serenade/jawaii_serenade'
	},
	HN_JUPITEL_THUNDER_STORM: {
		beforeHitEffectId:
			'hyper_novice/hn_jupitel_thunder_storm/jupitel_thunder_storm_ball/jupitel_thunder_storm_ball',
		hitEffectId: [
			'hyper_novice/hn_jupitel_thunder_storm/jupitel_thunder_storm/jupitel_thunder_storm_00',
			'hyper_novice/hn_jupitel_thunder_storm/jupitel_thunder_storm/jupitel_thunder_storm_01',
			'hyper_novice/hn_jupitel_thunder_storm/jupitel_thunder_storm/jupitel_thunder_storm_02'
		]
	},
	MT_SUMMON_ABR_BATTLE_WARIOR: {
		beginCastEffectId: 'new_battle_w/new_battle_w_cast/new_battle_w_cast',
		effectId: ['new_battle_w/new_battle_w/new_battle_w', 'new_battle_w/new_battle_w_bottom/new_battle_w_bottom']
	}
};

export const fourthJobStatusEffectResources = {
	[StatusConst.FIRE_CHARM_POWER]: {
		name: 'FIRE_CHARM_POWER',
		files: [
			'SHINKIRO_SHIRANUI/SS_FOUR_CHARM/four_charm_fire/four_charm_fire',
			'SHINKIRO_SHIRANUI/SS_FOUR_CHARM/four_charm_fire_bottom/four_charm_fire_bottom'
		],
		attachedEntity: true,
		repeat: false
	},
	[StatusConst.WATER_CHARM_POWER]: {
		name: 'WATER_CHARM_POWER',
		files: [
			'SHINKIRO_SHIRANUI/SS_FOUR_CHARM/four_charm_ice/four_charm_ice',
			'SHINKIRO_SHIRANUI/SS_FOUR_CHARM/four_charm_ice_bottom/four_charm_ice_bottom'
		],
		attachedEntity: true,
		repeat: false
	},
	[StatusConst.WIND_CHARM_POWER]: {
		name: 'WIND_CHARM_POWER',
		files: [
			'SHINKIRO_SHIRANUI/SS_FOUR_CHARM/four_charm_wind/four_charm_wind',
			'SHINKIRO_SHIRANUI/SS_FOUR_CHARM/four_charm_wind_bottom/four_charm_wind_bottom'
		],
		attachedEntity: true,
		repeat: false
	},
	[StatusConst.GROUND_CHARM_POWER]: {
		name: 'GROUND_CHARM_POWER',
		files: [
			'SHINKIRO_SHIRANUI/SS_FOUR_CHARM/four_charm_earth/four_charm_earth',
			'SHINKIRO_SHIRANUI/SS_FOUR_CHARM/four_charm_earth_bottom/four_charm_earth_bottom'
		],
		attachedEntity: true,
		repeat: false
	},
	[StatusConst.MYSTERY_POWDER]: {
		name: 'MYSTERY_POWDER',
		files: [
			'BIOLO/BO_MYSTERY_POWDER/mistery_powder_loop/mistery_powder_loop',
			'BIOLO/BO_MYSTERY_POWDER/mistery_powder_loop_bottom/mistery_powder_loop_bottom'
		],
		attachedEntity: true,
		repeat: true
	}
};

// Ground ticks have distinct server skill IDs; only reuse the victim impact.
for (const element of ['WATER', 'GROUND', 'WIND', 'FIRE']) {
	const name = `BO_ACIDIFIED_ZONE_${element}`;
	fourthJobEffectResources[`${name}_ATK`] = { hitEffectId: fourthJobEffectResources[name].hitEffectId };
}

export const fourthJobSkillEffects = {};
export const fourthJobRenderEffects = {};
export const fourthJobStatusEffects = {};

function registerEffect(key, resources) {
	const descriptor = typeof resources === 'object' && !Array.isArray(resources) ? resources : { files: resources };
	const { files, ...semantics } = descriptor;
	delete semantics.name;
	fourthJobRenderEffects[key] = [files].flat().map(file => ({
		type: 'STR',
		file,
		texturePath: file.slice(0, file.lastIndexOf('/') + 1),
		...effectMetadata[file],
		...semantics
	}));
}

for (const [skill, stages] of Object.entries(fourthJobEffectResources)) {
	if (!Number.isInteger(SK[skill])) throw new Error(`Unknown fourth-job effect skill: ${skill}`);
	const mapping = {};
	for (const [stage, resources] of Object.entries(stages)) {
		const key = `fourth:${skill}:${stage}`;
		mapping[stage] = key;
		registerEffect(key, resources);
	}
	fourthJobSkillEffects[SK[skill]] = mapping;
}

for (const [status, resources] of Object.entries(fourthJobStatusEffectResources)) {
	const key = `fourth:status:${resources.name}`;
	fourthJobStatusEffects[status] = key;
	registerEffect(key, resources);
}
