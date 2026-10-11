vi.mock('UI/Components/Guild/Guild.js', () => ({default:{getSocialSnapshot:()=>({skills:[]})}}));
import { beforeEach, expect, it, vi } from 'vitest';
const s = vi.hoisted(() => ({
	session: { Playing: true, FreezeUI: false, Entity: { action: 0, ACTION: { DIE: 99 }, life: { sp: 10 } } },
	skill: { SKID: 1, level: 3, type: 4, spcost: 15 },
	bindings: [{ isSkill: true, ID: 1, count: 3 }],
	items: [], companions: new Map(), homSkills: [], mercSkills: [],
	selection: { onUseSkillToId: vi.fn(), onUseSkillToPos: vi.fn(), checkMapState: () => false },
	useItem: vi.fn(), configure: vi.fn(() => true)
}));
vi.mock('UI/Components/ShortCut/ShortCut.js', () => ({
	default: { getList: () => s.bindings, getSkillById: () => s.skill, configure: s.configure }
}));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({
	default: {
		getUI: () => ({ list: s.items, getItemById: id => s.items.find(i => i.ITID === id), useItem: s.useItem })
	}
}));
vi.mock('UI/Components/SkillList/SkillList.js', () => ({ default: { getUI: () => ({ getSkills: () => s.skill.SKID < 8000 ? [s.skill] : [] }) } }));
vi.mock('UI/Components/SkillTargetSelection/SkillTargetSelection.js', () => ({ default: s.selection }));
vi.mock('DB/Skills/SkillInfo.generated.js', () => ({ default: { 1: { Name: 'test', SkillName: '测试技能' } } }));
vi.mock('DB/DBManager.js', () => ({
	default: {
		INTERFACE_PATH: 'ui/',
		getItemInfo: () => ({ identifiedResourceName: 'potion', identifiedDisplayName: '药水' }),
		getItemName: () => '药水'
	}
}));
vi.mock('Core/Client.js', () => ({
	default: { loadFile: (path, callback) => callback('data:image/png;base64,AA==') }
}));
vi.mock('Engine/SessionStorage.js', () => ({ default: s.session }));
vi.mock('UI/Components/SkillListMH/SkillListMH.js',()=>({default:{homunculus:{getSkills:()=>s.homSkills},mercenary:{getSkills:()=>s.mercSkills}}}));
vi.mock('Renderer/EntityManager.js', () => ({ default: { get:id=>s.companions.get(id), getFocusEntity: () => null, setSupportPicking: vi.fn() } }));
vi.mock('Renderer/Camera.js', () => ({ default: {} }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: {} }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: {} }));
import { createGameShortcuts } from '../../src/UI/Game/GameShortcuts.js';
beforeEach(() => {
	vi.clearAllMocks();
 s.companions.clear(); s.homSkills=[]; s.mercSkills=[]; s.session.homunId=31; s.session.mercId=32;
	s.session.FreezeUI = false;
	s.session.Entity.life.sp = 10;
	s.bindings = [{ isSkill: true, ID: 1, count: 3 }];
	s.items = [];
});
it('uses server SP cost at learned level, blocks external modals, and leaves lower-level costs to the server', () => {
	const service = createGameShortcuts();
	expect(service.snapshot().slots[0].reason).toBe('SP 不足');
	s.bindings[0].count = 1;
	expect(service.snapshot().slots[0].available).toBe(true);
	s.session.FreezeUI = true;
	service.use(0);
	expect(s.selection.onUseSkillToId).not.toHaveBeenCalled();
	expect(service.snapshot().slots[0].available).toBe(false);
	s.session.FreezeUI = false;
	service.use(0);
	expect(s.selection.onUseSkillToId).toHaveBeenCalledExactlyOnceWith(1, 1, undefined, { allowMove: true });
});
it('updates item count and identity from live data and passes joystick ownership to shared skill use', () => {
	const service = createGameShortcuts(() => true);
	s.bindings[0].count = 1;
	service.use(0);
	expect(s.selection.onUseSkillToId).toHaveBeenCalledWith(1, 1, undefined, { allowMove: false });
	s.bindings = [{ isSkill: false, ID: 501, count: 0 }];
	expect(service.snapshot().slots[0].reason).toBe('道具已用完');
	s.items = [{ ITID: 501, index: 2, type: 0, count: 4, IsIdentified: true }];
	expect(service.snapshot().slots[0].amount).toBe(4);
	expect(service.snapshot().slots[0].icon).toContain('data:image');
	service.use(0);
	expect(s.useItem).toHaveBeenCalledWith(s.items[0]);
	s.items[0].count = 0;
	service.use(0);
	expect(s.useItem).toHaveBeenCalledTimes(1);
});

it('configures and uses non-stackable equipment even when packet data omits quantity', () => {
 const service = createGameShortcuts();
 s.items = [{ ITID: 1201, index: 7, type: 5, IsIdentified: true }];
 s.bindings = [{ isSkill: false, ID: 1201, count: 0 }];
 expect(service.candidates().some(item => item.ID === 1201)).toBe(true);
 expect(service.configure(0, { isSkill: false, ID: 1201 })).toBe(true);
 expect(s.configure).toHaveBeenCalledWith(0, false, 1201, 0);
 expect(service.snapshot().slots[0].amount).toBe(1);
 expect(service.snapshot().slots[0].available).toBe(true);
 service.use(0); expect(s.useItem).toHaveBeenCalledExactlyOnceWith(s.items[0]);
});
it('rejects a saved guild shortcut after leaving the guild or losing master rights',()=>{
 const originalSkill=s.skill;s.skill={SKID:10013,level:1,type:4,spcost:0};s.bindings=[{isSkill:true,ID:10013,count:1}];
 s.session.hasGuild=true;s.session.isGuildMaster=true;const service=createGameShortcuts();expect(service.snapshot().slots[0].available).toBe(true);
 s.session.isGuildMaster=false;service.use(0);expect(s.selection.onUseSkillToId).not.toHaveBeenCalled();expect(service.snapshot().slots[0].reason).toContain('权限');
 s.session.isGuildMaster=true;s.session.hasGuild=false;expect(service.snapshot().slots[0].available).toBe(false);s.skill=originalSkill;
});

it.each([[8044,31,'homSkills'],[8201,32,'mercSkills']])('uses companion SP and includes learned skill %i in candidates', (id,gid,list)=>{
 const old=s.skill; s.skill={SKID:id,level:1,type:4,spcost:15};s[list]=[s.skill];s.bindings=[{isSkill:true,ID:id,count:1}];
 const actor={GID:gid,life:{sp:20},ACTION:{DIE:99},action:0};s.companions.set(gid,actor);
 const service=createGameShortcuts();expect(service.snapshot().slots[0].available).toBe(true);
 expect(service.candidates().some(c=>c.ID===id)).toBe(true);
 actor.life.sp=0;expect(service.snapshot().slots[0].reason).toBe('SP 不足');
 actor.life.sp=20;s.companions.delete(gid);service.use(0);expect(s.selection.onUseSkillToId).not.toHaveBeenCalled();
 expect(service.snapshot().slots[0].reason).toBe('施法者不可用');expect(service.candidates().some(c=>c.ID===id)).toBe(false);s.skill=old;
});

it('includes original skill tiers and item types in shortcut candidates', () => {
 const previousSkill = s.skill;
 s.session.Entity._job = 7;
 s.skill = { SKID: 5, level: 1, type: 4, spcost: 0 };
 s.items = [{ ITID: 1201, type: 5, IsIdentified: true }];
 const service = createGameShortcuts();
 expect(service.candidates().find(entry => entry.ID === 5)).toMatchObject({ tier: '一转', isSkill: true });
 expect(service.candidates().find(entry => entry.ID === 1201)).toMatchObject({ type: 5, isSkill: false });
 s.skill = { ...s.skill, SKID: 56 };
 expect(service.candidates().find(entry => entry.ID === 56)).toMatchObject({ tier: '二转' });
 s.skill = previousSkill;
 delete s.session.Entity._job;
});
