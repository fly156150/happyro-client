import SK from './SkillConst.js';

const str = (file, extra = {}) => ({
	type: 'STR', file, texturePath: file.slice(0, file.lastIndexOf('/') + 1),
	attachedEntity: false, ...extra
});

export const assassinRenderEffects = {
	'assassin:cross-impact': [str('new_crossimpact/new_crossimpact_target/new_crossimpact_target')],
	'assassin:counter-slash': [
		str('new_counter_slash/new_counter_slash/new_counter_slash'),
		str('new_counter_slash/new_counter_slash_bottom/new_counter_slash_bottom', { renderBeforeEntities: true })
	],
	'assassin:rolling-cutter': [str('new_rollingcutter/new_rollingcutter/new_rollingcutter')],
	'assassin:ripper-hit': [str('new_crossripperslasher/new_crossripperslasher/new_crossripperslasher')]
};

// Self-centered splash attacks notify activation separately from each victim.
export const assassinSkillEffects = {
	[SK.GC_CROSSIMPACT]: { hitEffectId: 'assassin:cross-impact' },
	[SK.GC_COUNTERSLASH]: { successEffectId: 'assassin:counter-slash' },
	[SK.GC_ROLLINGCUTTER]: { successEffectId: ['assassin:rolling-cutter', 775] },
	[SK.GC_CROSSRIPPERSLASHER]: { hitEffectId: 'assassin:ripper-hit' }
};
