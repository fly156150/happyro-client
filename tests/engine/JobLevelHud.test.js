import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function handler(path, name) {
	const source = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
	const start = source.indexOf(`function ${name}(`);
	if (start < 0) throw new Error(`Missing production handler ${name}`);
	return source.slice(start, source.indexOf('\n}', start) + 2);
}

function fixture() {
	const player = { GID: 99, objecttype: 0, joblevel: 10, clevel: 10, money: 0, display: { name: 'Novice' } };
	const visible = {};
	const ui = {
		remove: vi.fn(), prepare: vi.fn(), append: vi.fn(),
		update: vi.fn((key, value) => { visible[key] = value; })
	};
	const context = vm.createContext({
		Session: { Entity: player },
		StatusProperty: { JOBLEVEL: 55 },
		BasicInfo: { getUI: () => ui, selectUIVersionWithJob: vi.fn() },
		SkillList: { getUI: () => ({ onLevelUp: vi.fn() }) },
		EntityManager: { get: id => id === player.GID ? player : null },
		Entity: { TYPE_EFFECT: 20, TYPE_UNIT: 21, TYPE_TRAP: 22 },
		PACKETVER: { value: 20211103 }, DB: { getJobClass: job => job }, Platform: { isMobile: false }
	});
	vm.runInContext(handler('../../src/Engine/MapEngine/Main.js', 'onParameterChange'), context);
	vm.runInContext(handler('../../src/Engine/MapEngine/Entity.js', 'onEntityViewChange'), context);
	return { context, player, visible, ui };
}

describe('job level status and appearance updates', () => {
	it('preserves the server reset to Job 1 when job change reconstructs the HUD', () => {
		const { context, player, visible, ui } = fixture();
		// pc_jobchange sends SP_JOBLEVEL before LOOK_BASE.
		context.onParameterChange({ varID: 55, amount: 1 });
		expect(visible.jlvl).toBe(1);
		context.onEntityViewChange({ GID: 99, type: 0, value: 6 });
		expect(ui.prepare).toHaveBeenCalledOnce();
		expect(player.joblevel).toBe(1);
		expect(visible.jlvl).toBe(1);
	});

	it('retains later earned job levels across another appearance refresh', () => {
		const { context, player, visible } = fixture();
		context.onParameterChange({ varID: 55, amount: 7 });
		context.onEntityViewChange({ GID: 99, type: 0, value: 4 });
		expect(player.joblevel).toBe(7);
		expect(visible.jlvl).toBe(7);
	});
});
