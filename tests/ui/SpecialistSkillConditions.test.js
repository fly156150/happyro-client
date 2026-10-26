import { expect, it } from 'vitest';
import catalog from '../../applications/pwa/data/combat/affinities.json';
import { skillRequirementReason } from '../../src/UI/Game/CombatSkillRequirements.js';
import Status from '../../src/DB/Status/StatusConst.js';
import Skill from '../../src/DB/Skills/SkillConst.js';
const requirement = name => Object.values(catalog.skills).find(skill => skill.name === name).requires;
const actor = changes => ({ hp:10000, hpMax:10000, ap:200, weapons:['1hAxe'], effects:0x00400000,
 spiritCount:10, soulCount:10, zeny:10000, itemCount:()=>10, hasStatus:()=>false, hasSkill:()=>false,
 ammoType:'Cannonball', ammoCount:100, ...changes });
it('requires the flame launcher tool even when it is not consumed', () => {
 const name='NC_FLAMELAUNCHER', req=requirement(name);
 expect(skillRequirementReason(req,5,actor({itemCount:id=>id===2139?0:10}),name)).toBe('材料不足');
 expect(skillRequirementReason(req,5,actor({itemCount:id=>id===2139?1:10}),name)).toBe('');
});
it.each(['BO_ACIDIFIED_ZONE_WATER','BO_ACIDIFIED_ZONE_GROUND','BO_ACIDIFIED_ZONE_WIND','BO_ACIDIFIED_ZONE_FIRE'])('%s discounts one bottle only during Research Report',name=>{
 const req=requirement(name);
 expect(skillRequirementReason(req,5,actor({itemCount:()=>1}),name)).toBe('材料不足');
 expect(skillRequirementReason(req,5,actor({itemCount:()=>1,hasStatus:id=>id===Status.RESEARCHREPORT}),name)).toBe('');
 expect(skillRequirementReason(req,5,actor({itemCount:()=>0,hasStatus:id=>id===Status.RESEARCHREPORT}),name)).toBe('材料不足');
});
it.each([['MC_MAMMONITE',1000],['WS_CARTTERMINATION',1500]])('%s applies the learned Renewal money discount', (name,raw)=>{
 const req=requirement(name), common={zeny:raw*.8, hasStatus:()=>true};
 expect(skillRequirementReason(req,10,actor(common),name)).toBe('Zeny 不足');
 expect(skillRequirementReason(req,10,actor({...common,hasSkill:id=>id===Skill.BS_UNFAIRLYTRICK}),name)).toBe('');
 expect(skillRequirementReason(req,10,actor({...common,zeny:raw*.8-1,hasSkill:()=>true}),name)).toBe('Zeny 不足');
});
it('checks only the known Renewal Extremity Fist sphere lower bound',()=>{
 const req={SpiritSphereCost:5}, name='MO_EXTREMITYFIST';
 expect(skillRequirementReason(req,5,actor({spiritCount:1}),name)).toBe('');
 expect(skillRequirementReason(req,5,actor({spiritCount:0}),name)).toBe('气弹或仆从球不足');
 expect(skillRequirementReason(req,5,actor({spiritCount:4,hasStatus:id=>id===Status.BLADESTOP}),name)).toBe('');
 expect(skillRequirementReason(req,5,actor({spiritCount:3,hasStatus:id=>id===Status.BLADESTOP}),name)).toBe('气弹或仆从球不足');
});
