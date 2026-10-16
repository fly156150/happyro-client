import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('Renderer/EntityManager.js', () => ({ default: {} }));
import SK from '../../src/DB/Skills/SkillConst.js';
import SkillEffect from '../../src/DB/Skills/SkillEffect.js';
import { sorcererRenderEffects, sorcererGroundUnits } from '../../src/DB/Skills/SorcererEffects.js';
import SU from '../../src/DB/Skills/SkillUnitConst.js';

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

describe('sorcerer packet effect stages', () => {
 it.each(['SO_EARTHGRAVE', 'SO_DIAMONDDUST', 'EM_DIAMOND_STORM', 'EM_TERRA_DRIVE'])(
  '%s draws the field at the notified position only', name => {
   const { Router, spam } = routing();
   Router.spamSkill(SK[name], 1, [12, 23, 0], 1000, 1);
   expect(spam).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    effectId: SkillEffect[SK[name]].groundCastEffectId, position: [12, 23, 0]
   }));
   spam.mockClear();
   Router.spamSkill(SK[name], 2, null, 1100, 1);
   expect(spam).not.toHaveBeenCalled();
   Router.spamSkillHit(SK[name], 2, 1100, 1);
   if (name === 'SO_DIAMONDDUST') expect(spam).not.toHaveBeenCalled();
   else expect(spam).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ effectId: SkillEffect[SK[name]].hitEffectId }));
  }
 );
 it.each(['FIRE', 'WATER', 'WIND', 'GROUND', 'POISON'])('plays %s buster once, with separate victim impacts', element => {
  const { Router, spam } = routing();
  const id = SK[`EM_ELEMENTAL_BUSTER_${element}`];
  Router.spamSkillSuccess(id, 1, 1000, 1);
  expect(spam).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ effectId: SkillEffect[id].successEffectId }));
  spam.mockClear();
  for (const victim of [2, 3, 4]) {
   Router.spamSkill(id, victim, null, 1100, 1);
   Router.spamSkillHit(id, victim, 1100, 1);
  }
  expect(spam).toHaveBeenCalledTimes(3);
  expect(spam.mock.calls.every(([effect]) => effect.effectId === SkillEffect[id].hitEffectId)).toBe(true);
 });
 it('assigns Psychic Wave visuals to the ground unit and plays sound only on the coordinate packet', () => {
  const { Router, spam } = routing();
  const layers = sorcererRenderEffects[sorcererGroundUnits[SU.UNT_PSYCHIC_WAVE]];
  expect(layers).toHaveLength(2);
  expect(layers.every(layer => layer.repeat && !layer.attachedEntity)).toBe(true);
  Router.spamSkill(SK.SO_PSYCHIC_WAVE, 1, [12, 23, 0], 1000, 1);
  expect(spam).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ effectId: 922 }));
  spam.mockClear();
  Router.spamSkill(SK.SO_PSYCHIC_WAVE, 2, null, 1100, 1);
  expect(spam).not.toHaveBeenCalled();
 });
});
