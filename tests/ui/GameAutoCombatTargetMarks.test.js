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

import { createTargetStatuses } from '../../src/Network/TargetStatuses.js';
import Status from '../../src/DB/Status/StatusConst.js';
it('keeps a marked attack available globally but rejects an unmarked current target', () => {
 playerStatuses.clear();
 playerStatuses.update({index: Status.SECOND_JUDGE, state: 1});
 state.session.Entity.life.sp = 1000;
 state.skills = [{SKID: 5250, type: 1, level: 1, spcost: 1}];
 const status = createTargetStatuses();
 status.update({index: Status.FIRST_BRAND, state: 0});
 status.update({index: Status.SECOND_BRAND, state: 0});
 state.entities[0].combatStatuses = status;
 const controller = createGameAutoCombat(() => true);
 expect(controller.skills()[0].reason).toBe('需要带有烙印的目标');
 const marked = {...state.entities[0], GID: 11, position:[3,0], combatStatuses:createTargetStatuses()};
 marked.combatStatuses.update({index: Status.FIRST_BRAND, state: 1});
 state.entities.push(marked);
 expect(controller.skills()[0].available).toBe(true);
 controller.configure([], [5250], {search:20, activity:30}); controller.start();
 expect(state.cast).not.toHaveBeenCalled();
 expect(state.attack).toHaveBeenCalled();
 playerStatuses.clear();
});
it('allows a mark-dependent skill when target data has not arrived', () => {
 playerStatuses.clear();
 playerStatuses.update({index: Status.SECOND_JUDGE, state:1});
 state.session.Entity.life.sp = 1000;
 state.skills = [{SKID:5250,type:1,level:1,spcost:1}];
 const controller=createGameAutoCombat(()=>true);
 expect(controller.skills()[0].reason).toBe('');
 controller.configure([], [5250], {search:20,activity:30});controller.start();
 expect(state.cast).toHaveBeenCalledWith(5250,1,10);
 playerStatuses.clear();
});
