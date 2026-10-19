import { beforeEach, expect, it, vi } from 'vitest';
const s = vi.hoisted(() => ({ session: {}, send: vi.fn(), ai: { HOM_AGGRESSIVE: false, MER_AGGRESSIVE: false }, items: new Map(), petEntity: {} }));
vi.mock('Engine/SessionStorage.js', () => ({ default: s.session }));
vi.mock('Core/AIDriver.js', () => ({ default: s.ai }));
vi.mock('Core/Client.js', () => ({ default: { loadFile: vi.fn() } }));
vi.mock('Core/Configs.js', () => ({ default: { get: (_key, fallback) => fallback } }));
vi.mock('Core/Preferences.js', () => ({ default: { get: (_key, defaults) => ({ ...defaults, save: vi.fn() }) } }));
vi.mock('Renderer/Renderer.js', () => ({ default: { width: 1280, height: 900 } }));
vi.mock('Renderer/EntityManager.js', () => ({ default: { get: () => s.petEntity } }));
vi.mock('Controls/KeyEventHandler.js', () => ({ default: {} }));
vi.mock('UI/Elements/Elements.js', () => ({}));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: component => component } }));
vi.mock('UI/GUIComponent.js', () => ({ default: class { constructor() { this._host = null; this.root = document.createElement('div'); } getRoot() { return this.root; } draggable() {} focus() {} } }));
vi.mock('UI/Components/SkillListMH/SkillListMH.js', () => ({ default: { homunculus: { ui: { hide: vi.fn() }, setPoints: vi.fn() }, mercenary: { ui: { hide: vi.fn() } } } }));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({ default: { getUI: () => ({ getItemById: id => s.items.get(id) }) } }));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: {} }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({ default: { addText: vi.fn(), TYPE: { ERROR: 0 }, FILTER: { PUBLIC_LOG: 0 } } }));
vi.mock('UI/Game/GamePet.js', () => ({ receiveGamePetResult: vi.fn() }));
vi.mock('UI/Platform.js', () => ({ default: { isMobile: false } }));
vi.mock('Network/PacketVerManager.js', () => ({ default: { value: 20211103 } }));
vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: s.send, hookPacket: vi.fn() } }));
vi.mock('Network/PacketStructure.js', () => ({ default: { CZ: { PET_EVOLUTION: class {} }, ZC: { PET_EVOLUTION: class {} } } }));
vi.mock('DB/DBManager.js', () => ({ default: {
 getMessage: id => String(id), getPetIllustPath: () => 'pet.bmp',
 getItemInfo: id => ({ identifiedDisplayName: `中文物品 ${id}` }),
 getPetByJobID: () => ({ PetEggID: 9001, PetIllust: 'base.bmp', Evolution: { 9069: [{ MaterialID: 610, Amount: 10 }], 9003: [{ MaterialID: 619, Amount: 3 }] } }),
 getPetByEggID: id => ({ PetEggID: id, PetIllust: 'target.bmp', PetString: 'untranslated' }),
 getPetEvolutionByJob: () => ({ 9069: [], 9003: [] })
} }));
import Pet from '../../src/UI/Components/PetInformations/PetInformations.js';
import Homun from '../../src/UI/Components/HomunInformations/HomunInformations.js';
import Merc from '../../src/UI/Components/MercenaryInformations/MercenaryInformations.js';
import Evolution from '../../src/UI/Components/PetEvolution/PetEvolution.js';
import { normalizeCompanionName } from '../../src/Utils/CompanionName.js';
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); s.items.clear(); s.session.petId = 0; s.session.homunId = 0; s.session.mercId = 0; for (const c of [Pet, Homun, Merc]) c._host = null; });
it.each([['pet', Pet], ['homunculus', Homun], ['mercenary', Merc]])('ignores the %s information shortcut before any companion has spawned', (_name, component) => {
 expect(() => component.onShortCut({ cmd: 'TOGGLE' })).not.toThrow();
 expect(component._host).toBeNull();
});
it('desktop attack toggles persist the value that actually drives each AI', () => {
 for (const [component, key] of [[Homun, 'HOM_AGGRESSIVE'], [Merc, 'MER_AGGRESSIVE']]) {
  s.ai[key] = false; component.toggleAggressive(); expect(s.ai[key]).toBe(true); expect(localStorage.getItem(key)).toBe('1');
  component.toggleAggressive(); expect(s.ai[key]).toBe(false); expect(localStorage.getItem(key)).toBe('0');
 }
});
it('uses translated egg names and retains the selected evolution branch', () => {
 Pet.root.innerHTML = '<input class="name"><button class="modify"></button><span class="accessory"></span><select class="command"></select>';
 Pet.setInformations({ szName: '波利', nLevel: 1, nFullness: 50, nRelationship: 950, ITID: 0, job: 1002 });
 expect(Pet.root.querySelector('.accessory').textContent).toBe('未装备');
 expect([...Pet.root.querySelectorAll('option')].map(o => [o.value, o.textContent])).toEqual([['evolution_1002_9003', '进化为 中文物品 9003'], ['evolution_1002_9069', '进化为 中文物品 9069']]);
 Pet.setAccessory(10013); expect(Pet.accessory).toBe(true); expect(Pet.root.querySelector('.accessory').textContent).toBe('已装备');
});
it('submits the selected evolution egg and checks that branch’s materials', () => {
 s.session.Playing = true; s.session.Entity = { action: 0, ACTION: { DIE: 8 } }; s.session.petId = 10; s.session.pet = { job: 1002, friendly: 1000 }; Pet.accessory = false;
 Evolution.root.innerHTML = '<div class="base_petEggId"></div><div class="target_petEggId"></div><div class="evo_requirements"></div><button class="evolve"></button>';
 Evolution.init(); Evolution.SetInfo(1002, 9069);
 expect(Evolution.root.querySelector('.target_petEggId').textContent).toBe('中文物品 9069');
 s.items.set(619, { count: 3 }); expect(Evolution.hasEnoughMaterials()).toBe(false);
 s.items.set(610, { count: 10 }); Evolution.root.querySelector('.evolve').click();
 Evolution.root.querySelector('.evolve').click();
 expect(s.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ evolutionPetEggITID: 9069 }));
});
it('rejects names that would be silently truncated by the 23-byte packet field', () => {
 expect(normalizeCompanionName(' 八个中文测试名字 ')).toBeNull();
 expect(normalizeCompanionName('  测试生命体  ')).toBe('测试生命体');
 expect(normalizeCompanionName('a'.repeat(23))).toHaveLength(23);
 expect(normalizeCompanionName('a'.repeat(24))).toBeNull();
 expect(normalizeCompanionName('')).toBeNull();
 expect(normalizeCompanionName('test\u0001')).toBeNull();
});

it('keeps homunculus rename eligibility on incremental status packets and clears zero skill points', async () => {
 Homun.__loaded = true;
 Homun.root.innerHTML = '<input class="name"><button class="modify"></button>';
 Homun.setInformations({ bModified: 4, SKPoint: 2 });
 expect(Homun.root.querySelector('.name').disabled).toBe(false);
 Homun.setInformations({ param: 7, value: 0 });
 expect(Homun.root.querySelector('.name').disabled).toBe(false);
 Homun.setInformations({ bModified: 5, SKPoint: 0 });
 expect(Homun.root.querySelector('.name').disabled).toBe(true);
 const { default: skills } = await import('UI/Components/SkillListMH/SkillListMH.js');
 expect(skills.homunculus.setPoints).toHaveBeenLastCalledWith(0);
});

it('rejects a stale evolution window after the player summons a different pet', () => {
 s.session.Playing = true; s.session.Entity = { action: 0, ACTION: { DIE: 8 } }; s.session.petId = 10; s.session.pet = { job: 1002, friendly: 1000 }; Pet.accessory = false;
 Evolution.root.innerHTML = '<div class="base_petEggId"></div><div class="target_petEggId"></div><div class="evo_requirements"></div><button class="evolve"></button>';
 Evolution.init(); Evolution.SetInfo(1002, 9069); s.items.set(610, { count: 10 });
 s.session.petId = 20; Evolution.root.querySelector('.evolve').click();
 expect(s.send).not.toHaveBeenCalled();
});

it('locks pet renaming until authoritative status arrives and refreshes when reopening', () => {
 Pet.root.innerHTML = '<input class="name"><button class="modify"></button><span class="accessory"></span><select class="command"></select>';
 Pet.init();Pet.setInformations({ szName: '波利', nLevel: 1, nFullness: 50, nRelationship: 950, ITID: 0, job: 1002, bModified: 0 });
 Pet.reqNameEdit = vi.fn();Pet.reqRefresh = vi.fn();
 const input = Pet.root.querySelector('.name'),button = Pet.root.querySelector('.modify');input.value = 'ValidPet';
 button.click();button.click();expect(Pet.reqNameEdit).toHaveBeenCalledTimes(1);expect(input.disabled).toBe(true);
 Pet._host = { style: { display: 'none' } };Pet.onShortCut({ cmd: 'TOGGLE' });expect(Pet.reqRefresh).toHaveBeenCalledOnce();expect(button.disabled).toBe(true);
 Pet.setInformations({ szName: '波利', nLevel: 1, nFullness: 50, nRelationship: 950, ITID: 0, job: 1002, bModified: 0 });expect(button.disabled).toBe(false);expect(input.value).toBe('波利');
 input.value = 'ValidAgain';button.click();Pet.setInformations({ szName: 'ValidAgain', nLevel: 1, nFullness: 50, nRelationship: 950, ITID: 0, job: 1002, bModified: 1 });expect(button.disabled).toBe(true);
});
