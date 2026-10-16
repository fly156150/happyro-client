import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('Renderer/EntityManager.js', () => ({ default: {} }));
import SK from '../../src/DB/Skills/SkillConst.js';
import SkillEffect from '../../src/DB/Skills/SkillEffect.js';
import { monkRenderEffects } from '../../src/DB/Skills/MonkEffects.js';
const source = readFileSync('src/Renderer/EffectManager.js', 'utf8').replaceAll('\r\n', '\n');
const methods = ['spamSkill', 'spamSkillSuccess', 'spamSkillHit'].map(name => {
 const start = source.indexOf(`static ${name}(`);
 return source.slice(start, source.indexOf('\n\t/**', start));
}).join('\n');
function fixture() {
 const spam = vi.fn();
 const Router = new Function('SkillEffect', 'EffectManager', `return class { ${methods} }`)(SkillEffect, { spam });
 return { Router, spam };
}
describe('monk skill packet routing', () => {
 it.each([SK.SR_WINDMILL, SK.SR_SKYNETBLOW, SK.SR_TIGERCANNON, SK.SR_RAMPAGEBLASTER, SK.SR_HOWLINGOFLION])('plays self activation %s once and never on each splash victim', skill => {
  const { Router, spam } = fixture();
  Router.spamSkillSuccess(skill, 1, 1000, 1);
  for (const victim of [2, 3, 4]) {
   Router.spamSkill(skill, victim, null, 1000, 1);
   Router.spamSkillHit(skill, victim, 1000, 1);
  }
  const activation = [SkillEffect[skill].successEffectIdOnCaster].flat();
  const calls = spam.mock.calls.map(([effect]) => effect);
  expect(calls.filter(effect => activation.includes(effect.effectId))).toHaveLength(activation.length);
  expect(calls.filter(effect => activation.includes(effect.effectId)).every(effect => effect.ownerAID === 1)).toBe(true);
  expect(calls).toHaveLength(activation.length + (skill === SK.SR_HOWLINGOFLION ? 3 : 0));
 });
 it.each([SK.IQ_FIRST_BRAND, SK.IQ_SECOND_FAITH, SK.IQ_SECOND_FLAME, SK.IQ_SECOND_JUDGEMENT, SK.IQ_THIRD_PUNISH, SK.IQ_THIRD_FLAME_BOMB, SK.IQ_THIRD_CONSECRATION])('keeps targeted combo %s activation on the selected target', skill => {
  const { Router, spam } = fixture();
  Router.spamSkillSuccess(skill, 2, 1000, 1);
  for (const victim of [2, 3, 4]) {
   Router.spamSkill(skill, victim, null, 1000, 1);
   Router.spamSkillHit(skill, victim, 1000, 1);
  }
  expect(spam.mock.calls[0][0]).toMatchObject({ ownerAID: 2, effectId: SkillEffect[skill].successEffectId });
  expect(spam.mock.calls.filter(([e]) => e.effectId === SkillEffect[skill].successEffectId)).toHaveLength(1);
 });
 it('uses the lightning ground coordinate once rather than replaying the area for each hit', () => {
  const { Router, spam } = fixture();
  Router.spamSkill(SK.SR_RIDEINLIGHTNING, 1, [20, 30, 0], 1000, 1);
  Router.spamSkill(SK.SR_RIDEINLIGHTNING, 2, null, 1000, 1);
  expect(spam).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ position: [20, 30, 0], fixedPosition: true }));
 });
 it('does not make one-shot area animations follow a moving character', () => {
  for (const effects of Object.values(monkRenderEffects)) {
   expect(effects.every(effect => effect.attachedEntity === false && !effect.repeat)).toBe(true);
  }
 });
});
