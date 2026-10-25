import { describe, expect, it } from 'vitest';
import data from '../../applications/pwa/data/combat/affinities.json';
import { chooseCombatSkill, combatSkillPriority, isOffensiveSupportSkill } from '../../src/UI/Game/CombatSkillAffinity.js';

const id = name => Number(Object.keys(data.skills).find(key => data.skills[key].name === name));
const skill = name => ({id: id(name), level: 5, available: true});
const target = match => ({species: Number(Object.keys(data.monsters).find(key => Object.entries(match).every(([field,value]) => data.monsters[key][field] === value)))});
const priority = (name, match) => combatSkillPriority(skill(name), target(match));
const pick = (names, match, random = () => 0) => chooseCombatSkill(names.map(name => ({...skill(name), priority: priority(name, match)})), random);

describe('Renewal target affinities', () => {
 it('chooses the counter element for each new monster', () => {
  expect(pick(['MG_FIREBOLT','MG_COLDBOLT','MG_LIGHTNINGBOLT'],{element:'Water',elementLevel:1}).id).toBe(id('MG_LIGHTNINGBOLT'));
  expect(pick(['MG_FIREBOLT','MG_COLDBOLT','MG_LIGHTNINGBOLT'],{element:'Earth',elementLevel:1}).id).toBe(id('MG_FIREBOLT'));
  expect(pick(['MG_FIREBOLT','MG_COLDBOLT','MG_LIGHTNINGBOLT'],{element:'Fire',elementLevel:1}).id).toBe(id('MG_COLDBOLT'));
 });
 it('uses all four element levels and skips immunity or absorption', () => {
  for (const level of [1,2,3,4]) {
   expect(priority('MG_LIGHTNINGBOLT',{element:'Water',elementLevel:level})[1]).toBe(data.elements[level].Wind.Water);
  }
  expect(priority('MG_FIREBOLT',{element:'Fire',elementLevel:3})).toBeNull();
  expect(priority('MG_FIREBOLT',{element:'Fire',elementLevel:4})).toBeNull();
  expect(pick(['MG_FIREBOLT'],{element:'Fire',elementLevel:4})).toBeNull();
 });
 it('does not invent an element for weapons, buffs or mixed-element attacks', () => {
  expect(priority('SM_BASH',{element:'Ghost',elementLevel:3})[1]).toBe(100);
  expect(priority('SO_PSYCHIC_WAVE',{element:'Ghost',elementLevel:3})[1]).toBe(100);
  expect(priority('WL_HELLINFERNO',{element:'Fire',elementLevel:4})[1]).toBe(100);
 });
 it('prefers known racial bonuses and honors restricted races', () => {
  expect(priority('GS_BULLSEYE',{race:'Brute',statusImmune:false})[0]).toBe(2);
  expect(priority('GS_BULLSEYE',{race:'Brute',statusImmune:true})[0]).toBe(1);
  expect(priority('HT_POWER',{race:'Plant'})).toBeNull();
  expect(priority('HT_POWER',{race:'Insect'})[0]).toBe(2);
  expect(priority('WH_HAWKBOOMERANG',{race:'Fish'})[2]).toBe(1);
 });
 it('recognizes the size-specific hit bonus without calling it an exact damage estimate', () => {
  expect(priority('KN_PIERCE',{size:'Small'})[0]).toBe(1);
  expect(priority('KN_PIERCE',{size:'Medium'})[0]).toBe(2);
  expect(priority('KN_PIERCE',{size:'Large'})[0]).toBe(2);
 });
 it('distinguishes undead element from undead race for offensive support and provoke', () => {
  expect(data.undeadDetection).toBe(0);
  expect(priority('AL_HEAL',{race:'Undead',element:'Neutral'})).toBeNull();
  expect(priority('AL_HEAL',{element:'Undead'})[0]).toBe(2);
  expect(priority('PR_TURNUNDEAD',{element:'Neutral'})).toBeNull();
  expect(priority('SM_PROVOKE',{element:'Undead'})).toBeNull();
  expect(priority('SM_PROVOKE',{statusImmune:true})).toBeNull();
  expect(priority('PR_MAGNUS',{race:'Demon',element:'Neutral'})[2]).toBe(1);
 });
 it('rejects restricted skills on unknown monsters but allows ordinary skills', () => {
  expect(combatSkillPriority(skill('AL_HEAL'),{species:999999})).toBeNull();
  expect(combatSkillPriority(skill('HT_POWER'),{species:999999})).toBeNull();
  expect(combatSkillPriority(skill('MG_FIREBOLT'),{species:999999})).toEqual([1,100,0]);
  expect(isOffensiveSupportSkill(id('AL_HEAL'))).toBe(true);
  expect(isOffensiveSupportSkill(id('AL_INCAGI'))).toBe(false);
 });
 it('randomizes only equally suitable candidates and prefers non-resisted skills', () => {
  const candidates=[{id:1,priority:[0,25,1]},{id:2,priority:[1,100,0]},{id:3,priority:[1,100,0]},{id:4,priority:null}];
  expect(chooseCombatSkill(candidates,()=>0).id).toBe(2);
  expect(chooseCombatSkill(candidates,()=>0.99).id).toBe(3);
 });
});

it('honors skill immunity, status-only immunity and the Emperium target flag', () => {
 expect(combatSkillPriority({id:999999},target({skillImmune:true}))).toBeNull();
 expect(priority('MG_STONECURSE',{statusImmune:true})).toBeNull();
 expect(combatSkillPriority(skill('MG_FIREBOLT'),{species:1288})).toBeNull();
 expect(combatSkillPriority(skill('HW_GRAVITATION'),{species:1288})).not.toBeNull();
});

it('does not apply damage affinity to control or protective magic', () => {
 expect(priority('MG_STONECURSE',{element:'Wind',elementLevel:1,statusImmune:false})).toEqual([1,100,0]);
 expect(priority('MG_STONECURSE',{element:'Ghost',elementLevel:4,statusImmune:false})).toEqual([1,100,0]);
 expect(priority('MG_SAFETYWALL',{element:'Neutral',elementLevel:1})).toEqual([1,100,0]);
 expect(priority('WZ_QUAGMIRE',{element:'Wind',elementLevel:1})).toEqual([1,100,0]);
 expect(priority('PR_ASPERSIO',{element:'Undead',elementLevel:1})[1]).toBe(100); // IgnoreElement: fixed holy water damage
 expect(priority('PR_SANCTUARY',{element:'Undead',elementLevel:1})[1]).toBe(data.elements[1].Holy.Undead);
});

it('never places offensive sanctuary to heal a living non-demon or an unknown monster', () => {
 expect(priority('PR_SANCTUARY',{element:'Water',race:'Plant'})).toBeNull();
 expect(combatSkillPriority(skill('PR_SANCTUARY'),{species:999999})).toBeNull();
 expect(priority('PR_SANCTUARY',{element:'Undead'})).not.toBeNull();
 expect(priority('PR_SANCTUARY',{element:'Neutral',race:'Demon'})).not.toBeNull();
});

it('extends target eligibility and bonuses through a rule without changing the evaluator', async () => {
 const {createCombatSkillPolicy}=await import('../../src/UI/Game/CombatSkillAffinity.js');
 const catalog={
  undeadDetection:0,
  skills:{1:{name:'FUTURE_FISH_SKILL',element:'Wind',elemental:true}},
  monsters:{1:{race:'Plant',element:'Water',elementLevel:1},2:{race:'Fish',element:'Neutral',elementLevel:1}},
  elements:{1:{Wind:{Water:175,Neutral:100}}}
 };
 const rules={FUTURE_FISH_SKILL:{requiresKnownMonster:true,offensiveSupport:true,canTarget:({monster,skill})=>monster.race==='Fish'&&skill.level>=3,bonus:()=>true}};
 const policy=createCombatSkillPolicy(catalog,rules);
 expect(policy.isOffensiveSupportSkill(1)).toBe(true);
 expect(policy.priority({id:1,level:3},{species:1})).toBeNull();
 expect(policy.priority({id:1,level:2},{species:2})).toBeNull();
 expect(policy.priority({id:1,level:3},{species:999})).toBeNull();
 expect(policy.priority({id:1,level:3},{species:2})).toEqual([2,100,1]);
 expect(createCombatSkillPolicy(catalog,{}).priority({id:1,level:3},{species:2})).toEqual([1,100,0]);
});
