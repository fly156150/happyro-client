import { expect, it, vi } from 'vitest';
import { createAutoCombatPanel } from '../../src/UI/Game/AutoCombatPanel.js';
it('keeps configured species when it is absent nearby and saves multiple skills independently of shortcuts', () => {
	const body = document.body.appendChild(document.createElement('div'));
	const actions = { snapshot: () => ({ species: [{ id: 1002, name: '波利' }], skills: [5], ranges: { search: 20, activity: 30 } }), targets: () => [{ species: 1003, name: '土波利' }], skills: () => [{ id: 5, name: '狂击', level: 3 }, { id: 19, name: '火箭术', level: 2, reason: 'SP 不足' }], configure: vi.fn(), close: vi.fn() };
	createAutoCombatPanel(body, actions);
	expect(body.querySelector('[data-species="1002"]').getAttribute('aria-checked')).toBe('true');
	body.querySelector('[data-species="1003"]').click();
	expect(body.querySelector('[data-species="1002"]').getAttribute('aria-checked')).toBe('true');
	expect(body.querySelector('[data-species="1003"]').getAttribute('aria-checked')).toBe('true');
	body.querySelector('[data-auto-skills] [data-skill="19"]').click();

	expect(actions.configure).toHaveBeenLastCalledWith([{ id: 1002, name: '波利' }, { id: 1003, name: '土波利' }], [5, 19], { search: 20, activity: 30 }, { enabled: true, waitSeconds: 2, intervalSeconds: 2 });
	expect(actions.close).not.toHaveBeenCalled();
	expect(body.querySelector('[data-pick-species]')).toBeNull();
	body.querySelector('[data-all-species]').click();
	expect(actions.configure).toHaveBeenLastCalledWith([], [5, 19], { search: 20, activity: 30 }, { enabled: true, waitSeconds: 2, intervalSeconds: 2 }); expect(actions.close).not.toHaveBeenCalled();
});

it('ignores list gaps and scrolling, but toggles a full skill row and clears via normal attack', () => {
 const body=document.body.appendChild(document.createElement('div'));
 createAutoCombatPanel(body,{snapshot:()=>({species:[],skills:[5],ranges:{search:20,activity:30}}),targets:()=>[],skills:()=>[{id:5,name:'狂击',level:3},{id:19,name:'火箭术',level:2}],configure:vi.fn(),close:vi.fn()});
 const list=body.querySelector('[data-auto-skills]'),row=list.querySelector('[data-skill="5"]');
 list.click();expect(row.getAttribute('aria-checked')).toBe('true');
 const pointer=(type,y)=>row.dispatchEvent(new MouseEvent(type,{bubbles:true,button:0,clientX:10,clientY:y}));
 pointer('pointerdown',10);pointer('pointermove',40);pointer('pointerup',40);row.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1,clientX:10,clientY:40}));
 expect(row.getAttribute('aria-checked')).toBe('true');
 pointer('pointerdown',10);list.scrollTop=30;row.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1,clientX:10,clientY:10}));expect(row.getAttribute('aria-checked')).toBe('true');
 row.querySelector('strong').click();expect(row.getAttribute('aria-checked')).toBe('false');
 row.click();expect(row.getAttribute('aria-checked')).toBe('true');
 body.querySelector('[data-normal-attack]').click();expect(row.getAttribute('aria-checked')).toBe('false');
 expect(document.querySelector('.ui-toast')).toBeNull();
});

it('keeps teleport timing disabled until enabled and saves preferences without starting', () => {
 const body = document.body.appendChild(document.createElement('div'));
 const actions = { snapshot: () => ({ species: [], skills: [], ranges: { search: 20, activity: 30 }, teleport: { enabled: false, waitSeconds: 5, intervalSeconds: 2 } }), targets: () => [], skills: () => [], configure: vi.fn(), close: vi.fn() };
 createAutoCombatPanel(body, actions);
 const wait = body.querySelector('[data-teleport-key="waitSeconds"][data-delta="1"]');
 expect(wait.disabled).toBe(true); body.querySelector('[data-auto-teleport]').click(); expect(wait.disabled).toBe(false);
 wait.click();
 expect(actions.configure).toHaveBeenLastCalledWith([], [], { search: 20, activity: 30 }, { enabled: true, waitSeconds: 6, intervalSeconds: 2 });
});

it('shows a skill icon when its shortcut resource finishes loading without changing selection', () => {
 const body=document.body.appendChild(document.createElement('div'));
 let loaded;
 const configure=vi.fn();
 createAutoCombatPanel(body,{snapshot:()=>({species:[],skills:[5],ranges:{search:20,activity:30}}),targets:()=>[],skills:()=>[{id:5,name:'狂击',level:3,loadIcon:callback=>{loaded=callback;}}],configure});
 const card=body.querySelector('[data-skill="5"]');
 loaded('blob:skill-icon');
 expect(card.querySelector('img').getAttribute('src')).toBe('blob:skill-icon');
 expect(card.getAttribute('aria-checked')).toBe('true');expect(configure).not.toHaveBeenCalled();
});
