import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');
const read = path => readFileSync(resolve(sourceRoot, path), 'utf8').replace(/\r\n/g, '\n');
// Evaluate production packet handlers and lifecycle methods without initializing WebGL/UI.
function extract(source, start, end) {
	const offset = source.indexOf(start);
	if (offset < 0) throw new Error(`Missing production method: ${start}`);
	const finish = source.indexOf(end, offset);
	if (finish < 0) throw new Error(`Missing method boundary: ${start}`);
	return source.slice(offset, finish + end.length);
}
function fixture() {
	const Entity = {
		TYPE_PC: 0,
		TYPE_MOB: 5,
		TYPE_PET: 7,
		TYPE_HOM: 8,
		TYPE_MERC: 9,
		TYPE_FALCON: -6,
		TYPE_WUG: -7,
		VT: { OUTOFSIGHT: 0, DEAD: 1, EXIT: 2, TELEPORT: 3 }
	};
	const noop = vi.fn();
	const context = vm.createContext({
		Entity,
		invalidateCompanionPrompts: vi.fn(),
		PetEvolution: { invalidatePet: vi.fn() },
		Session: { Entity: { GID: 99 } },
		Date,
		Map,
		GraphicsSettings: { performanceMode: false },
		GR2ModelRenderer: { detach: noop },
		SpriteRenderer: {},
		Mouse: {},
		KEYS: {},
		PathFinding: {},
		Altitude: {},
		EffectManager: { spam: noop, remove: noop },
		EffectConst: {},
		StatusState: { EffectState: { INVISIBLE: 1 } },
		PACKETVER: { value: 20211103 },
		servantWeaponEffectIds: [],
		HomunInformations: { stopAI: vi.fn(), stopAutoFeed: vi.fn(), ui: { hide: vi.fn() } },
		PetInformations: { ui: { hide: vi.fn() } },
		Platform: { isMobile: false },
		SkillListMH: { homunculus: { ui: { hide: vi.fn() } }, mercenary: { ui: { hide: vi.fn() } } },
		MercenaryInformations: { stopAI: vi.fn(), ui: { hide: vi.fn() } },
		Escape: {},
		haveSiegfriedItem: () => false
	});
	const managerSource = read('Renderer/EntityManager.js')
		.replace(/^import .*;\n/gm, '')
		.replace('export default EntityManager;', 'globalThis.manager = EntityManager;');
	vm.runInContext(managerSource, context);
	context.EntityManager = context.manager;
	const packets = read('Engine/MapEngine/Entity.js');
	for (const name of ['onEntityVanish', 'onEntityResurect']) {
		vm.runInContext(extract(packets, `function ${name}(`, '\n}'), context);
	}
	const entitySource = read('Renderer/Entity/Entity.js');
	const methods = vm.runInContext(
		`({${extract(entitySource, '\tclean() {', '\n\t}')},${extract(entitySource, '\tremove(type) {', '\n\t}')}})`,
		context
	);
	function entity(objecttype = Entity.TYPE_PC) {
		const value = {
			GID: 123,
			objecttype,
			action: 0,
			ACTION: { IDLE: 0, DIE: 8 },
			remove_tick: 0,
			position: [1, 1],
			setAction({ action }) {
				this.action = action;
			},
			...methods
		};
		// Only attached UI/effect disposal and animation scheduling are stubs.
		for (const name of [
			'life',
			'emblem',
			'display',
			'dialog',
			'cast',
			'room',
			'attachments',
			'animations',
			'aura',
			'dropEffect'
		])
			value[name] = { clean: noop, free: noop, remove: noop };
		context.manager.add(value);
		return value;
	}
	return { c: context, m: context.manager, entity, Entity };
}
describe('player death entity lifecycle', () => {
	it('keeps the same corpse addressable for native resurrection', () => {
		const { c, m, entity } = fixture(),
			pc = entity();
		c.onEntityVanish({ GID: 123, type: 1 });
		expect(m.get(123)).toBe(pc);
		expect(pc.action).toBe(8);
		expect(pc.remove_tick).toBe(0);
		c.onEntityResurect({ AID: 123 });
		expect(m.get(123)).toBe(pc);
		expect(pc.action).toBe(0);
	});
	it.each([0, 3])('cleans a dead player before departure type %i and reentry', type => {
		const { c, m, entity } = fixture(),
			pc = entity();
		c.onEntityVanish({ GID: 123, type: 1 });
		c.onEntityVanish({ GID: 123, type });
		expect(pc.GID).toBe(-1);
		expect(m.get(123)).toBeNull();
		const replacement = entity();
		expect(m.get(123)).toBe(replacement);
		const same = [];
		m.forEach(value => {
			if (value.GID === 123) same.push(value);
		});
		expect(same).toEqual([replacement]);
	});
	it('still frees normal out-of-sight GIDs for new objects', () => {
		const { c, m, entity } = fixture(),
			old = entity();
		c.onEntityVanish({ GID: 123, type: 0 });
		expect(old.GID).toBe(-1);
		expect(m.get(123)).toBeNull();
		const replacement = entity();
		expect(m.get(123)).toBe(replacement);
	});
	it('retains non-player death cleanup and timed removal', () => {
		const { c, m, entity, Entity } = fixture(),
			mob = entity(Entity.TYPE_MOB);
		c.onEntityVanish({ GID: 123, type: 1 });
		expect(mob.GID).toBe(-1);
		expect(mob.remove_tick).toBeGreaterThan(0);
		expect(mob.remove_delay).toBe(5000);
		expect(m.get(123)).toBeNull();
	});
});

describe('companion information lifecycle', () => {
 it.each([['TYPE_HOM', 'homunId', 'HomunInformations'], ['TYPE_MERC', 'mercId', 'MercenaryInformations'], ['TYPE_PET', 'petId', 'PetInformations']])('closes the owned %s window when the real entity disappears', (type, sessionKey, component) => {
  const { c, m, entity, Entity } = fixture(); entity(Entity[type]); c.Session[sessionKey] = 123;
  c.onEntityVanish({ GID: 123, type: Entity.VT.OUTOFSIGHT });
  expect(m.get(123)).toBeNull(); expect(c[component].ui.hide).toHaveBeenCalledOnce();
  if (type === 'TYPE_HOM') { expect(c.HomunInformations.stopAutoFeed).toHaveBeenCalledOnce(); expect(c.SkillListMH.homunculus.ui.hide).toHaveBeenCalledOnce(); }
  if (type === 'TYPE_MERC') expect(c.SkillListMH.mercenary.ui.hide).toHaveBeenCalledOnce();
 });
 it('does not close the player’s companion window when another player’s companion disappears', () => {
  const { c, entity, Entity } = fixture(); entity(Entity.TYPE_HOM); c.Session.homunId = 456;
  c.onEntityVanish({ GID: 123, type: Entity.VT.OUTOFSIGHT });
  expect(c.HomunInformations.ui.hide).not.toHaveBeenCalled();
 });
});
