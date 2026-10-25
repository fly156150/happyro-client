import {expect,it} from 'vitest';
import {COMBAT_BUFF_RULES,chooseCombatBuff} from '../../src/UI/Game/CombatBuffRules.js';
it('only exposes explicitly mapped effects with valid blocked status identifiers',()=>{
 expect(Object.keys(COMBAT_BUFF_RULES)).toHaveLength(7);
 for(const [id,rule] of Object.entries(COMBAT_BUFF_RULES)) {
  expect(Number(id)).toBeGreaterThan(0);expect(Number.isInteger(rule.status)).toBe(true);
  for(const status of rule.blockedBy||[])expect(Number.isInteger(status)).toBe(true);
 }
});
it('skips existing, blocked, unavailable and unselected effects without guessing unsupported skills',()=>{
 const skills=[{id:34,available:true},{id:29,available:true},{id:75,available:true},{id:999,available:true}];
 const has=id=>[97,21].includes(id);
 expect(chooseCombatBuff(skills,[34,29,75,999],has,()=>true)).toBeNull();
 expect(chooseCombatBuff(skills,[75],()=>false,()=>true).id).toBe(75);
 expect(chooseCombatBuff(skills,[75],()=>false,()=>false)).toBeNull();
});
