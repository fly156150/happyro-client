import {expect,it} from 'vitest';
import {createAutoCombatSkillState} from '../../src/UI/Game/AutoCombatSkillState.js';

it('isolates failure backoff by skill and target, and permits retry at expiry',()=>{
 const state=createAutoCombatSkillState();
 state.begin(19,1,0);
 expect(state.feedback({id:20,phase:'failed'},100)).toBeNull();
 expect(state.waiting()).toBe(true);
 expect(state.feedback({id:19,phase:'failed'},100)).toBe('failed');
 expect(state.available(19,1,10099)).toBe(false);
 expect(state.available(14,1,101)).toBe(true);
 expect(state.available(19,2,101)).toBe(true);
 expect(state.available(19,1,10100)).toBe(true);
});
it('keeps timeout and normal-attack transitions bounded even after a long cast',()=>{
 const state=createAutoCombatSkillState();state.begin(19,1,0);
 state.feedback({id:19,phase:'casting',delay:20000},100);
 expect(state.poll(1,28099)).toBe(false);
 expect(state.poll(1,28100)).toBe(true);
 expect(state.poll(1,28101)).toBe(false);
 expect(state.useNormalAttack(31099)).toBe(true);
 expect(state.useNormalAttack(31100)).toBe(false);
 expect(state.available(19,1,38099)).toBe(false);
 expect(state.available(19,1,38100)).toBe(true);
});
it('forgets pending casts when targets change and resets recovery on a new session',()=>{
 const state=createAutoCombatSkillState();state.begin(19,1,0);
 state.poll(2,100);expect(state.waiting()).toBe(false);
 expect(state.feedback({id:19,phase:'casting',delay:90000},200)).toBeNull();
 state.begin(14,2,300);expect(state.poll(2,8300)).toBe(true);
 state.reset();expect(state.useNormalAttack(8400)).toBe(false);
 expect(state.available(14,2,8400)).toBe(true);
 expect(state.waiting()).toBe(false);
});

it('keeps self casts across monster changes and requires both execution and effect',()=>{
 const state=createAutoCombatSkillState();state.begin(34,'self',0,{kind:'buff',effect:10});
 state.poll(2,100,false,()=>true);expect(state.waiting()).toBe(true);
 state.feedback({id:34,phase:'executed'},200);
 state.poll(3,201,false,()=>true);expect(state.waiting()).toBe(false);
});
it('times out missing effects without repeated party replies extending the deadline',()=>{
 const state=createAutoCombatSkillState();state.begin(34,'self',0,{kind:'buff',effect:10});
 state.feedback({id:34,phase:'executed'},100);
 state.feedback({id:34,phase:'executed'},1500);
 expect(state.poll(null,1600)).toBe(true);
 expect(state.available(34,'self',1601)).toBe(false);
 expect(state.useNormalAttack(1601)).toBe(false);
});

it('accepts audited child results only for the requested target',()=>{
 const state=createAutoCombatSkillState();state.begin(2214,7,0);
 expect(state.feedback({id:2215,phase:'executed',target:8},100)).toBeNull();expect(state.waiting()).toBe(true);
 expect(state.feedback({id:2215,phase:'executed',target:7},101)).toBe('executed');expect(state.waiting()).toBe(false);
});
it('rejects old-target results and ambiguous cancellation after replacing a request',()=>{
 const state=createAutoCombatSkillState();state.begin(19,1,0);state.clearPending();state.begin(19,2,100);
 expect(state.feedback({id:19,phase:'executed',target:1},200)).toBeNull();
 expect(state.feedback({phase:'cancelled'},201)).toBeNull();
 expect(state.feedback({id:19,phase:'failed',unscoped:true},202)).toBeNull();expect(state.waiting()).toBe(true);
 expect(state.feedback({id:19,phase:'executed',target:2},203)).toBe('executed');
});
it('correlates ground cells and scopes resource failures across targets',()=>{
 const state=createAutoCombatSkillState();state.begin(18,1,0,{position:[10,20]});
 expect(state.feedback({id:18,phase:'executed',position:[11,20]},100)).toBeNull();
 expect(state.feedback({id:18,phase:'failed',unscoped:true},101)).toBe('failed');
 expect(state.available(18,999,102)).toBe(false);expect(state.available(19,999,102)).toBe(true);
});
it('drains delayed chain children before permitting another chain on any target',()=>{
 const state=createAutoCombatSkillState();state.begin(2214,1,0,{level:5});
 state.feedback({id:2215,phase:'executed',target:1},100);
 expect(state.available(2214,2,200)).toBe(false);expect(state.available(19,2,200)).toBe(true);
 state.feedback({id:2215,phase:'executed',target:2},750);
 expect(state.available(2214,2,5299)).toBe(false);expect(state.available(2214,2,5300)).toBe(true);
});
