import {expect,it} from 'vitest';
import catalog from '../../applications/pwa/data/combat/affinities.json';
import {combatCapability,specialSkillReason,COMBAT_EXECUTION_IDS} from '../../src/UI/Game/CombatSkillCapabilities.js';
import {skillRequirementReason} from '../../src/UI/Game/CombatSkillRequirements.js';
import {trapPosition,cellDistance} from '../../src/UI/Game/CombatSkillPlacement.js';
import {combatSkillPriority} from '../../src/UI/Game/CombatSkillAffinity.js';
import Status from '../../src/DB/Status/StatusConst.js';
const find=name=>Object.entries(catalog.skills).find(([,row])=>row.name===name);
const cap=name=>{const [id]=find(name);return combatCapability(Number(id),5);};
it.each(['HT_TALKIEBOX','AL_WARP','NC_MAGICDECOY','CR_SLIMPITCHER','MG_SAFETYWALL','AL_PNEUMA','NC_DISJOINT','PF_SOULBURN','EM_ACTIVITY_BURN','PF_SOULCHANGE','PF_MINDBREAKER','GN_FIRE_EXPANSION','RA_DETONATOR','SC_DIMENSIONDOOR'])('excludes %s from monster automation',name=>expect(cap(name)).toBeNull());
it.each(['SM_MAGNUM','SHC_IMPACT_CRATER','ABC_ABYSS_DAGGER','MT_AXE_STOMP','MT_MIGHTY_SMASH','BO_EXPLOSIVE_POWDER','AG_RAIN_OF_CRYSTAL','AG_CRYSTAL_IMPACT','IQ_MASSIVE_F_BLASTER','NC_AXETORNADO','GN_CART_TORNADO'])('supports %s as a bounded self-area attack',name=>expect(cap(name)).toMatchObject({kind:'attack',aim:'self',radius:expect.any(Number)}));
it.each(['HT_SKIDTRAP','HT_LANDMINE','HT_ANKLESNARE','HT_SHOCKWAVE','HT_SANDMAN','HT_FLASHER','HT_FREEZINGTRAP','HT_BLASTMINE','HT_CLAYMORETRAP','RA_ELECTRICSHOCKER','RA_CLUSTERBOMB'])('uses a separate placement policy for %s',name=>expect(cap(name).aim).toBe('trap'));
it('retains damage skills with no-damage entry packets and validates alias identities',()=>{
 expect(cap('KN_BRANDISHSPEAR').kind).toBe('attack');expect(cap('WL_CHAINLIGHTNING').kind).toBe('attack');
 for(const ids of Object.values(COMBAT_EXECUTION_IDS))expect(ids.every(Number.isInteger)).toBe(true);
});
const actor=()=>({hp:100,ap:200,weapons:['1hAxe'],effects:0,shield:true,spiritCount:10,soulCount:10,zeny:10000,ammoType:'Arrow',ammoCount:100,itemCount:()=>10,hasStatus:()=>true,statusValue:()=>0,spheres:4});
it.each(['IG_OVERSLASH','GC_CROSSRIPPERSLASHER','BO_DUST_EXPLOSION'])('checks generated prerequisites for %s',name=>{
 const a=actor();a.hasStatus=()=>false;expect(skillRequirementReason(find(name)[1].requires,5,a)).toBe('缺少前置状态');
});
it('checks AP, materials, equipped ammo, weapon and HP without excluding all HP costs',()=>{
 const a=actor();
 expect(skillRequirementReason({ApCost:150},1,{...a,ap:0})).toBe('AP 不足');
 expect(skillRequirementReason({ItemCost:[{Item:717,Amount:1}]},1,{...a,itemCount:()=>0})).toBe('材料不足');
 expect(skillRequirementReason({Ammo:{Cannonball:true},AmmoAmount:1},1,a)).toContain('弹药');
 expect(skillRequirementReason({Weapon:{Katar:true}},1,a)).toContain('武器');
 expect(skillRequirementReason({HpCost:15},1,a)).toBe('');
 expect(skillRequirementReason({HpCost:15},1,{...a,hp:15})).toBe('HP 不足');
});
it('blocks silent faith failures, unsafe climax modes, unknown or already silenced targets',()=>{
 const a=actor();a.hasStatus=()=>false;
 expect(specialSkillReason(find('IQ_SECOND_FAITH')[1],a)).toContain('信仰');
 expect(specialSkillReason(find('IQ_SECOND_FAITH')[1],{...a,hasStatus:id=>id===Status.FIRST_FAITH_POWER})).toBe('');
 expect(specialSkillReason(find('AG_CRYSTAL_IMPACT')[1],{...a,hasStatus:()=>true,statusValue:()=>1})).toContain('增益');
 for(const healthState of [undefined,4])expect(specialSkillReason(find('PR_LEXDIVINA')[1],a,{healthState})).not.toBe('');
 expect(specialSkillReason(find('PR_LEXDIVINA')[1],a,{healthState:0})).toBe('');
 expect(specialSkillReason(find('SA_SPELLBREAKER')[1],a,{casting:false})).not.toBe('');
});
it('places traps outside the complete occupied exclusion area and refuses blocked terrain',()=>{
 const entry=find('HT_LANDMINE')[1], occupied=[[10,10],[7,10]];
 const position=trapPosition(entry,5,[10,10],[7,10],occupied,()=>true);
 expect(position).not.toBeNull();expect(occupied.every(cell=>cellDistance(cell,position)>1)).toBe(true);
 expect(trapPosition(entry,5,[10,10],[7,10],occupied,()=>false)).toBeNull();
});
it('uses the damage carrier element for chain lightning and treats tetra as dynamic',()=>{
 expect(combatSkillPriority({id:2214,level:5},{species:1002})).toEqual([2,150,0]);
 expect(combatSkillPriority({id:2217,level:5},{species:1120})).not.toBeNull();
});
it('accepts researched trap substitutes and leaves variable gemstone exemptions to the server',()=>{
 const req=find('HT_LANDMINE')[1].requires;
 const a={...actor(),itemCount:id=>id===7940?1:0,hasSkill:()=>true};
 expect(skillRequirementReason(req,5,a)).toBe('');
 expect(skillRequirementReason(req,5,{...a,hasSkill:()=>false})).toBe('材料不足');
 expect(skillRequirementReason({ItemCost:[{Item:717,Amount:1,variable:true}]},5,{...a,itemCount:()=>0})).toBe('');
 expect(catalog.weapons[1101]).toBe('1hSword');
});
it('includes each audited unconditional race bonus',async()=>{
 const {COMBAT_SKILL_RULES}=await import('../../src/UI/Game/CombatSkillRules.js');
 for(const [name,races] of Object.entries({DK_DRAGONIC_AURA:['DemiHuman','Angel'],IG_GRAND_JUDGEMENT:['Plant','Insect'],IG_JUDGEMENT_CROSS:['Plant','Insect'],SHC_FATAL_SHADOW_CROW:['DemiHuman','Dragon'],MT_RUSH_QUAKE:['Formless','Insect']})) {
  for(const race of races)expect(COMBAT_SKILL_RULES[name].bonus({monster:{race}})).toBe(true);
  expect(COMBAT_SKILL_RULES[name].bonus({monster:{race:'Fish'}})).toBe(false);
 }
});
