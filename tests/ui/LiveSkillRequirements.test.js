import { expect, it } from 'vitest';
import Status from '../../src/DB/Status/StatusConst.js';
import StatusState from '../../src/DB/Status/StatusState.js';
import { skillRequirementReason } from '../../src/UI/Game/CombatSkillRequirements.js';
const actor = (extra = {}) => ({ hp: 100, hpMax: 100, ap: 200, weapons: ['Fist'], effects: 0,
 shield: false, spiritCount: 0, soulCount: 0, zeny: 10000, ammoCount: 0, itemCount: () => 0,
 hasStatus: () => false, hasSkill: () => false, equippedItem: () => false, ...extra });
it('accepts either equipped weapon without mistaking fists for a spear', () => {
 const req={Weapon:{'1hSpear':true,'2hSpear':true}};
 expect(skillRequirementReason(req,1,actor())).toBe('武器类型不符');
 expect(skillRequirementReason(req,1,actor({weapons:['1hSword','1hSpear']}))).toBe('');
});
it('accepts dragon riding for knight riding requirements', () => {
 expect(skillRequirementReason({State:'Riding'},1,actor())).not.toBe('');
 expect(skillRequirementReason({State:'Riding'},1,actor({effects:StatusState.EffectState.DRAGON1}))).toBe('');
});
it.each(['Sunstance','Moonstance','Starstance','Universestance'])('requires the correct stance for %s', State => {
 expect(skillRequirementReason({State},1,actor())).toBe('缺少所需姿态');
 expect(skillRequirementReason({State},1,actor({hasStatus:id=>id===Status.UNIVERSESTANCE}))).toBe('');
});
it('does not confuse soul spheres with spirit spheres', () => {
 const req={SpiritSphereCost:2};
 expect(skillRequirementReason(req,1,actor({spiritCount:20}),'SP_SPA')).toBe('灵魂球不足');
 expect(skillRequirementReason(req,1,actor({soulCount:2}),'SP_SPA')).toBe('');
 expect(skillRequirementReason(req,1,actor({soulCount:20}),'MO_FINGEROFFENSIVE')).not.toBe('');
 expect(skillRequirementReason(req,1,actor({spiritCount:1}),'MO_FINGEROFFENSIVE')).toBe('');
});
it('uses the Renewal extra ammunition boundary', () => {
 const req={Ammo:{Arrow:true},AmmoAmount:20};
 expect(skillRequirementReason(req,1,actor({ammoType:'Arrow',ammoCount:20}),'WM_SEVERE_RAINSTORM')).toContain('弹药');
 expect(skillRequirementReason(req,1,actor({ammoType:'Arrow',ammoCount:21}),'WM_SEVERE_RAINSTORM')).toBe('');
});
it('honors explicit sphere exemptions without exempting ordinary states', () => {
 const req={SpiritSphereCost:5};
 expect(skillRequirementReason(req,1,actor(),'SR_TIGERCANNON')).not.toBe('');
 expect(skillRequirementReason(req,1,actor({hasStatus:id=>id===Status.THIRD_EXOR_FLAME}),'SR_TIGERCANNON')).toBe('');
 expect(skillRequirementReason(req,1,actor(),'DK_SERVANT_W_PHANTOM')).toBe('');
});
