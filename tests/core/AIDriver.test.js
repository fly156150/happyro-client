import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	createLuaVM: vi.fn(),
	loadFile: vi.fn(), actors: new Map(), session: {}
}));

vi.mock('DB/DBManager.js', () => ({
	default: { createLuaVM: mocks.createLuaVM }
}));
vi.mock('Core/Client.js', () => ({
	default: { loadFile: mocks.loadFile }
}));
vi.mock('Engine/SessionStorage.js', () => ({ default: mocks.session }));
vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: vi.fn() } }));
vi.mock('Network/PacketStructure.js', () => ({ default: { CZ: {} } }));
vi.mock('Network/PacketVerManager.js', () => ({ default: { value: 20211103 } }));
vi.mock('DB/Skills/SkillInfo.generated.js', () => ({ default: {} }));
vi.mock('Renderer/EntityManager.js', () => ({ default: { get: id => mocks.actors.get(id), forEach: fn => mocks.actors.forEach(fn) } }));
vi.mock('Core/Configs.js', () => ({ default: { get: () => false } }));
vi.mock('UI/UIManager.js', () => ({
	default: {
		getComponent: () => ({ reqMoveToOwner: vi.fn(), reqMoveTo: vi.fn(), reqAttack: vi.fn() })
	}
}));
vi.mock('Utils/CodepageManager.js', () => ({
	default: { decode: () => '' }
}));

import AIDriver from '../../src/Core/AIDriver.js';

function createLua() {
	return {
		ctx: {},
		doStringSync: vi.fn(),
		doFileSync: vi.fn(),
		mountFile: vi.fn(),
		global: { close: vi.fn() }
	};
}

describe('AI Lua initialization', () => {
	beforeEach(() => {
		AIDriver.reset();
		mocks.createLuaVM.mockReset().mockImplementation(async () => createLua());
		mocks.loadFile.mockReset().mockImplementation((_filename, onLoad) => onLoad(new Uint8Array()));
	});

	afterEach(() => {
		AIDriver.reset();
	});

	it('creates only the Lua pair required by the active AI kind', async () => {
		expect(mocks.createLuaVM).not.toHaveBeenCalled();

		AIDriver.exec('AI(1)', true);
		await AIDriver.initialization.homunculus;
		expect(mocks.createLuaVM).toHaveBeenCalledTimes(2);
		expect(AIDriver.ready).toEqual({ homunculus: true, mercenary: false });

		AIDriver.exec('AI(1)', true);
		expect(mocks.createLuaVM).toHaveBeenCalledTimes(2);

		AIDriver.exec('AI(2)', false);
		await AIDriver.initialization.mercenary;
		expect(mocks.createLuaVM).toHaveBeenCalledTimes(4);
		expect(AIDriver.ready).toEqual({ homunculus: true, mercenary: true });
	});

	it('does not retry a failed AI initialization on every execution tick', async () => {
		mocks.createLuaVM.mockRejectedValueOnce(new Error('WASM unavailable'));

		AIDriver.exec('AI(1)', true);
		await AIDriver.initialization.homunculus.catch(() => {});
		AIDriver.exec('AI(1)', true);

		expect(mocks.createLuaVM).toHaveBeenCalledTimes(1);
		expect(AIDriver.ready.homunculus).toBe(false);
	});

	it('does not publish instances from an initialization cancelled by reset', async () => {
		let resolveFirstVM;
		mocks.createLuaVM.mockImplementationOnce(
			() => new Promise(resolve => {
				resolveFirstVM = resolve;
			})
		);

		AIDriver.exec('AI(1)', true);
		const cancelledInitialization = AIDriver.initialization.homunculus;
		AIDriver.reset(true);
		resolveFirstVM(createLua());
		await cancelledInitialization;

		expect(AIDriver.ready.homunculus).toBe(false);
		expect(AIDriver.HO_AI).toBeNull();
		expect(AIDriver.default_HO_AI).toBeNull();
	});

	it('resets one AI kind without closing the other kind', async () => {
		AIDriver.exec('AI(1)', true);
		await AIDriver.initialization.homunculus;
		AIDriver.exec('AI(2)', false);
		await AIDriver.initialization.mercenary;
		const mercenaryAI = AIDriver.MER_AI;

		AIDriver.reset(true);

		expect(AIDriver.ready).toEqual({ homunculus: false, mercenary: true });
		expect(AIDriver.MER_AI).toBe(mercenaryAI);
		expect(mercenaryAI.global.close).not.toHaveBeenCalled();
	});
});

describe('saved companion attack modes', () => {
	afterEach(() => { localStorage.clear(); });
	it.each([['1', true], ['0', false], [null, false]])('restores mode %s on a new page module', async (saved, expected) => {
		localStorage.clear();
		if (saved !== null) {
			localStorage.setItem('HOM_AGGRESSIVE', saved);
			localStorage.setItem('MER_AGGRESSIVE', saved);
		}
		vi.resetModules();
		const { default: fresh } = await import('../../src/Core/AIDriver.js');
		expect(fresh.HOM_AGGRESSIVE).toBe(expected);
		expect(fresh.MER_AGGRESSIVE).toBe(expected);
	});
});

it('passive companion AI excludes neutral monsters but retains retaliation and explicit targets', () => {
 const run = vi.spyOn(AIDriver, 'exec').mockImplementation(() => {});
 try {
  const types = { TYPE_MOB: 5, TYPE_NPC_ABR: 6, TYPE_NPC_BIONIC: 7 };
  const owner = { GID: 1, objecttype: 0, constructor: types };
  const companion = { GID: 2, objecttype: 3 };
  const neutral = { GID: 3, objecttype: 5 };
  Object.assign(mocks.session, { AID: 1, homunId: 2, mercId: 4, Entity: owner });
  mocks.actors.clear(); for (const entity of [owner, companion, neutral]) mocks.actors.set(entity.GID, entity);
  const lua = createLua(); AIDriver.addCTX(true, lua, createLua()); AIDriver.HOM_AGGRESSIVE = false;
  expect(lua.ctx.GetActors()).toEqual([0, 1, 2]);
  neutral.targetGID = 1; expect(lua.ctx.GetActors()).toContain(3);
  delete neutral.targetGID; owner.targetGID = 3; expect(lua.ctx.GetActors()).toContain(3);
  delete owner.targetGID; companion.targetGID = 3; expect(lua.ctx.GetActors()).toContain(3);
  delete companion.targetGID;
  neutral.position = [2, 2]; neutral.isDead = () => false; neutral.isVisible = () => true; neutral.ACTION = { DIE: 8 }; neutral.action = 0; companion.position = [0, 0];
  AIDriver.HOM_AGGRESSIVE = true; expect(lua.ctx.GetActors()).toContain(3);
 } finally { run.mockRestore(); mocks.actors.clear(); AIDriver.HOM_AGGRESSIVE = false; }
});
