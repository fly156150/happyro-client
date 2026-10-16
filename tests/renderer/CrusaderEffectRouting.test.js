import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('Renderer/EntityManager.js', () => ({ default: {} }));
import SK from '../../src/DB/Skills/SkillConst.js';
import SkillEffect from '../../src/DB/Skills/SkillEffect.js';
import { crusaderRenderEffects } from '../../src/DB/Skills/CrusaderEffects.js';

const source = readFileSync('src/Renderer/EffectManager.js', 'utf8').replaceAll('\r\n', '\n');
function routing() {
	const spam = vi.fn();
	const methods = ['spamSkill', 'spamSkillSuccess', 'spamSkillHit'].map(name => {
		const start = source.indexOf(`static ${name}(`);
		return source.slice(start, source.indexOf('\n\t/**', start));
	}).join('\n');
	const Router = new Function('SkillEffect', 'EffectManager', `return class { ${methods} }`)(SkillEffect, { spam });
	return { Router, spam };
}

describe('crusader notification effects', () => {
	it.each(['LG_EARTHDRIVE', 'LG_RAYOFGENESIS', 'LG_OVERBRAND'])(
		'%s emits its area/sound effect once and impacts on each victim', name => {
			const { Router, spam } = routing();
			Router.spamSkillSuccess(SK[name], 1, 1000, 1);
			expect(spam).toHaveBeenCalledOnce();
			const effectId = spam.mock.calls[0][0].effectId;
			if (name !== 'LG_OVERBRAND') {
				expect(crusaderRenderEffects[effectId].every(layer => !layer.attachedEntity)).toBe(true);
			}
			spam.mockClear();
			for (const victim of [2, 3, 4]) {
				Router.spamSkill(SK[name], victim, null, 1100, 1);
				Router.spamSkillHit(SK[name], victim, 1100, 1);
			}
			expect(spam).toHaveBeenCalledTimes(3);
			expect(spam.mock.calls.map(([effect]) => effect.ownerAID)).toEqual([2, 3, 4]);
			expect(spam.mock.calls.every(([effect]) => effect.effectId !== effectId)).toBe(true);
		}
	);

	it('Guardian Shield follows the notified party member only after success', () => {
		const { Router, spam } = routing();
		Router.spamSkill(SK.IG_GUARDIAN_SHIELD, 2, null, 1000, 1);
		expect(spam).not.toHaveBeenCalled();
		Router.spamSkillSuccess(SK.IG_GUARDIAN_SHIELD, 2, 1000, 1);
		expect(spam).toHaveBeenCalledOnce();
		const effect = spam.mock.calls[0][0];
		expect(effect).toMatchObject({ ownerAID: 2, otherAID: 1 });
		expect(crusaderRenderEffects[effect.effectId].every(layer => layer.attachedEntity)).toBe(true);
	});
});
