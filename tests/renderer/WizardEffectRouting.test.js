import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('Renderer/EntityManager.js', () => ({ default: {} }));
import SK from '../../src/DB/Skills/SkillConst.js';
import SkillEffect from '../../src/DB/Skills/SkillEffect.js';

// Execute the production routing methods without booting WebGL or the map.
const source = readFileSync('src/Renderer/EffectManager.js', 'utf8').replaceAll('\r\n', '\n');
function routing() {
	const spam = vi.fn();
	const methods = ['spamSkill', 'spamSkillSuccess', 'spamSkillHit'].map(name => {
		const start = source.indexOf(`static ${name}(`);
		const end = source.indexOf('\n\t/**', start);
		return source.slice(start, end);
	}).join('\n');
	const Router = new Function('SkillEffect', 'EffectManager', `return class { ${methods} }`)(SkillEffect, { spam });
	return { Router, spam };
}

describe('wizard packet effect routing', () => {
	it.each(['MG_THUNDERSTORM', 'WL_FROSTMISTY', 'WZ_METEOR', 'WZ_HEAVENDRIVE', 'WL_COMET', 'AG_ASTRAL_STRIKE', 'AG_ALL_BLOOM_ATK', 'AG_ALL_BLOOM_ATK2', 'AG_VIOLENT_QUAKE_ATK'])(
		'%s plays the area burst only for a coordinate notification', name => {
			const { Router, spam } = routing();
			Router.spamSkill(SK[name], 1, [10, 20, 0], 1000, 1);
			expect(spam).toHaveBeenCalledOnce();
			expect(spam.mock.calls[0][0]).toMatchObject({ position: [10, 20, 0], fixedPosition: true });
			spam.mockClear();
			for (const target of [2, 3, 4]) Router.spamSkill(SK[name], target, null, 1000, 1);
			expect(spam).not.toHaveBeenCalled();
		}
	);

	it.each(['WL_SOULEXPANSION', 'WL_JACKFROST', 'WL_TETRAVORTEX_WIND', 'WL_SUMMON_ATK_FIRE',
		'AG_CRIMSON_ARROW_ATK', 'AG_ASTRAL_STRIKE_ATK', 'AG_CRYSTAL_IMPACT_ATK', 'AG_DESTRUCTIVE_HURRICANE_CLIMAX'])(
		'%s resolves its actual damage packet to a target impact', name => {
			const { Router, spam } = routing();
			Router.spamSkillHit(SK[name], 2, 1000, 1);
			expect(spam).toHaveBeenCalledOnce();
			expect(spam.mock.calls[0][0]).toMatchObject({ ownerAID: 2, startTick: 1000, otherAID: 1 });
		}
	);

	it('plays Hell Inferno once on success instead of on each fire/dark damage packet', () => {
		const { Router, spam } = routing();
		Router.spamSkillSuccess(SK.WL_HELLINFERNO, 2, 1000, 1);
		Router.spamSkill(SK.WL_HELLINFERNO, 2, null, 1000, 1);
		Router.spamSkill(SK.WL_HELLINFERNO, 2, null, 1300, 1);
		expect(spam).toHaveBeenCalledExactlyOnceWith({ effectId: 728, ownerAID: 2, startTick: 1000, otherAID: 1 });
	});
});
