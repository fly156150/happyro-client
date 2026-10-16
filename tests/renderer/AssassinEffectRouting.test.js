import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('Renderer/EntityManager.js', () => ({ default: {} }));
import SK from '../../src/DB/Skills/SkillConst.js';
import SkillEffect from '../../src/DB/Skills/SkillEffect.js';
import { assassinRenderEffects } from '../../src/DB/Skills/AssassinEffects.js';

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

describe('assassin notification effects', () => {
 it.each(['GC_ROLLINGCUTTER', 'GC_COUNTERSLASH'])('%s stays on the caster and never repeats on victims', name => {
  const { Router, spam } = routing();
  Router.spamSkill(SK[name], 1, null, 1000, 1);
  Router.spamSkillSuccess(SK[name], 1, 1000, 1);
  expect(spam).toHaveBeenCalledTimes(name === 'GC_ROLLINGCUTTER' ? 2 : 1);
  expect(spam.mock.calls.every(([effect]) => effect.ownerAID === 1)).toBe(true);
  const area = spam.mock.calls[0][0].effectId;
  expect(assassinRenderEffects[area].every(layer => !layer.attachedEntity)).toBe(true);
  spam.mockClear();
  for (const victim of [2, 3, 4]) {
   Router.spamSkill(SK[name], victim, null, 1100, 1);
   Router.spamSkillHit(SK[name], victim, 1100, 1);
  }
  expect(spam).not.toHaveBeenCalled();
 });
 it.each(['GC_CROSSIMPACT', 'GC_CROSSRIPPERSLASHER'])('%s plays its impact on the victim', name => {
  const { Router, spam } = routing();
  Router.spamSkill(SK[name], 2, null, 1000, 1);
  expect(spam).not.toHaveBeenCalled();
  Router.spamSkillHit(SK[name], 2, 1100, 1);
  expect(spam).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ownerAID: 2, otherAID: 1}));
 });
});
