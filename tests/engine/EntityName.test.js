import { describe, expect, it, vi } from 'vitest';
import { localizeEntityName } from '../../src/Engine/MapEngine/EntityName.js';
const types = { TYPE_PC: 0, TYPE_NPC: 6, TYPE_NPC2: 7, TYPE_MOB: 5, TYPE_NPC_ABR: 12, TYPE_NPC_BIONIC: 13 };
function entity(objecttype = types.TYPE_MOB, job = 1008) {
	return { constructor: types, objecttype, _job: job,
		display: { name: 'Pupa', fakename: '虫蛹', STYLE: { MOB: 1, NPC: 2 }, update: vi.fn() } };
}
describe('monster display and message names', () => {
	it('replaces the server name used by combat messages as well as the overhead name', () => {
		const mob = entity();
		expect(localizeEntityName(mob)).toBe(true);
		expect(mob.display.name).toBe('虫蛹');
		expect(mob.display.fakename || mob.display.name).toBe('虫蛹');
		// A later appearance packet can supply the English name again.
		mob.display.name = 'Pupa';
		localizeEntityName(mob);
		expect(mob.display.name).toBe('虫蛹');
	});
	it('preserves distinct quest names for monsters sharing the same appearance', () => {
		for (const serverName of ['转职怪物', '职业测试员怪物', 'Custom Target']) {
			const mob = entity();
			localizeEntityName(mob, serverName);
			expect(mob.display.name).toBe(serverName);
			expect(mob.display.fakename).toBe('');
			localizeEntityName(mob);
			expect(mob.display.name).toBe(serverName);
		}
	});
	it('accepts a subsequent server rename and normal localized monster names', () => {
		const mob = entity();
		localizeEntityName(mob, '转职怪物');
		localizeEntityName(mob, '虫蛹');
		expect(mob.display.name).toBe('虫蛹');
	});
	it('expands the current default server label without overriding a quest rename', () => {
		const mob = entity(types.TYPE_MOB, 1708);
		localizeEntityName(mob, '达纳托斯之忆');
		expect(mob.display.name).toBe('魔剑士 达纳托斯的记忆');
		expect(mob.serverMonsterName).toBe('达纳托斯之忆');
		localizeEntityName(mob);
		expect(mob.display.name).toBe('魔剑士 达纳托斯的记忆');
		localizeEntityName(mob, '转职怪物');
		localizeEntityName(mob);
		expect(mob.display.name).toBe('转职怪物');
	});
	it('matches a default label by appearance ID and exact wire text', () => {
		const other = entity();
		localizeEntityName(other, '达纳托斯之忆');
		expect(other.display.name).toBe('达纳托斯之忆');
		const mob = entity(types.TYPE_MOB, 1708);
		localizeEntityName(mob, '达纳托斯之忆·任务');
		expect(mob.display.name).toBe('达纳托斯之忆·任务');
	});
	it('restores a name cut at the UTF-8 boundary of the fixed packet', () => {
		const mob = entity(types.TYPE_MOB, 2047);
		localizeEntityName(mob, '沉醉于魔力的纳');
		expect(mob.display.name).toBe('沉醉于魔力的纳迦');
	});
	it('preserves player names even when they use a monster appearance', () => {
		const player = entity(types.TYPE_PC);
		expect(localizeEntityName(player)).toBe(false);
		expect(player.display.name).toBe('Pupa');
	});
	it('preserves server names for monsters absent from the translation table', () => {
		const mob = entity(types.TYPE_MOB, 999999);
		expect(localizeEntityName(mob)).toBe(false);
		expect(mob.display.name).toBe('Pupa');
	});
});

describe('NPC names across appearance and identity packets', () => {
	it('uses a translated identity response for both labels and shop panels', () => {
		const npc = entity(types.TYPE_NPC);
		npc.display.name = 'Merchant';
		localizeEntityName(npc, 'Eden Teleport Officer');
		expect(npc.display.name).toBe('乐园团空间传送员');
		expect(npc.display.fakename || npc.display.name).toBe('乐园团空间传送员');
	});
	it('preserves an untranslated custom NPC name', () => {
		const npc = entity(types.TYPE_NPC2);
		localizeEntityName(npc, 'Custom NPC 123456');
		expect(npc.display.name).toBe('Custom NPC 123456');
	});
});
