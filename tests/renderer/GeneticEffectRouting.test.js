import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('Renderer/EntityManager.js', () => ({ default: {} }));
import SK from '../../src/DB/Skills/SkillConst.js';
import SkillEffect from '../../src/DB/Skills/SkillEffect.js';
const source = readFileSync('src/Renderer/EffectManager.js', 'utf8').replaceAll('\r\n', '\n');
const methods = ['spamSkill', 'spamSkillSuccess', 'spamSkillHit'].map(name => {
 const start = source.indexOf(`static ${name}(`);
 return source.slice(start, source.indexOf('\n\t/**', start));
}).join('\n');
describe('Biolo acidified zone damage packets', () => {
 it.each(['WATER', 'GROUND', 'WIND', 'FIRE'])('%s ticks show impacts without replaying the cast', element => {
  const spam = vi.fn();
  const Router = new Function('SkillEffect', 'EffectManager', `return class { ${methods} }`)(SkillEffect, { spam });
  const base = SK[`BO_ACIDIFIED_ZONE_${element}`], tick = SK[`BO_ACIDIFIED_ZONE_${element}_ATK`];
  expect(Number.isInteger(tick)).toBe(true);
  for (const victim of [2, 3, 4]) {
   Router.spamSkill(tick, victim, null, 1000, 1);
   Router.spamSkillSuccess(tick, 1, 1000, 1);
   Router.spamSkillHit(tick, victim, 1000, 1);
  }
  expect(spam).toHaveBeenCalledTimes(3);
  expect(spam.mock.calls.every(([effect]) => effect.effectId === SkillEffect[tick].hitEffectId)).toBe(true);
  expect(SkillEffect[base].hitEffectId).toBeDefined();
 });
});

describe('Genetic activation and splash effects', () => {
 it.each([SK.GN_CART_TORNADO, SK.GN_CARTCANNON, SK.GN_MANDRAGORA, SK.MH_THE_ONE_FIGHTER_RISES, SK.MH_HEILIGE_PFERD])('plays skill %s activation once at the caster', skill => {
  const spam = vi.fn();
  const Router = new Function('SkillEffect', 'EffectManager', `return class { ${methods} }`)(SkillEffect, { spam });
  Router.spamSkillSuccess(skill, 2, 1000, 1);
  for (const victim of [2, 3, 4]) {
   Router.spamSkill(skill, victim, null, 1000, 1);
   Router.spamSkillHit(skill, victim, 1000, 1);
  }
  const casts = spam.mock.calls.map(([effect]) => effect).filter(effect => effect.effectId === SkillEffect[skill].successEffectIdOnCaster);
  expect(casts).toHaveLength(1);
  expect(casts[0].ownerAID).toBe(1);
  expect(spam).toHaveBeenCalledTimes(skill === SK.GN_CARTCANNON ? 4 : 1);
 });
 it('keeps the thorn cast at its ground coordinate and ignores subsequent damage notifications', () => {
  const spam = vi.fn();
  const Router = new Function('SkillEffect', 'EffectManager', `return class { ${methods} }`)(SkillEffect, { spam });
  Router.spamSkill(SK.GN_WALLOFTHORN, 1, [20, 30, 0], 1000, 1);
  Router.spamSkill(SK.GN_WALLOFTHORN, 2, null, 1500, 1);
  Router.spamSkillHit(SK.GN_WALLOFTHORN, 2, 1500, 1);
  expect(spam).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ position: [20, 30, 0], fixedPosition: true }));
 });
});


describe('homunculus packet effects', () => {
 it.each([SK.MH_BLAST_FORGE, SK.MH_TWISTER_CUTTER, SK.MH_ABSOLUTE_ZEPHYR,
  SK.MH_BLAZING_AND_FURIOUS, SK.MH_TOXIN_OF_MANDARA, SK.MH_NEEDLE_STINGER,
  SK.MH_GLANZEN_SPIES])('routes skill %s impacts only to the victim', skill => {
  const spam = vi.fn();
  const Router = new Function('SkillEffect', 'EffectManager', `return class { ${methods} }`)(SkillEffect, { spam });
  Router.spamSkill(skill, 2, null, 1000, 1);
  Router.spamSkillHit(skill, 2, 1000, 1);
  expect(spam).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ ownerAID: 2, otherAID: 1, effectId: SkillEffect[skill].hitEffectId }));
 });
 it('shows Goldene Tone on its receiving master rather than the homunculus', () => {
  const spam = vi.fn();
  const Router = new Function('SkillEffect', 'EffectManager', `return class { ${methods} }`)(SkillEffect, { spam });
  Router.spamSkillSuccess(SK.MH_GOLDENE_TONE, 2, 1000, 1);
  expect(spam).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ ownerAID: 2, effectId: 'genetic:tone' }));
 });
});
