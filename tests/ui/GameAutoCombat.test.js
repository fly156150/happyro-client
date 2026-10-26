import { updateCombatLimits } from '../../src/Network/CombatLimits.js';
vi.mock('UI/Components/GameTools/AdventureActionService.js', () => ({ getCurrentAdventureMap: () => 'izlude', normalizeAdventureMap: value => value, getAdventureActionState: () => ({ allowed: false }), teleportToCoordinate: vi.fn() }));
import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ session: {}, entities: [], skills: [], equipment: [], inventory: [], focus: null, cast: vi.fn(), ground: vi.fn(), attack: vi.fn(), stop: vi.fn(), send: vi.fn(), cooldown: 0, path: 1 }));
vi.mock('Engine/SessionStorage.js', () => ({ default: state.session }));
vi.mock('Renderer/EntityManager.js', () => ({ default: {
	forEach: fn => state.entities.forEach(fn), get: id => state.entities.find(entity => entity.GID === id),
	getFocusEntity: () => state.focus, setFocusEntity: target => { state.focus = target; }, setOverEntity: vi.fn()
} }));
vi.mock('Renderer/Renderer.js', () => ({ default: { tick: 1000 } }));
vi.mock('Controls/MapControl.js', () => ({ default: { onRequestStopWalk: vi.fn() } }));
vi.mock('Utils/PathFinding.js', () => ({ default: { search: (...args) => { if(state.pathPoints) args[5].push(...state.pathPoints); return state.path; } } }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: { TYPE: { WALKABLE: 1 } } }));
vi.mock('UI/Components/SkillList/SkillList.js', () => ({ default: { getUI: () => ({ getSkills: () => state.skills }) } }));
vi.mock('UI/Components/SkillTargetSelection/SkillTargetSelection.js', () => ({ default: { remove: vi.fn(), onUseSkillToId: state.cast, onUseSkillToPos: state.ground } }));
vi.mock('DB/Skills/SkillInfo.generated.js', () => ({ default: {} }));
vi.mock('DB/DBManager.js', () => ({ default: { getMonsterName: () => '波利' } }));
vi.mock('Network/SkillCooldowns.js', () => ({ remainingCooldown: () => state.cooldown }));
vi.mock('UI/Components/Navigation/Navigation.js', () => ({ default: { stopAutoWalk: vi.fn() } }));
vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: state.send } }));
vi.mock('Network/PacketStructure.js', () => ({ default: { CZ: { HAPPYRO_STOP_MOVE: class {}, REQUEST_MOVE2: class { constructor(){this.dest=[];} } } } }));
vi.mock('UI/Game/GameCommands.js', () => ({ attackSelected: (moving, onRequest) => { state.attack(moving, onRequest); onRequest?.(); }, stopAttack: () => { state.stop(); state.session.moveAction = null; } }));
vi.mock('UI/Components/Inventory/Inventory.js',()=>({default:{getUI:()=>({list:state.inventory})}}));
vi.mock('UI/Components/Equipment/Equipment.js',()=>({default:{getUI:()=>({getItems:()=>state.equipment})}}));
import PACKET from '../../src/Network/PacketStructure.js';
import { playerStatuses } from '../../src/Network/PlayerStatuses.js';
import { createGameAutoCombat } from '../../src/UI/Game/GameAutoCombat.js';
beforeEach(() => {
 updateCombatLimits({ searchRadius: 50 });
	localStorage.clear();
	vi.clearAllMocks(); state.focus = null; state.cooldown = 0; state.path = 1; state.pathPoints = null;
	state.equipment = []; state.inventory = [];
	state.session.Playing = true; state.session.moveAction = null;
	state.session.Entity = { position: [0, 0], life: { sp: 20 }, action: 0, ACTION: { DIE: 9, SIT: 2 }, cast: { display: false }, amotionTick: 0 };
	state.entities = [{ GID: 10, job: 1002, objecttype: 1, constructor: { TYPE_MOB: 1 }, action: 0, ACTION: { DIE: 9 }, remove_tick: 0, display: { name: '波利' }, position: [2, 0], onFocus: vi.fn(), onFocusEnd: vi.fn() }];
	state.skills = [{ SKID: 5, type: 1, level: 3, spcost: 8 }];
});
it('selects real monsters and casts the learned level at the live GID', () => {
	const controller = createGameAutoCombat(() => true); controller.configure([{ id: 1002, name: '波利' }], [5], { search: 20, activity: 30 }); controller.start();
	expect(state.focus).toBe(state.entities[0]); expect(state.cast).toHaveBeenCalledExactlyOnceWith(5, 3, 10);
});
it('casts ground skills at the target position and excludes passive and friendly-only skills', () => {
	state.skills = [{ SKID: 18, type: 2, level: 2, spcost: 5 }, { SKID: 21, type: 0, level: 2 }, { SKID: 22, type: 16, level: 2 }];
	const controller = createGameAutoCombat(() => true); expect(controller.skills()).toHaveLength(1);
	controller.configure([], [18], { search: 20, activity: 30 }); controller.start(); expect(state.ground).toHaveBeenCalledExactlyOnceWith(18, 2, 2, 0);
});
it('falls back to ordinary attacks during a confirmed cooldown', () => {
	state.cooldown = 1000;
	const controller = createGameAutoCombat(() => true); controller.configure([], [5], { search: 20, activity: 30 }); controller.start();
	expect(state.attack).toHaveBeenCalledOnce(); expect(state.cast).not.toHaveBeenCalled();
});
it('ignores dead, disappearing, non-monster and unreachable entities', () => {
	state.entities[0].remove_tick = 1;
	const controller = createGameAutoCombat(() => true); controller.start(); expect(state.attack).not.toHaveBeenCalled();
	state.entities[0].remove_tick = 0; state.entities[0].action = 9; controller.tick(); expect(state.attack).not.toHaveBeenCalled();
	state.entities[0].action = 0; state.entities[0].objecttype = 2; controller.tick(); expect(state.attack).not.toHaveBeenCalled();
	state.entities[0].objecttype = 1; state.path = 0; controller.tick(); expect(state.attack).not.toHaveBeenCalled();
});
it('cancels a queued chase without sending an outdated client coordinate', () => {
	state.attack.mockImplementationOnce(() => { state.session.moveAction = { targetID: 10 }; });
	const controller = createGameAutoCombat(() => true);
	controller.start();
	state.session.Entity.position = [10.2, 20.7];
	state.session.autoFollow = true;
	controller.stop();
	expect(state.session.moveAction).toBeNull();
	expect(state.session.autoFollow).toBe(false);
	expect(state.send).toHaveBeenCalledExactlyOnceWith(expect.any(PACKET.CZ.HAPPYRO_STOP_MOVE));
	expect(state.send.mock.calls[0][0]).not.toHaveProperty('dest');
	controller.stop();
	controller.tick();
	expect(state.send).toHaveBeenCalledOnce();
});
it('stops attacks before stopping the chase and also uses it when manual movement pauses combat', () => {
	state.attack.mockImplementationOnce(() => { state.session.moveAction = { targetID: 10 }; });
	const controller = createGameAutoCombat(() => true);
	controller.start();
	vi.clearAllMocks();
	controller.pauseForMovement();
	expect(state.stop).toHaveBeenCalledOnce();
	expect(state.send).toHaveBeenCalledExactlyOnceWith(expect.any(PACKET.CZ.HAPPYRO_STOP_MOVE));
	expect(state.stop.mock.invocationCallOrder[0]).toBeLessThan(state.send.mock.invocationCallOrder[0]);
	expect(controller.snapshot().pausedForMovement).toBe(true);
});
it.each(['idle', 'dead', 'disconnected'])('does not send a stop movement request while %s', mode => {
	const controller = createGameAutoCombat(() => true);
	controller.start();
	if (mode !== 'idle') state.session.moveAction = { targetID: 10 };
	if (mode === 'dead') state.session.Entity.action = state.session.Entity.ACTION.DIE;
	if (mode === 'disconnected') state.session.Playing = false;
	controller.stop();
	expect(state.send).not.toHaveBeenCalled();
});
it('stops when the player becomes unavailable and never casts through a busy cast bar', () => {
	const controller = createGameAutoCombat(() => true); state.session.Entity.cast.display = true; controller.start(); expect(state.attack).not.toHaveBeenCalled();
	state.session.Entity.isOverWeight = true; controller.tick(); expect(controller.snapshot().active).toBe(false);
});

it('does not cancel pickup or newer manual movement when combat stops', () => {
 for (const replacement of [{ ITAID: 123 }, { targetID: 20 }]) {
  state.attack.mockImplementationOnce(() => { state.session.moveAction = { targetID: 10 }; });
  const controller = createGameAutoCombat(() => true); state.session.moveAction = null; controller.start();
  state.session.moveAction = replacement; vi.clearAllMocks(); controller.stop();
  expect(state.session.moveAction).toBe(replacement); expect(state.stop).not.toHaveBeenCalled(); expect(state.send).not.toHaveBeenCalled();
 }
});
it('tracks replacement chase requests created by a server attack retry', () => {
 const controller = createGameAutoCombat(() => true); controller.start();
 const capture = state.attack.mock.calls.at(-1)[1];
 state.session.moveAction = { targetGID: 10 }; capture(); vi.clearAllMocks(); controller.stop();
 expect(state.session.moveAction).toBeNull(); expect(state.send).toHaveBeenCalledOnce();
});

it('prioritizes counters against the live target while keeping only selected available skills', () => {
 state.skills = [{SKID:19,type:1,level:5,spcost:1},{SKID:20,type:1,level:5,spcost:1}];
 const controller=createGameAutoCombat(()=>true);
 controller.configure([],[19,20],{search:20,activity:30});
 controller.start(); // Poring: Water 1, so lightning instead of fire.
 expect(state.cast).toHaveBeenLastCalledWith(20,5,10);
 controller.stop();state.cast.mockClear();
 controller.configure([],[19],{search:20,activity:30});controller.start();
 expect(state.cast).toHaveBeenLastCalledWith(19,5,10);
});
it('makes offensive healing selectable but never casts it on a living-element target', () => {
 state.skills=[{SKID:28,type:16,level:5,spcost:1}];
 const controller=createGameAutoCombat(()=>true);
 expect(controller.skills().map(skill=>skill.id)).toContain(28);
 controller.configure([],[28],{search:20,activity:30});controller.start();
 expect(state.cast).not.toHaveBeenCalled();expect(state.attack).toHaveBeenCalledOnce();
 controller.stop();state.cast.mockClear();state.entities[0].job=1015; // Zombie, Undead 1.
 controller.start();expect(state.cast).toHaveBeenLastCalledWith(28,5,10);
});

it('offers audited buffs and targets the player without focusing a monster', async () => {
 const {playerStatuses}=await import('../../src/Network/PlayerStatuses.js');playerStatuses.clear();
 state.session.Entity.GID=99;state.session.Entity.life.hp=100;
 state.skills=[{SKID:34,type:16,level:3,spcost:8},{SKID:29,type:16,level:3,spcost:8},{SKID:45,type:4,level:2,spcost:8}];
 const controller=createGameAutoCombat(()=>true);
 expect(controller.skills().every(skill=>skill.kind==='buff')).toBe(true);
 controller.configure([],[34],{search:20,activity:30});controller.start();
 expect(state.cast).toHaveBeenCalledExactlyOnceWith(34,3,99);expect(state.focus).toBeNull();
 controller.stop();playerStatuses.clear();
});
it('preserves existing buffs and blocks unsafe undead self buffs or insufficient HP', async () => {
 const {playerStatuses}=await import('../../src/Network/PlayerStatuses.js');playerStatuses.clear();
 state.session.Entity.GID=99;state.session.Entity.life.hp=15;
 state.skills=[{SKID:34,type:16,level:3,spcost:8},{SKID:29,type:16,level:3,spcost:8}];
 const controller=createGameAutoCombat(()=>true);
 expect(controller.skills().find(s=>s.id===29).available).toBe(false);
 playerStatuses.update({index:97,state:1,RemainMS:10000});
 expect(controller.skills().every(s=>!s.available)).toBe(true);
 playerStatuses.clear();playerStatuses.update({index:10,state:1,RemainMS:10000});
 controller.configure([],[34],{search:20,activity:30});controller.start();
 expect(state.cast).not.toHaveBeenCalled();expect(state.attack).toHaveBeenCalledOnce();
 controller.stop();playerStatuses.clear();
});

it('approaches the actual self-area radius before sending the skill to the player',()=>{
 const now=vi.spyOn(performance,'now').mockReturnValue(0);
 try {
  state.session.Entity.GID=99;state.session.Entity.life.sp=100;state.entities[0].position=[10,0];
  state.skills=[{SKID:7,type:4,level:10,spcost:30}];state.path=3;state.pathPoints=[0,0,4,0,8,0];
  const controller=createGameAutoCombat(()=>true);controller.configure([],[7],{search:20,activity:30});controller.start();
  expect(state.cast).not.toHaveBeenCalled();expect(state.send.mock.calls.at(-1)[0].dest).toEqual([8,0]);
  state.session.Entity.position=[8,0];state.path=1;state.pathPoints=null;now.mockReturnValue(1000);controller.tick();
  expect(state.cast).toHaveBeenCalledExactlyOnceWith(7,10,99);
 } finally {now.mockRestore();}
});

// Real 20211103 item type/slot values: armor=4, weapon=5, both hands=34.
it('updates spear skill eligibility from live equipment without recreating combat', () => {
 state.session.Entity.life.sp=200;
 state.skills=[{SKID:56,type:1,level:5,spcost:7}];
 const controller=createGameAutoCombat(()=>true);
 expect(controller.skills()[0].reason).toBe('武器类型不符');
 state.equipment=[{ITID:1464,index:93,type:5,equipped:34,location:34}];
 expect(controller.skills()[0].reason).toBe('');
 state.equipment=[];
 expect(controller.skills()[0].reason).toBe('武器类型不符');
});
it('requires a real equipped shield and never mistakes a two-handed weapon for one', () => {
 state.session.Entity.life.sp=200;
 state.skills=[{SKID:250,type:1,level:5,spcost:10}];
 const controller=createGameAutoCombat(()=>true);
 state.equipment=[{ITID:1464,index:93,type:5,equipped:34,location:34}];
 expect(controller.skills()[0].reason).toBe('需要盾牌');
 state.equipment=[{ITID:2101,index:94,type:4,equipped:32,location:32}];
 expect(controller.skills()[0].reason).toBe('');
});

it('reclassifies Climax ground spells from live status without recreating combat', () => {
 state.session.Entity.life.sp=1000;
 state.skills=[{SKID:5222,type:2,level:5,spcost:1}];
 const controller=createGameAutoCombat(()=>true);
 playerStatuses.clear();
 try {
  expect(controller.skills()[0].kind).toBe('attack');
  playerStatuses.update({index:1152,state:1,RemainMS:10000,val:[4]});
  expect(controller.skills()[0].kind).toBe('utility');
  playerStatuses.clear();
  expect(controller.skills()[0].kind).toBe('attack');
 } finally {playerStatuses.clear();}
});

it('does not block on base SP cost when the server-only final cost is unknown', () => {
 state.session.Entity.life.sp = 1;
 state.skills = [{ SKID: 5, type: 1, level: 3, spcost: 80 }];
 const controller = createGameAutoCombat(() => true);
 expect(controller.skills()[0].reason).toBe('');
 controller.configure([], [5], { search: 20, activity: 30 });
 controller.start();
 expect(state.cast).toHaveBeenCalledExactlyOnceWith(5, 3, 10);
});
