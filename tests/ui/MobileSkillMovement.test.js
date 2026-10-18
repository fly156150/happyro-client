vi.mock('UI/Game/GameVending.js',()=>({showOwnedVending:vi.fn(()=>false)}));
vi.mock('UI/Platform.js',()=>({default:{isMobile:true}}));
vi.mock('UI/Game/GameSelection.js',()=>({openGameSelection:vi.fn(),selectionEntries:vi.fn()}));
vi.mock('UI/Game/GameMonsterInformation.js',()=>({openMonsterInformation:vi.fn()}));
import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
	selection: {},
	companions: new Map(),
	session: { Entity: null, moveAction: null },
	send: vi.fn(),
	search: vi.fn(),
	target: { GID: 22, position: [10, 10] }
}));
vi.mock('DB/DBManager.js', () => ({ default: {} }));
vi.mock('UI/UIManager.js', () => ({ default: {} }));

vi.mock('DB/Skills/SkillInfo.generated.js', () => ({ default: {} }));
vi.mock('DB/Effects/EffectConst.js', () => ({ default: {} }));
vi.mock('Utils/PathFinding.js', () => ({ default: { search: state.search } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: state.session }));
vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: state.send, hookPacket: vi.fn() } }));
vi.mock('Network/PacketVerManager.js', () => ({ default: { value: 20211103 } }));
vi.mock('Network/PacketStructure.js', () => ({
	default: {
		CZ: {
			USE_SKILL2: class {},
			USE_SKILL_TOGROUND3: class {},
			REQUEST_MOVENPC: class { dest = []; },
			REQUEST_MOVE2: class {
				dest = [];
			}
		},
		ZC: {}
	}
}));
vi.mock('Renderer/EntityManager.js', () => ({ default: { get: id => (id === 22 ? state.target : state.companions.get(id)) } }));
vi.mock('Renderer/EffectManager.js', () => ({ default: {} }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: { TYPE: { WALKABLE: 1 } } }));
vi.mock('UI/Components/ShortCut/ShortCut.js', () => ({ default: {} }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({ default: {} }));
vi.mock('UI/Components/SkillTargetSelection/SkillTargetSelection.js', () => ({ default: state.selection }));
vi.mock('UI/Components/Guild/Guild.js', () => ({ default: {} }));
vi.mock('UI/Components/SkillListMH/SkillListMH.js', () => ({ default: { homunculus: {getSkillById: () => ({attackRange: 4})}, mercenary: {getSkillById: () => ({attackRange: 5})} } }));
vi.mock('UI/Components/ItemSelection/ItemSelection.js', () => ({ default: {} }));
vi.mock('UI/Components/MakeArrowSelection/MakeArrowSelection.js', () => ({ default: {} }));
vi.mock('UI/Components/RefineWeaponSelection/RefineWeaponSelection.js', () => ({ default: {} }));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({ default: {} }));
vi.mock('UI/Components/NpcMenu/NpcMenu.js', () => ({ default: {} }));
vi.mock('UI/Components/Sense/Sense.js', () => ({ default: {} }));
vi.mock('UI/Components/Announce/Announce.js', () => ({ default: {} }));
vi.mock('Renderer/Renderer.js', () => ({ default: { tick: 1000 } }));
vi.mock('UI/Components/SkillList/SkillList.js', () => ({
	default: { getUI: () => ({ getSkillById: () => ({ attackRange: 1 }) }) }
}));
vi.mock('UI/Components/CartDecoration/CartDecoration.js', () => ({ default: {} }));
vi.mock('./SkillFail.js', () => ({ skillFailMessage: vi.fn() }));
vi.mock('Renderer/Effects/SnowWeather.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/RainWeather.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/PokJukWeatherEffect.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/SakuraWeatherEffect.js', () => ({ default: {} }));
vi.mock('Renderer/Effects/CloudWeatherEffect.js', () => ({ default: {} }));
import '../../src/Engine/MapEngine/Skill.js';
beforeEach(() => {
	vi.clearAllMocks();
	state.companions.clear();
	state.session.homunId = 31;
	state.session.mercId = 32;
	state.session.Entity = { GID: 11, position: [0, 0], amotionTick: 0, attack_range: 1 };
	state.session.moveAction = null;
	state.search.mockImplementation((x, y, tx, ty, range, out) => {
		out.push(0, 0, 1, 1, 2, 2);
		return 3;
	});
});
it('preserves default desktop chase and suppresses chasing when a touch joystick owns movement', () => {
	state.selection.onUseSkillToId(100, 2, 22, { allowMove: false });
	expect(state.send).not.toHaveBeenCalled();
	expect(state.session.moveAction).toBeNull();
	state.selection.onUseSkillToId(100, 2, 22);
	expect(state.send.mock.calls.at(-1)[0].dest).toEqual([2, 2]);
	expect(state.session.moveAction).toMatchObject({ SKID: 100, selectedLevel: 2, targetID: 22 });
});
it('allows an in-range skill during movement without emitting a walk request', () => {
	state.search.mockReturnValue(1);
	state.selection.onUseSkillToId(100, 2, 22, { allowMove: false });
	expect(state.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ SKID: 100, targetID: 22 }));
	expect(state.session.moveAction).toBeNull();
});

it.each([[8044,31,5],[8060,31,5],[8201,32,6],[8241,32,6]])('casts companion skill %i from its own position and server range', (skill,id,range) => {
 const entity={GID:id,position:[6,7],amotionTick:0,attack_range:1};
 state.companions.set(id,entity);
 state.search.mockReturnValue(1);
 state.selection.onUseSkillToId(skill,1);
 expect(state.search.mock.calls[0].slice(0,5)).toEqual([6,7,6,7,range]);
 expect(state.send.mock.calls[0][0]).toMatchObject({SKID:skill,targetID:id});
 state.selection.onUseSkillToPos(skill,1,9,10);
 expect(state.search.mock.calls[1].slice(0,5)).toEqual([6,7,9,10,range]);
 expect(state.send.mock.calls[1][0]).toMatchObject({SKID:skill,xPos:9,yPos:10});
});
it.each([8044,8201])('ignores unavailable companion %i without sending player movement', skill => {
 expect(()=>state.selection.onUseSkillToId(skill,1,22)).not.toThrow();
 expect(()=>state.selection.onUseSkillToPos(skill,1,9,10)).not.toThrow();
 expect(state.send).not.toHaveBeenCalled();
 expect(state.search).not.toHaveBeenCalled();
});
it('uses mercenary movement packets for an out-of-range ground skill', () => {
 state.companions.set(32,{GID:32,position:[6,7],amotionTick:0});
 state.selection.onUseSkillToPos(8201,1,9,10);
 expect(state.send.mock.calls[0][0]).toMatchObject({GID:32,dest:[2,2]});
 expect(state.session.moveAction).toBeNull();
 expect(typeof state.companions.get(32).onWalkEnd).toBe("function");
});

it('ignores ground casts after the player entity is released',()=>{
 state.session.Entity=null;
 expect(()=>state.selection.onUseSkillToPos(100,1,9,10)).not.toThrow();
 expect(state.send).not.toHaveBeenCalled();
});

it('reopens an owned vending store instead of sending another skill request',async()=>{
 const {showOwnedVending}=await import('../../src/UI/Game/GameVending.js');
 showOwnedVending.mockReturnValueOnce(true);state.send.mockClear();
 state.selection.onUseSkillToId(41,10);
 expect(showOwnedVending).toHaveBeenCalled();expect(state.send).not.toHaveBeenCalled();
});
