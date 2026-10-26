import { expect, it, vi } from 'vitest';
import { createAutoCombatPanel } from '../../src/UI/Game/AutoCombatPanel.js';
it('loads map species and preserves configured choices while saving skills independently', async () => {
	const body = document.body.appendChild(document.createElement('div'));
	const actions = { snapshot: () => ({ species: [{ id: 1002, name: '波利' }], skills: [5], ranges: { search: 20, activity: 30 } }), mapSpecies: () => [{ id: 1003, name: '土波利' }], skills: () => [{ id: 5, name: '狂击', level: 3 }, { id: 19, name: '火箭术', level: 2, reason: 'SP 不足' }], configure: vi.fn(), close: vi.fn() };
	createAutoCombatPanel(body, actions);
 await Promise.resolve();
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
 createAutoCombatPanel(body,{snapshot:()=>({species:[],skills:[5],ranges:{search:20,activity:30}}),mapSpecies:()=>[],skills:()=>[{id:5,name:'狂击',level:3},{id:19,name:'火箭术',level:2}],configure:vi.fn(),close:vi.fn()});
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
 const actions = { snapshot: () => ({ species: [], skills: [], ranges: { search: 20, activity: 30 }, teleport: { enabled: false, waitSeconds: 5, intervalSeconds: 2 } }), mapSpecies: () => [], skills: () => [], configure: vi.fn(), close: vi.fn() };
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
 createAutoCombatPanel(body,{snapshot:()=>({species:[],skills:[5],ranges:{search:20,activity:30}}),mapSpecies:()=>[],skills:()=>[{id:5,name:'狂击',level:3,loadIcon:callback=>{loaded=callback;}}],configure});
 const card=body.querySelector('[data-skill="5"]');
 loaded('blob:skill-icon');
 expect(card.querySelector('img').getAttribute('src')).toBe('blob:skill-icon');
 expect(card.getAttribute('aria-checked')).toBe('true');expect(configure).not.toHaveBeenCalled();
});

it('loads distant map species, retains edits made during loading and never uses nearby targets', async () => {
 const body = document.body.appendChild(document.createElement('div'));
 let resolve;
 const actions = { snapshot: () => ({ species: [{id:1002,name:'波利'}], skills: [], ranges: {search:20,activity:30} }), mapSpecies: () => new Promise(done => {resolve=done;}), targets: vi.fn(() => []), skills: () => [], configure: vi.fn() };
 createAutoCombatPanel(body, actions);
 body.querySelector('[data-all-species]').click();
 resolve([{id:1002,name:'波利'},{id:1007,name:'绿棉虫'}]);
 await Promise.resolve();
 expect(body.querySelectorAll('[data-species]')).toHaveLength(2);
 expect(body.querySelector('[data-species="1002"]').getAttribute('aria-checked')).toBe('false');
 body.querySelector('[data-species="1007"]').click();
 expect(actions.configure.mock.lastCall[0]).toEqual([{id:1007,name:'绿棉虫'}]);
 expect(actions.targets).not.toHaveBeenCalled();
});

it('offers retry after map data fails and leaves an empty map list without explanatory copy', async () => {
 const body = document.body.appendChild(document.createElement('div'));
 const mapSpecies = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
 createAutoCombatPanel(body, {snapshot:()=>({species:[],skills:[],ranges:{search:20,activity:30}}),mapSpecies,skills:()=>[],configure:vi.fn()});
 await Promise.resolve();
 expect(body.querySelector('[data-auto-species]').textContent).toContain('加载失败');
 body.querySelector('[data-auto-species] button').click();
 await Promise.resolve();
 expect(body.querySelector('[data-auto-species]').textContent).toBe('');
});

it('ignores late results after the settings contents are replaced', async () => {
 const body = document.body.appendChild(document.createElement('div'));
 let resolve;
 createAutoCombatPanel(body,{snapshot:()=>({species:[],skills:[],ranges:{search:20,activity:30}}),mapSpecies:()=>new Promise(done=>{resolve=done;}),skills:()=>[],configure:vi.fn()});
 body.textContent='已关闭';
 resolve([{id:1002,name:'波利'}]);
 await Promise.resolve();
 expect(body.textContent).toBe('已关闭');
});

it('keeps skills in one list and preserves buffs when choosing normal attacks', () => {
 const body=document.body.appendChild(document.createElement('div'));
 const configure=vi.fn();
 createAutoCombatPanel(body,{
  snapshot:()=>({species:[],skills:[5,34],ranges:{search:20,activity:30}}),mapSpecies:()=>[],
  skills:()=>[{id:5,kind:'attack',name:'狂击',level:3},{id:34,kind:'buff',name:'天使之赐福',level:3}],configure
 });
 expect(body.querySelectorAll('[data-auto-skills] h4')).toHaveLength(0);
 expect([...body.querySelectorAll('[data-auto-skills] [data-skill]')].map(n=>Number(n.dataset.skill))).toEqual([5,34]);
 expect(body.querySelector('#auto-skills-title').textContent).toBe('攻击方式');
 body.querySelector('[data-normal-attack]').click();
 expect(body.querySelector('[data-skill="34"]').getAttribute('aria-checked')).toBe('true');
 expect(body.querySelector('[data-skill="5"]').getAttribute('aria-checked')).toBe('false');
 expect(configure.mock.calls.at(-1)[1]).toEqual([34]);
});

it('refreshes live requirements without replacing cards and stops after destruction', () => {
 vi.useFakeTimers();
 const body=document.body.appendChild(document.createElement('div'));
 vi.spyOn(body,'getClientRects').mockReturnValue([{}]);
 let reason='武器类型不符';
 const skills=vi.fn(()=>[{id:56,name:'连刺攻击',level:5,reason}]);
 const configure=vi.fn();
 const editor=createAutoCombatPanel(body,{snapshot:()=>({species:[],skills:[56],ranges:{search:40,activity:50}}),mapSpecies:()=>[],skills,configure});
 try {
  const card=body.querySelector('[data-skill="56"]'),list=body.querySelector('[data-auto-skills]');
  list.scrollTop=40;card.focus();reason='';vi.advanceTimersByTime(200);
  expect(body.querySelector('[data-skill="56"]')).toBe(card);
  expect(card.querySelector('.auto-skill-reason')).toBeNull();
  expect(card.getAttribute('aria-checked')).toBe('true');
  expect(list.scrollTop).toBe(40);expect(document.activeElement).toBe(card);
  reason='SP 不足';vi.advanceTimersByTime(200);
  expect(card.querySelector('.auto-skill-reason').textContent).toBe('SP 不足');
  expect(configure).not.toHaveBeenCalled();editor.destroy();const calls=skills.mock.calls.length;
  vi.advanceTimersByTime(1000);expect(skills).toHaveBeenCalledTimes(calls);
 } finally {editor.destroy();body.remove();vi.useRealTimers();}
});

it('reconciles temporary skills while retaining cards, scroll, focus and selection', () => {
 vi.useFakeTimers();
 const body=document.body.appendChild(document.createElement('div'));
 vi.spyOn(body,'getClientRects').mockReturnValue([{}]);
 let skills=[{id:46,name:'二连矢',level:10,kind:'attack'}];
 const configure=vi.fn();
 const panel=createAutoCombatPanel(body,{snapshot:()=>({species:[],skills:[46,499],ranges:{search:40,activity:50}}),skills:()=>skills,mapSpecies:()=>[],configure});
 const list=body.querySelector('[data-auto-skills]'),original=list.firstElementChild;
 list.scrollTop=80;original.focus();
 skills=[...skills,{id:499,name:'动物猛击',level:1,kind:'attack'}];
 vi.advanceTimersByTime(200);
 expect(list.children).toHaveLength(2);
 expect(list.firstElementChild).toBe(original);
 expect(document.activeElement).toBe(original);
 expect(list.scrollTop).toBe(80);
 expect(list.lastElementChild.getAttribute('aria-checked')).toBe('true');
 expect(body.querySelector('[data-skill-count]').textContent).toBe('已选 2 项');
 expect(configure).not.toHaveBeenCalled();
 skills=[skills[1],skills[0]];vi.advanceTimersByTime(200);
 expect(list.lastElementChild).toBe(original);
 expect(document.activeElement).toBe(original);
 expect(list.scrollTop).toBe(80);
 skills=[skills[1]];vi.advanceTimersByTime(200);
 expect(list.children).toHaveLength(1);
 expect(body.querySelector('[data-skill-count]').textContent).toBe('已选 1 项');
 skills=[...skills,{id:499,name:'动物猛击',level:1,kind:'attack'}];vi.advanceTimersByTime(200);
 expect(list.lastElementChild.getAttribute('aria-checked')).toBe('true');
 list.lastElementChild.click();
 expect(configure.mock.lastCall[1]).toEqual([46]);
 panel.destroy();body.remove();vi.useRealTimers();
});

it('handles empty dynamic skill sets and focuses normal attack inside a shadow root when a skill disappears', () => {
 vi.useFakeTimers();
 const host=document.body.appendChild(document.createElement('div'));
 const root=host.attachShadow({mode:'open'});
 const body=root.appendChild(document.createElement('div'));
 vi.spyOn(body,'getClientRects').mockReturnValue([{}]);
 let skills=[];
 const configure=vi.fn();
 const panel=createAutoCombatPanel(body,{snapshot:()=>({species:[],skills:[],ranges:{search:40,activity:50}}),skills:()=>skills,mapSpecies:()=>[],configure});
 const list=body.querySelector('[data-auto-skills]');
 skills=[{id:499,name:'动物猛击',level:1,kind:'attack'}];vi.advanceTimersByTime(200);
 expect(list.textContent).not.toContain('暂无');
 list.firstElementChild.focus();skills=[];vi.advanceTimersByTime(200);
 expect(list.textContent).toContain('暂无');
 expect(root.activeElement).toBe(body.querySelector('[data-normal-attack]'));
 host.remove();
 expect(configure).not.toHaveBeenCalled();
 panel.destroy();body.remove();vi.useRealTimers();
});
