import SK from './SkillConst.js';

const str = (file, extra = {}) => ({
	type: 'STR', file, texturePath: file.slice(0, file.lastIndexOf('/') + 1),
	attachedEntity: false, ...extra
});
const layers = (directory, name, extra = {}) => [
	str(`${directory}/${name}/${name}`, extra),
	str(`${directory}/${name}_bottom/${name}_bottom`, { ...extra, renderBeforeEntities: true })
];

export const monkRenderEffects = {
	'monk:tiger': [str('new_tigercannon/new_tigercannon', { wav: 'effect/sr_tigercannon' })],
	'monk:rampage': layers('new_rampageblaster', 'new_rampageblaster'),
	'monk:fallen': layers('new_fallenempire', 'new_fallenempire'),
	'monk:fallen-hit': [str('new_fallenempire/new_fallenempire_hit/new_fallenempire_hit', { wav: 'effect/sr_fallenempire' })],
	'monk:gate-cast': [str('new_gateofhell/new_gateofhell_cast/new_gateofhell_cast')],
	'monk:gate-hit': [str('new_gateofhell/new_gateofhell_target/new_gateofhell_target', { wav: 'effect/sr_gateofhell' })],
	'monk:lion-cast': layers('new_howlingoflion', 'new_howlingoflion_cast'),
	'monk:lion': layers('new_howlingoflion', 'new_howlingoflion'),
	'monk:lion-hit': [str('new_howlingoflion/new_howlingoflion_hit/new_howlingoflion_hit')],
	'monk:powerful-faith': [str('powerfulfaith/powerfulfaith/powerfulfaith')],
	'monk:firm-faith': [str('firmfaith/firmfaith/firmfaith')],
	'monk:sincere-faith': layers('sincerefaith', 'sincerefaith'),
	'monk:oleum': layers('4ig_oleumsanctum', 'oleumsanctum'),
	'monk:oleum-hit': [str('4ig_oleumsanctum/oleumsanctum_hit/oleumsanctum_hit')],
	'monk:massive': [str('4iq_massivefblaster/massivefblaster/massivefblaster')],
	'monk:massive-hit': layers('4iq_massivefblaster', 'massivefblaster_hit'),
	'monk:explosion': layers('4ig_explosionblaster', 'explosionblaster'),
	'monk:explosion-hit': [str('4ig_explosionblaster/explosionblaster_hit/explosionblaster_hit')],
	'monk:first-brand': [str('4ig_firstbrand/firstbrand/firstbrand')],
	'monk:first-brand-hit': [str('4ig_firstbrand/firstbrand_hit/firstbrand_hit')],
	'monk:first-faith': [str('4ig_firstfaithpower/firstfaithpower/firstfaithpower')],
	'monk:judge': [str('4ig_judge/judge_start/judge_start'), str('4ig_judge/judge/judge')],
	'monk:second-flame': layers('4iq_secondflame', 'secondflame'),
	'monk:second-faith': [str('4ig_secondfalth/secondfalth/secondfalth')],
	'monk:second-faith-hit': [str('4ig_secondfalth/secondfalth_hit/secondfalth_hit')],
	'monk:second-judgement': [str('4iq_secondjudgement/secondjudgement/secondjudgement')],
	'monk:third-punish': layers('4iq_thirdpunish', 'thirdpunish'),
	'monk:third-flame': layers('4iq_thirdflamebomb', 'thirdflamebomb'),
	'monk:third-consecration': layers('4iq_thirdconsecration', 'thirdconsecration'),
	'monk:third-exor': [str('4ig_thirdexorflame/thirdexorflame/thirdexorflame')]
};

const success = name => ({ successEffectId: `monk:${name}` });
const caster = name => ({ successEffectIdOnCaster: `monk:${name}` });
// Self-centered activations have one success notification. Victim damage must
// not spin the victim or replay the entire caster animation for every hit.
export const monkSkillEffects = {
	[SK.SR_TIGERCANNON]: caster('tiger'),
	[SK.SR_RAMPAGEBLASTER]: { successEffectIdOnCaster: ['monk:rampage', 'ef_rampageblaster'] },
	[SK.SR_FALLENEMPIRE]: { beforeHitEffectId: 'monk:fallen', hitEffectId: 'monk:fallen-hit' },
	[SK.SR_GATEOFHELL]: { beginCastEffectId: 'monk:gate-cast', hitEffectId: 'monk:gate-hit' },
	[SK.SR_HOWLINGOFLION]: {
		beginCastEffectId: 'monk:lion-cast', successEffectIdOnCaster: ['monk:lion', 'ef_howlingoflion'], hitEffectId: 'monk:lion-hit'
	},
	[SK.SR_SKYNETBLOW]: { successEffectIdOnCaster: 'ef_skynetblow' },
	[SK.SR_WINDMILL]: { successEffectIdOnCaster: 'ef_windmill' },
	[SK.SR_RIDEINLIGHTNING]: { groundCastEffectId: 'ef_rideinlightning' },
	[SK.IQ_POWERFUL_FAITH]: success('powerful-faith'),
	[SK.IQ_FIRM_FAITH]: success('firm-faith'),
	[SK.IQ_SINCERE_FAITH]: success('sincere-faith'),
	[SK.IQ_OLEUM_SANCTUM]: { ...success('oleum'), hitEffectId: 'monk:oleum-hit' },
	[SK.IQ_MASSIVE_F_BLASTER]: { ...caster('massive'), hitEffectId: 'monk:massive-hit' },
	[SK.IQ_EXPOSION_BLASTER]: { ...success('explosion'), hitEffectId: 'monk:explosion-hit' },
	[SK.IQ_FIRST_BRAND]: { ...success('first-brand'), hitEffectId: 'monk:first-brand-hit' },
	[SK.IQ_FIRST_FAITH_POWER]: success('first-faith'),
	[SK.IQ_JUDGE]: success('judge'),
	[SK.IQ_SECOND_FLAME]: success('second-flame'),
	[SK.IQ_SECOND_FAITH]: { ...success('second-faith'), hitEffectId: 'monk:second-faith-hit' },
	[SK.IQ_SECOND_JUDGEMENT]: success('second-judgement'),
	[SK.IQ_THIRD_PUNISH]: success('third-punish'),
	[SK.IQ_THIRD_FLAME_BOMB]: success('third-flame'),
	[SK.IQ_THIRD_CONSECRATION]: success('third-consecration'),
	[SK.IQ_THIRD_EXOR_FLAME]: success('third-exor')
};
