import { beforeEach, expect, it, vi } from 'vitest';
import { createAutoCombatController } from '../../src/UI/Game/AutoCombatController.js';
let data, controller, time, targets, skills, enabled, busy, chasing;
const mob = (id, species = 1002, x = 2) => ({ id, species, name: `魔物${species}`, position: [x, 0] });
beforeEach(() => {
	time = 0; enabled = true; busy = false; chasing = false; targets = [mob(1), mob(2, 1002, 4), mob(3, 1003, 1)]; skills = [];
	data = { searchLimit: () => 50, now: () => time, random: () => 0.75, enabled: () => enabled, position: () => [0, 0], targets: () => targets, skills: () => skills, busy: () => busy, chasing: () => chasing, reachable: () => true, select: vi.fn(), stop: vi.fn(), act: vi.fn(() => true) };
	controller = createAutoCombatController(data);
});
it('selects the nearest of the chosen species, replaces dead targets and waits for new spawns', () => {
	controller.configure([{ id: 1002, name: '波利' }], [], { search: 20, activity: 30 }); controller.start();
	expect(data.act).toHaveBeenLastCalledWith(targets[0], null);
	targets = targets.slice(1); controller.tick();
	expect(data.act).toHaveBeenLastCalledWith(targets[0], null);
	targets = [mob(3, 1003)]; controller.tick();
	expect(controller.snapshot()).toMatchObject({ active: true, status: '无目标，2 秒后随机瞬移' });
	targets.push(mob(4)); controller.tick();
	expect(data.act).toHaveBeenLastCalledWith(targets[1], null);
});
it('all monsters includes different species but excludes distant and unreachable candidates', () => {
	targets = [mob(1, 1002, 25), mob(2), mob(3, 1003, 5)]; data.reachable = target => target.id !== 2;
	controller.start(); expect(data.act).toHaveBeenLastCalledWith(targets[2], null);
});
it('randomly chooses only configured available skills and falls back to normal attacks', () => {
	skills = [{ id: 5, available: true }, { id: 6, available: false }, { id: 7, available: true }, { id: 8, available: true }];
	controller.configure([], [5, 6, 7], { search: 20, activity: 30 }); controller.start();
	expect(data.act.mock.calls[0][1].id).toBe(7);
	controller.skillFeedback({id:7,phase:'executed'}); data.random = () => 0; time = 1000; controller.tick(); expect(data.act.mock.calls[1][1].id).toBe(5);
	controller.skillFeedback({id:5,phase:'executed'}); skills.forEach(skill => skill.available = false); time = 2000; controller.tick(); expect(data.act.mock.calls[2][1]).toBeNull();
});
it('throttles requests and never interrupts an in-flight cast or chase', () => {
	controller.start(); controller.tick(); expect(data.act).toHaveBeenCalledTimes(1);
	busy = true; time = 1200; controller.tick(); expect(data.act).toHaveBeenCalledTimes(1);
	busy = false; controller.tick(); expect(data.act).toHaveBeenCalledTimes(2);
});
it('stops permanently on manual stop or disabled session until explicitly restarted', () => {
	controller.start(); enabled = false; controller.tick();
	expect(controller.snapshot().active).toBe(false);
	enabled = true; time = 2000; controller.tick(); expect(data.act).toHaveBeenCalledTimes(1);
	controller.start(); controller.stop(); controller.tick(); expect(data.act).toHaveBeenCalledTimes(2);
});
it('abandons stalled chases and temporarily skips unreachable targets', () => {
	controller.start(); chasing = busy = true; time = 100; controller.tick(); time = 8200; controller.tick();
	expect(controller.snapshot().status).toContain('无法接近');
	busy = chasing = false; controller.tick(); expect(data.act.mock.calls.at(-1)[0].id).toBe(1);
});
it('cancels pending actions immediately when the target leaves the visible entity list', () => {
	controller.start(); data.stop.mockClear(); targets = []; busy = true; controller.tick();
	expect(data.stop).toHaveBeenCalledOnce(); expect(controller.snapshot().target).toBe('');
});

it('attacks only the tapped monster with configured skills and stops when it disappears', () => {
 skills = [{ id: 5, available: true }];
 controller.configure([{ id: 1003, name: '土波利' }], [5], { search: 20, activity: 30 });
 expect(controller.attackTarget(1)).toBe(true);
 expect(data.act).toHaveBeenLastCalledWith(targets[0], skills[0]);
 controller.skillFeedback({id:5,phase:'executed'}); time = 1000; controller.tick();
 expect(data.act).toHaveBeenCalledTimes(2);
 targets = targets.slice(1); controller.tick();
 expect(controller.snapshot().active).toBe(false);
 expect(data.act).toHaveBeenCalledTimes(2);
 expect(controller.snapshot().species).toEqual([{ id: 1003, name: '土波利' }]);
});
it('temporarily switches an automatic battle to a tapped species without changing its filter', () => {
 controller.configure([{ id: 1002, name: '波利' }], [], { search: 20, activity: 30 });
 controller.start(); controller.attackTarget(3);
 expect(data.act).toHaveBeenLastCalledWith(targets[2], null);
 targets = targets.slice(0, 2); controller.tick();
 expect(controller.snapshot().active).toBe(true);
 expect(data.act).toHaveBeenLastCalledWith(targets[0], null);
 expect(controller.snapshot().species).toEqual([{ id: 1002, name: '波利' }]);
});

it('pauses automatic combat during manual movement and searches from the new position on resume', () => {
 controller.configure([{ id: 1002, name: '波利' }], [], { search: 20, activity: 30 });
 controller.start();
 controller.pauseForMovement();
 const attacks = data.act.mock.calls.length;
 time = 2000; controller.tick();
 expect(data.act).toHaveBeenCalledTimes(attacks);
 expect(controller.snapshot()).toMatchObject({ active: true, pausedForMovement: true });
 data.position = () => [40, 0]; targets = [mob(8, 1002, 42)];
 controller.resumeAfterMovement(); controller.tick();
 expect(data.act).toHaveBeenLastCalledWith(targets[0], null);
 expect(controller.snapshot()).toMatchObject({ active: true, pausedForMovement: false });
});
it('does not resume after an explicit stop during movement or after moving away from a single target', () => {
 controller.start(); controller.pauseForMovement(); controller.stop();
 const attacks = data.act.mock.calls.length;
 controller.resumeAfterMovement(); controller.tick();
 expect(data.act).toHaveBeenCalledTimes(attacks);
 expect(controller.snapshot().active).toBe(false);
 controller.attackTarget(1); controller.pauseForMovement(); controller.resumeAfterMovement();
 expect(controller.snapshot().active).toBe(false);
});

it('waits continuously without targets, resets on pickup or movement, and teleports only when enabled', () => {
 targets = []; data.teleport = vi.fn(() => '正在随机瞬移'); data.teleportBusy = () => false;
 controller.configure([], [], { search: 20, activity: 30 }, { enabled: false, waitSeconds: 2, intervalSeconds: 2 });
 controller.start(); time = 10000; controller.tick(); expect(data.teleport).not.toHaveBeenCalled();
 controller.configure([], [], { search: 20, activity: 30 }, { enabled: true, waitSeconds: 5, intervalSeconds: 10 });
 controller.start(); time = 14999; controller.tick(); expect(data.teleport).not.toHaveBeenCalled();
 busy = true; time = 15000; controller.tick(); busy = false; time = 16000; controller.tick();
 time = 20999; controller.tick(); expect(data.teleport).not.toHaveBeenCalled();
 time = 21000; controller.tick(); expect(data.teleport).toHaveBeenCalledWith(10);
 controller.pauseForMovement(); time = 30000; controller.tick(); expect(data.teleport).toHaveBeenCalledOnce();
 controller.resumeAfterMovement(); controller.tick(); time = 35000; controller.tick(); expect(data.teleport).toHaveBeenCalledTimes(2);
});
it('resets the idle countdown when a target appears and never teleports a manual-only attack', () => {
 data.teleport = vi.fn(() => '正在随机瞬移'); targets = [];
 controller.configure([], [], { search: 20, activity: 30 }, { enabled: true, waitSeconds: 5, intervalSeconds: 10 });
 controller.start(); time = 4000; targets = [mob(1)]; controller.tick();
 time = 5000; targets = []; controller.tick(); time = 9999; controller.tick(); expect(data.teleport).not.toHaveBeenCalled();
 time = 10000; controller.tick(); expect(data.teleport).toHaveBeenCalledOnce();
 controller.stop(); targets = [mob(1)]; controller.attackTarget(1); targets = []; controller.tick();
 time = 20000; controller.tick(); expect(data.teleport).toHaveBeenCalledOnce();
});
it('rejects invalid teleport timing without altering the configuration', () => {
 for (const teleport of [{ enabled: true, waitSeconds: 0, intervalSeconds: 10 }, { enabled: true, waitSeconds: 5, intervalSeconds: 0 }, { enabled: true, waitSeconds: 5.5, intervalSeconds: 10 }]) {
  expect(controller.configure([], [], { search: 20, activity: 30 }, teleport)).toBe(false);
 }
 expect(controller.snapshot().teleport.enabled).toBe(true);
});
it('enables teleport with two-second defaults and accepts a one-second interval', () => {
 expect(controller.snapshot().teleport).toEqual({ enabled: true, waitSeconds: 2, intervalSeconds: 2 });
 expect(controller.configure([], [], { search: 20, activity: 30 }, { enabled: true, waitSeconds: 5, intervalSeconds: 1 })).toBe(true);
});

it('persists configuration without stopping the active target and rejects storage failures atomically', () => {
 controller.start(); const before = controller.snapshot(); data.stop.mockClear();
 data.saveSettings = vi.fn(() => true);
 expect(controller.configure([], [], { search: 25, activity: 35 })).toBe(true);
 expect(controller.snapshot()).toMatchObject({ active: true, target: before.target, ranges: { search: 25, activity: 35 } });
 expect(data.stop).not.toHaveBeenCalled();
 data.saveSettings.mockReturnValue(false);
 expect(controller.configure([], [], { search: 30, activity: 40 })).toBe(false);
 expect(controller.snapshot().ranges).toEqual({ search: 25, activity: 35 });
 expect(data.stop).not.toHaveBeenCalled();
});

it('re-evaluates target priorities each turn and falls back after counter cooldown', () => {
 skills=[{id:19,available:true},{id:20,available:true}];
 data.skills=target=>skills.map(skill=>({...skill,priority:target ? [skill.id===(target.species===1002?20:19)?2:1,100,0] : undefined}));
 controller.configure([],[19,20],{search:20,activity:30});
 targets=[mob(1,1002)];controller.start();expect(data.act.mock.calls.at(-1)[1].id).toBe(20);
 controller.skillFeedback({id:20,phase:'executed'});skills[1].available=false;time=1000;controller.tick();expect(data.act.mock.calls.at(-1)[1].id).toBe(19);
 skills[1].available=true;targets=[mob(2,1003)];time=2000;controller.tick();expect(data.act.mock.calls.at(-1)[1].id).toBe(19);
 controller.skillFeedback({id:19,phase:'executed'});data.skills=()=>skills.map(skill=>({...skill,priority:null}));time=3000;controller.tick();expect(data.act.mock.calls.at(-1)[1]).toBeNull();
});

it('tries another selected skill on synchronous rejection, then uses normal attacks', () => {
 targets=[mob(1)];skills=[{id:5,available:true,priority:[2,150,0]},{id:6,available:true,priority:[1,100,0]}];
 data.act.mockImplementation((target,skill)=>!skill);
 controller.configure([],[5,6],{search:20,activity:30});controller.start();
 expect(data.act.mock.calls.at(-1)[1].id).toBe(5);
 time=200;controller.tick();expect(data.act.mock.calls.at(-1)[1].id).toBe(6);
 time=400;controller.tick();expect(data.act.mock.calls.at(-1)[1]).toBeNull();
 expect(controller.snapshot().active).toBe(true);
 time=11000;controller.tick();expect(data.act.mock.calls.at(-1)[1].id).toBe(5);
});
it('backs off a matching server-rejected skill without abandoning its monster', () => {
 targets=[mob(1)];skills=[{id:5,available:true}];
 controller.configure([],[5],{search:20,activity:30});controller.start();
 controller.skillFeedback({id:6,phase:'failed'});
 time=1000;controller.tick();expect(data.act.mock.calls.at(-1)[1].id).toBe(5);
 controller.skillFeedback({id:5,phase:'failed'});time=1200;controller.tick();
 expect(data.act.mock.calls.at(-1)).toEqual([targets[0],null]);
 expect(controller.snapshot().active).toBe(true);
 controller.stop();controller.skillFeedback({id:5,phase:'failed'});
 controller.start();expect(data.act.mock.calls.at(-1)[1].id).toBe(5);
});
it('uses a bounded normal-attack window when a request receives no feedback', () => {
 targets=[mob(1)];skills=[{id:5,available:true}];
 controller.configure([],[5],{search:20,activity:30});controller.start();
 for(time=1000;time<=8000;time+=1000)controller.tick();
 time=8200;controller.tick();expect(data.act.mock.calls.at(-1)[1]).toBeNull();
 expect(controller.snapshot().active).toBe(true);
 time=18100;controller.tick();expect(data.act.mock.calls.at(-1)[1].id).toBe(5);
});
it('waits for acknowledged long casts, and success cancels the watchdog', () => {
 targets=[mob(1)];skills=[{id:5,available:true}];
 controller.configure([],[5],{search:20,activity:30});controller.start();
 controller.skillFeedback({id:5,phase:'casting',delay:20000});
 time=10000;controller.tick();expect(data.act).toHaveBeenCalledTimes(1);
 time=20000;controller.skillFeedback({id:5,phase:'executed',target:1,damage:50});controller.tick();
 expect(data.act.mock.calls.at(-1)[1].id).toBe(5);
 time=27000;controller.skillFeedback({id:5,phase:'executed',target:1,damage:50});controller.tick();
 expect(data.act.mock.calls.at(-1)[1].id).toBe(5);
});
it('recovers a stale busy cast after its acknowledged duration and grace period', () => {
 targets=[mob(1)];skills=[{id:5,available:true}];data.clearExpiredCast=vi.fn(()=>busy=false);
 controller.configure([],[5],{search:20,activity:30});controller.start();
 controller.skillFeedback({id:5,phase:'casting',delay:10000});busy=true;
 time=17000;controller.tick();expect(data.clearExpiredCast).not.toHaveBeenCalled();
 time=18000;controller.tick();expect(data.clearExpiredCast).toHaveBeenCalledOnce();
 time=18200;controller.tick();expect(data.act.mock.calls.at(-1)[1]).toBeNull();
});

it('keeps exactly one request in flight through delayed damage feedback', () => {
 targets=[mob(1)];skills=[{id:19,available:true},{id:14,available:true}];
 controller.configure([],[19,14],{search:20,activity:30});controller.start();
 controller.skillFeedback({id:14,phase:'casting',delay:3500});
 time=3600;controller.tick();time=4000;controller.tick();
 expect(data.act).toHaveBeenCalledTimes(1);
 controller.skillFeedback({id:14,phase:'executed'});controller.tick();
 expect(data.act).toHaveBeenCalledTimes(2);
});
it('backs off an interrupted cast immediately instead of waiting out its full duration', () => {
 targets=[mob(1)];skills=[{id:19,available:true}];
 controller.configure([],[19],{search:20,activity:30});controller.start();
 controller.skillFeedback({id:19,phase:'casting',delay:20000});
 time=1000;controller.skillFeedback({phase:'cancelled'});
 time=1200;controller.tick();expect(data.act.mock.calls.at(-1)[1]).toBeNull();
 expect(controller.snapshot().active).toBe(true);
});

function setupBuffs() {
 const effects=new Set();
 skills=[{id:34,name:'赐福',kind:'buff',available:true},{id:29,name:'加速术',kind:'buff',available:true},{id:33,name:'天使之障壁',kind:'buff',available:true}];
 data.hasStatus=id=>effects.has(id);data.buff=vi.fn(()=>true);
 controller.configure([],skills.map(s=>s.id),{search:20,activity:30});
 return effects;
}
it('maintains self buffs while idle, skips existing effects and resumes after expiry',()=>{
 const effects=setupBuffs();targets=[];effects.add(12);effects.add(9);
 controller.start();expect(data.buff).toHaveBeenCalledOnce();expect(data.buff.mock.calls[0][0].id).toBe(34);
 controller.skillFeedback({id:34,phase:'executed'});effects.add(10);
 time=1000;controller.tick();expect(data.buff).toHaveBeenCalledOnce();
 time=11000;effects.delete(10);controller.tick();expect(data.buff).toHaveBeenCalledTimes(2);
 controller.stop();time=22000;controller.tick();expect(data.buff).toHaveBeenCalledTimes(2);
});
it('bounds consecutive buffs and yields an attack even when multiple effects are missing',()=>{
 const effects=setupBuffs();controller.start();
 effects.add(10);controller.skillFeedback({id:34,phase:'executed'});
 time=1000;controller.tick();expect(data.buff.mock.calls.at(-1)[0].id).toBe(29);
 effects.add(12);controller.skillFeedback({id:29,phase:'executed'});
 time=2000;controller.tick();expect(data.buff).toHaveBeenCalledTimes(2);expect(data.act).toHaveBeenCalledOnce();
 time=3000;controller.tick();expect(data.buff.mock.calls.at(-1)[0].id).toBe(33);
});
it('does not abort a self buff when the monster disappears, and never casts it offensively',()=>{
 const effects=setupBuffs();controller.start();targets=[];time=1000;controller.tick();
 expect(data.buff).toHaveBeenCalledOnce();expect(data.act).not.toHaveBeenCalled();
 effects.add(10);controller.skillFeedback({id:34,phase:'executed'});controller.tick();
 expect(data.buff).toHaveBeenCalledTimes(2);
});
it('skips unavailable buffs and continues attacking after buff failures or missing confirmation',()=>{
 setupBuffs();skills[1].available=skills[2].available=false;
 controller.start();controller.skillFeedback({id:34,phase:'failed'});
 time=1000;controller.tick();expect(data.act).toHaveBeenLastCalledWith(expect.anything(),null);
 time=11000;controller.tick();expect(data.buff).toHaveBeenCalledTimes(2);
 time=19000;controller.tick();time=19200;controller.tick();expect(data.act).toHaveBeenCalledTimes(2);
});
it('pauses buff maintenance during manual movement and does not immediately spam dispelled buffs',()=>{
 const effects=setupBuffs();skills[1].available=skills[2].available=false;targets=[];
 controller.start();effects.add(10);controller.skillFeedback({id:34,phase:'executed'});
 time=1000;controller.tick();effects.delete(10);time=2000;controller.tick();expect(data.buff).toHaveBeenCalledOnce();
 controller.pauseForMovement();time=12000;controller.tick();expect(data.buff).toHaveBeenCalledOnce();
 controller.resumeAfterMovement();controller.tick();expect(data.buff).toHaveBeenCalledTimes(2);
});

it('does not exhaust the buff allowance on unreachable monsters',()=>{
 const effects=setupBuffs();data.reachable=()=>false;controller.start();
 effects.add(10);controller.skillFeedback({id:34,phase:'executed'});time=1000;controller.tick();
 effects.add(12);controller.skillFeedback({id:29,phase:'executed'});time=2000;controller.tick();
 expect(data.buff).toHaveBeenCalledTimes(3);expect(data.act).not.toHaveBeenCalled();
});

it('guarantees attacks between utilities and suppresses repeated successful utility casts',()=>{
 targets=[mob(1)];skills=[{id:6,kind:'utility',available:true}];controller.configure([],[6],{search:20,activity:30});controller.start();
 controller.skillFeedback({id:6,phase:'executed',target:1});time=1000;controller.tick();expect(data.act.mock.calls.at(-1)[1]).toBeNull();
 time=2000;controller.tick();expect(data.act.mock.calls.at(-1)[1]).toBeNull();
 expect(data.act.mock.calls.filter(([,skill])=>skill?.id===6)).toHaveLength(1);
});
it('does not start a self-area request until approach completes',()=>{
 targets=[mob(1)];skills=[{id:7,kind:'attack',aim:'self',radius:2,available:true}];data.prepare=vi.fn(()=> 'approaching');
 controller.configure([],[7],{search:20,activity:30});controller.start();expect(data.act).not.toHaveBeenCalled();
 data.prepare.mockReturnValue(true);time=1000;controller.tick();expect(data.act).toHaveBeenCalledOnce();
});
it('preserves pending casts when a manual target switch is invalid',()=>{
 targets=[mob(1)];skills=[{id:19,available:true}];controller.configure([],[19],{search:20,activity:30});controller.start();
 expect(controller.attackTarget(999)).toBe(false);time=1000;controller.tick();expect(data.act).toHaveBeenCalledOnce();
 controller.skillFeedback({id:19,phase:'executed',target:1});controller.tick();expect(data.act).toHaveBeenCalledTimes(2);
});
it('provides a normal attack even when a damage-labelled skill only acknowledges empty effects',()=>{
 targets=[mob(1)];skills=[{id:19,available:true}];controller.configure([],[19],{search:20,activity:30});controller.start();
 controller.skillFeedback({id:19,phase:'executed',target:1,damage:-1});time=1000;controller.tick();
 controller.skillFeedback({id:19,phase:'executed',target:1,damage:0});time=2000;controller.tick();expect(data.act.mock.calls.at(-1)[1]).toBeNull();
 time=3000;controller.tick();expect(data.act.mock.calls.at(-1)[1].id).toBe(19);
});

it('clamps saved and configured search radii to live server limits without changing activity', () => {
 let limit = 20; data.searchLimit = () => limit;
 controller = createAutoCombatController(data, { species: [], skills: [], ranges: { search: 40, activity: 50 } });
 expect(controller.snapshot().ranges).toEqual({ search: 20, activity: 50 });
 data.saveSettings = vi.fn(() => true);
 expect(controller.configure([], [], { search: 40, activity: 50 })).toBe(true);
 expect(data.saveSettings.mock.calls[0][0].ranges).toEqual({ search: 20, activity: 50 });
 limit = 12; expect(controller.snapshot().ranges).toEqual({ search: 12, activity: 50 });
 limit = 25; expect(controller.snapshot().ranges).toEqual({ search: 12, activity: 50 });
 limit = 12;
 targets = [mob(1,1002,15),mob(2,1002,10)]; controller.start();
 expect(data.act).toHaveBeenLastCalledWith(targets[1], null);
 limit = 8; controller.tick(); expect(controller.snapshot().target).toBe('');
});
it('waits for server limits and cannot cast, chase or teleport while they are unknown', () => {
 data.searchLimit = () => null; data.teleport = vi.fn();
 controller.start(); time = 10000; controller.tick();
 expect(controller.snapshot().status).toBe('正在获取搜怪范围');
 expect(data.act).not.toHaveBeenCalled(); expect(data.teleport).not.toHaveBeenCalled();
 expect(controller.configure([],[],{search:20,activity:30})).toBe(false);
 data.searchLimit = () => 20; controller.tick(); expect(data.act).toHaveBeenCalled();
});
