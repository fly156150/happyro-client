import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('DB/Effects/EffectTable.js', () => ({ default: {} }));
vi.mock('DB/Skills/SkillEffect.js', () => ({ default: {} }));
vi.mock('DB/Skills/SkillUnit.js', () => ({ default: {} }));
vi.mock('DB/Skills/SkillUnitConst.js', () => ({ default: {} }));
vi.mock('DB/Skills/FourthJobGroundEffects.js', () => ({ fourthJobGroundEndEffects: {} }));
vi.mock('DB/Items/ItemEffect.js', () => ({ default: {} }));
vi.mock('Controls/ProcessCommand.js', () => ({ default: {} }));
vi.mock('Core/Events.js', () => ({ default: {} }));
vi.mock('Core/Configs.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/Cylinder.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/StrEffect.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/RsmEffect.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/TwoDEffect.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/ThreeDEffect.js', () => ({ default: {} }));
vi.mock('Renderer/Entity/Entity.js', () => ({ default: {} }));
vi.mock('Renderer/EntityManager.js', () => ({ default: {} }));
vi.mock('Renderer/Renderer.js', () => ({ default: {} }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: {} }));
vi.mock('Audio/SoundManager.js', () => ({ default: {} }));
vi.mock('Preferences/Map.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/QuadHorn.js', () => ({ default: {} }));
vi.mock('Engine/SessionStorage.js', () => ({ default: {} }));
vi.mock('Preferences/Graphics.js', () => ({ default: {} }));

import EffectManager from '../../src/Renderer/EffectManager.js';
import SkillEffect from '../../src/DB/Skills/SkillEffect.js';
import SK from '../../src/DB/Skills/SkillConst.js';
import { fourthJobSkillEffects } from '../../src/DB/Skills/FourthJobEffects.js';
Object.assign(SkillEffect, fourthJobSkillEffects);
afterEach(() => vi.restoreAllMocks());

describe('fourth-job packet effect stages', () => {
 it('draws Midnight Fallen at the ground notification position, without replaying it on damage', () => {
  const spam = vi.spyOn(EffectManager, 'spam').mockImplementation(() => {});
  EffectManager.spamSkill(SK.NW_MIDNIGHT_FALLEN, 1, [120, 130, 0], 1000, 1);
  expect(spam).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
   effectId: fourthJobSkillEffects[SK.NW_MIDNIGHT_FALLEN].groundCastEffectId,
   position: [120, 130, 0]
  }));
  spam.mockClear();
  EffectManager.spamSkill(SK.NW_MIDNIGHT_FALLEN, 2, null, 1200, 1);
  expect(spam).not.toHaveBeenCalled();
 });
 it('plays Dancing Knife activation once without replaying it for periodic victims', () => {
  const spam = vi.spyOn(EffectManager, 'spam').mockImplementation(() => {});
  EffectManager.spamSkill(SK.SHC_DANCING_KNIFE, 1, null, 1000, 1);
  EffectManager.spamSkillSuccess(SK.SHC_DANCING_KNIFE, 1, 1000, 1);
  expect(spam).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
   effectId: fourthJobSkillEffects[SK.SHC_DANCING_KNIFE].successEffectId,
   ownerAID: 1
  }));
  spam.mockClear();
  for (const tick of [1300, 1600, 1900]) {
   for (const victim of [2, 3, 4]) {
    EffectManager.spamSkill(SK.SHC_DANCING_KNIFE, victim, null, tick, 1);
    EffectManager.spamSkillHit(SK.SHC_DANCING_KNIFE, victim, tick, 1);
   }
  }
  expect(spam).toHaveBeenCalledTimes(9);
  expect(spam.mock.calls.every(([effect]) =>
   effect.effectId === fourthJobSkillEffects[SK.SHC_DANCING_KNIFE].hitEffectId
  )).toBe(true);
 });

});
