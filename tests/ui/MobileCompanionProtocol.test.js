import { beforeEach, expect, it, vi } from 'vitest';
const s = vi.hoisted(() => ({ mobile: true, entity: null, hooks: new Map(), session: {}, info: vi.fn(), feed: vi.fn(), hom: { append: vi.fn(), setInformations: vi.fn(), startAI: vi.fn() }, merc: { append: vi.fn(), setInformations: vi.fn(), startAI: vi.fn() } }));
vi.mock('UI/Platform.js', () => ({ default: { get isMobile() { return s.mobile; } } }));
vi.mock('UI/Game/GameCompanions.js', () => ({ updateGameCompanion: s.info, receiveGameCompanionFeed: s.feed }));
vi.mock('Engine/SessionStorage.js', () => ({ default: s.session }));
vi.mock('Renderer/EntityManager.js', () => ({ default: { get: () => s.entity, storeLife: vi.fn() } }));
vi.mock('UI/Components/HomunInformations/HomunInformations.js', () => ({ default: s.hom }));
vi.mock('UI/Components/MercenaryInformations/MercenaryInformations.js', () => ({ default: s.merc }));
vi.mock('UI/Components/SkillListMH/SkillListMH.js', () => ({ default: { homunculus: { setSkills: vi.fn(), updateSkill: vi.fn() }, mercenary: { setSkills: vi.fn(), updateSkill: vi.fn() } } }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: {} }));
vi.mock('UI/UIManager.js', () => ({ default: {} }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({ default: { addText: vi.fn(), TYPE: { ERROR: 0 }, FILTER: { PUBLIC_LOG: 0 } } }));
vi.mock('DB/DBManager.js', () => ({ default: { getMessage: () => '%s', getItemInfo: () => ({ identifiedDisplayName: '食物' }) } }));
vi.mock('Network/NetworkManager.js', () => ({ default: { hookPacket: (type, fn) => s.hooks.set(type, fn) } }));
vi.mock('Network/PacketStructure.js', () => ({ default: { ZC: new Proxy({}, { get: (t, key) => t[key] ||= class {} }) } }));
import homun from '../../src/Engine/MapEngine/Homun.js';
import mercenary from '../../src/Engine/MapEngine/Mercenary.js';
import PACKET from 'Network/PacketStructure.js';
import StatusProperty from 'DB/Status/StatusProperty.js';
const receive = (name, data) => s.hooks.get(PACKET.ZC[name])(data);
beforeEach(() => { vi.clearAllMocks(); s.mobile = true; s.entity = null; s.session.homunId = 0; homun(); mercenary(); });
it('retains mobile status even when the entity has not spawned, without mounting desktop information', () => {
	receive('CHANGESTATE_MER', { GID: 31, state: 0 }); expect(s.session.homunId).toBe(31);
	receive('PROPERTY_HOMUN5', { hp: 50, SKPoint: 2 }); expect(s.info).toHaveBeenCalledWith('homunculus', { hp: 50, SKPoint: 2 }, 31);
	receive('HO_PAR_CHANGE', { param: StatusProperty.HP, value: 40 }); expect(s.info).toHaveBeenCalledWith('homunculus', { hp: 40 });
	receive('FEED_MER', { cRet: 0 }); expect(s.feed).toHaveBeenCalledWith(0);
	receive('MER_INIT', { AID: 32, name: '佣兵', hp: 20 }); expect(s.session.mercId).toBe(32);
	receive('MER_PAR_CHANGE', { param: StatusProperty.SP, value: 10 }); expect(s.info).toHaveBeenCalledWith('mercenary', { sp: 10 });
	expect(s.hom.append).not.toHaveBeenCalled(); expect(s.hom.setInformations).not.toHaveBeenCalled(); expect(s.merc.append).not.toHaveBeenCalled(); expect(s.merc.setInformations).not.toHaveBeenCalled(); expect(s.merc.startAI).toHaveBeenCalledOnce();
});
it('preserves desktop mercenary initialization and status callbacks', () => {
	s.mobile = false; const data = { AID: 32, name: '佣兵', hp: 20 }; receive('MER_INIT', data); receive('MER_PROPERTY', { hp: 18 });
	expect(s.merc.append).toHaveBeenCalledOnce(); expect(s.merc.setInformations).toHaveBeenCalledWith(data); expect(s.merc.setInformations).toHaveBeenCalledWith({ ...data, hp: 18, SKPoint: 0 }); expect(s.info).not.toHaveBeenCalled();
});

it.each([
	[StatusProperty.HP, 'hp', 140],
	[StatusProperty.MAXHP, 'maxHP', 300],
	[StatusProperty.SP, 'sp', 75],
	[StatusProperty.MAXSP, 'maxSP', 120],
	[StatusProperty.MER_KILLCOUNT, 'approval_monster_kill_counter', 1],
	[StatusProperty.MER_FAITH, 'faith', 3],
])('routes rAthena mercenary parameter %i to mobile state', (param, field, value) => {
	receive('MER_INIT', { AID: 32, name: 'Mina', hp: 256, maxHP: 256, sp: 200, maxSP: 200 });
	receive('MER_PAR_CHANGE', { param, value });
	expect(s.info).toHaveBeenLastCalledWith('mercenary', { [field]: value });
});
it('preserves desktop name, contract and other values across incremental updates', () => {
	s.mobile = false;
	const data = { AID: 32, name: 'Mina', level: 20, hp: 256, maxHP: 256, sp: 200, maxSP: 200, ExpireDate: 1792380000, faith: 1 };
	receive('MER_INIT', data);
	receive('MER_PAR_CHANGE', { param: StatusProperty.HP, value: 128 });
	receive('MER_PAR_CHANGE', { param: StatusProperty.MER_KILLCOUNT, value: 2 });
	expect(s.merc.setInformations).toHaveBeenLastCalledWith(expect.objectContaining({ ...data, hp: 128, approval_monster_kill_counter: 2 }));
});

it('applies the authoritative homunculus name to the rendered entity', () => {
 s.session.homunId = 31;
 s.entity = { display: { name: 'Old name' }, life: { update: vi.fn() } };
 receive('PROPERTY_HOMUN5', { szName: '新生命体', hp: 100, maxHP: 100, sp: 0, maxSP: 20, nFullness: 30 });
 expect(s.entity.display.name).toBe('新生命体');
 expect(s.entity.life.sp).toBe(0);
});
it('updates the visible mercenary HP and SP bars using server parameter IDs', () => {
 s.session.mercId = 32;
 s.entity = { life: { hp: 100, hp_max: 200, sp: 50, sp_max: 100, update: vi.fn() } };
 receive('MER_PAR_CHANGE', { param: StatusProperty.HP, value: 25 });
 receive('MER_PAR_CHANGE', { param: StatusProperty.SP, value: 0 });
 expect(s.entity.life.hp).toBe(25);
 expect(s.entity.life.sp).toBe(0);
 expect(s.entity.life.update).toHaveBeenCalledTimes(2);
});
