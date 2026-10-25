import {expect,it} from 'vitest';
import {createAutoCombatSkillState} from '../../src/UI/Game/AutoCombatSkillState.js';

it('isolates failure backoff by skill and target, and permits retry at expiry',()=>{
 const state=createAutoCombatSkillState();
 state.begin(19,1,0);
 expect(state.feedback({id:19,phase:'failed'},2,100)).toBeNull();
 expect(state.waiting()).toBe(true);
 expect(state.feedback({id:19,phase:'failed'},1,100)).toBe('failed');
 expect(state.available(19,1,10099)).toBe(false);
 expect(state.available(14,1,101)).toBe(true);
 expect(state.available(19,2,101)).toBe(true);
 expect(state.available(19,1,10100)).toBe(true);
});
it('keeps timeout and normal-attack transitions bounded even after a long cast',()=>{
 const state=createAutoCombatSkillState();state.begin(19,1,0);
 state.feedback({id:19,phase:'casting',delay:20000},1,100);
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
 expect(state.feedback({id:19,phase:'casting',delay:90000},1,200)).toBeNull();
 state.begin(14,2,300);expect(state.poll(2,8300)).toBe(true);
 state.reset();expect(state.useNormalAttack(8400)).toBe(false);
 expect(state.available(14,2,8400)).toBe(true);
 expect(state.waiting()).toBe(false);
});
