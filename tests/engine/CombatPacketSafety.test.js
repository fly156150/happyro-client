import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Network from '../../src/Network/NetworkManager.js';
import PACKET from '../../src/Network/PacketStructure.js';
import PacketLength from '../../src/Network/PacketLength.js';
import { createAutoCombatController } from '../../src/UI/Game/AutoCombatController.js';

// Exercise the production handler without initializing WebGL, audio or UI.
const source = readFileSync(resolve(process.cwd(), 'src/Engine/MapEngine/Entity.js'), 'utf8');
const start = source.indexOf('function onEntityAction(pkt)');
const handlerSource = source.slice(start, source.indexOf('\n}', start) + 2);
function fixture(kind = 'melee', present = false) {
	const monster = kind === 'projectile' || kind === 'spawn';
	const actor = { GID: 77, objecttype: monster ? 5 : 0, job: monster ? (kind === 'spawn' ? 1500 : 1016) : 0,
		_job: 0, _sex: 0, weapon: 0, position: [10, 10], display: { name: '攻击者' },
		ACTION: { ATTACK: 1, READYFIGHT: 2 }, setAction: vi.fn(), lookTo: vi.fn() };
	const target = { GID: 88, objecttype: monster ? 0 : 5, position: [11, 10], display: { name: '目标' } };
	const entities = new Map([[77, actor]]);
	if (present) entities.set(88, target);
	const context = vm.createContext({
		EntityManager: { get: gid => entities.get(gid) || null }, Entity: { TYPE_PC: 0, TYPE_MOB: 5 },
		Session: { Entity: monster ? target : actor, pet: {} }, CombatDiagnostics: { enabled: () => false },
		MAX_ATTACKMT: 864, AVG_ATTACK_SPEED: 432,
		DB: { getWeaponSound: () => null, isDualWeapon: () => false, getPCAttackMotion: () => 1,
			isBow: () => kind === 'bow', getWeaponType: () => 0, getMessage: () => '%s %d' },
		AttackEffect: { PROJECTILE: { 1016: 'arrow' }, SPAWN: { 1500: 'plant' } },
		Renderer: { tick: 100 }, EffectManager: { spam: vi.fn() }, EffectConst: { EF_HIT1: 1 },
		ChatBox: { addText: vi.fn(), TYPE: { INFO: 1 }, FILTER: { BATTLE: 1 } },
		Damage: { add: vi.fn(), TYPE: {} }, onEntityWillBeHitSub: vi.fn(), Date
	});
	vm.runInContext(handlerSource, context);
	return { context, actor, target, entities, handle: context.onEntityAction };
}
const attack = () => ({ GID: 77, targetGID: 88, action: 0, damage: 10, leftDamage: 0, count: 1, attackMT: 432 });
function attackBytes() {
	const bytes = new Uint8Array(34), view = new DataView(bytes.buffer);
	view.setUint16(0, 0x8c8, true); view.setUint32(2, 77, true); view.setUint32(6, 88, true);
	view.setInt32(14, 432, true); view.setInt32(22, 10, true); view.setInt16(27, 1, true);
	return bytes;
}
let socket, disconnected;
beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
	PacketLength.init(20211103);
	disconnected = vi.fn(); Network.onDisconnect = disconnected;
	Network.setSocketFactory(() => (socket = { send: vi.fn(), close: vi.fn() }));
	Network.connect('localhost', 5121, () => {}, true); socket.onComplete(true);
});
afterEach(() => { Network.close(); Network.setSocketFactory(null); vi.restoreAllMocks(); });

it.each(['melee', 'bow', 'projectile', 'spawn'])('keeps the attacker animation when the %s target is absent', kind => {
	const f = fixture(kind);
	expect(() => f.handle(attack())).not.toThrow();
	expect(f.actor.setAction).toHaveBeenCalledWith(expect.objectContaining({ action: f.actor.ACTION.ATTACK }));
	expect(f.context.EffectManager.spam).not.toHaveBeenCalled();
	expect(f.context.ChatBox.addText).not.toHaveBeenCalled();
});
it.each(['melee', 'bow', 'projectile', 'spawn'])('still renders damage and the battle log for a visible %s target', kind => {
	const f = fixture(kind, true); f.handle(attack());
	expect(f.context.Damage.add).toHaveBeenCalled();
	expect(f.context.ChatBox.addText).toHaveBeenCalled();
	if (kind !== 'melee') expect(f.context.EffectManager.spam).toHaveBeenCalledWith(expect.objectContaining({ ownerAID: 88 }));
});
it('keeps the connection and automatic combat running after a vanished target, then attacks a new target', () => {
	const f = fixture('melee', true), act = vi.fn(() => true);
	let targets = [{ id: 88, species: 1002, name: '旧目标', position: [11, 10] }];
	const combat = createAutoCombatController({ enabled: () => true, now: () => 0, random: () => 0,
		position: () => [10, 10], targets: () => targets, skills: () => [], busy: () => false,
		chasing: () => false, reachable: () => true, select: vi.fn(), stop: vi.fn(), act });
	combat.start(); f.entities.delete(88); targets = [];
	Network.hookPacket(PACKET.ZC.NOTIFY_ACT3, f.handle);
	const following = vi.fn(); Network.hookPacket(PACKET.ZC.ATTACK_RANGE, following);
	const next = new Uint8Array([0x3a, 0x01, 1, 0]), first = new Uint8Array(37);
	first.set(attackBytes()); first.set(next.slice(0, 3), 34);
	expect(() => socket.onMessage(first.buffer)).not.toThrow(); socket.onMessage(next.slice(3).buffer);
	expect(following).toHaveBeenCalledOnce(); expect(disconnected).not.toHaveBeenCalled();
	expect(console.error).not.toHaveBeenCalled();
	combat.tick(); expect(combat.snapshot()).toMatchObject({ active: true, target: '', status: '等待附近目标' });
	targets = [{ id: 90, species: 1002, name: '新目标', position: [12, 10] }];
	combat.tick(); expect(combat.snapshot()).toMatchObject({ active: true, target: '新目标' });
	expect(act).toHaveBeenLastCalledWith(targets[0], null); combat.stop();
});
