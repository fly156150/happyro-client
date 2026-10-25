import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ send: vi.fn(), session: {}, renderer: {}, connectionId: 0 }));
vi.mock('Engine/SessionStorage.js', () => ({ default: state.session }));
vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: state.send, get connectionId() { return state.connectionId; } } }));
vi.mock('Network/PacketStructure.js', () => ({ default: { CZ: { HAPPYRO_MAP_TELEPORT: class {}, HAPPYRO_NPC_TELEPORT: class {} } } }));
vi.mock('Renderer/MapRenderer.js', () => ({ default: state.renderer }));
vi.mock('DB/Map/SupportedMapTable.js', () => ({ isSupportedMapResource: () => true }));
import { teleportToRandomCell, teleportToCoordinate, teleportToNpc, handleMapTeleportResult, handleNpcTeleportResult, getAdventureActionState, notifyAdventureMapReady } from '../../src/UI/Components/GameTools/AdventureActionService.js';
import { endConnection } from '../../src/Network/ConnectionLifecycle.js';
const target = { mapName: 'mora', x: 116, y: 165 };
const npc = { ...target, type: 'NPC', npcClass: 100 };
function reply(result = 0, extra = {}) {
 return { requestId: state.send.mock.calls.at(-1)[0].requestId, result, mapName: 'mora', x: 115, y: 164, cooldownRemaining: 0, ...extra };
}
function arrive(packet) {
 state.renderer.currentMap = packet.mapName + '.gat';
 state.renderer.loading = false;
 state.session.Entity.position = [packet.x, packet.y];
 vi.advanceTimersByTime(100);
}
beforeEach(() => {
 vi.useFakeTimers(); endConnection(); vi.resetAllMocks(); state.connectionId++;
 Object.assign(state.renderer, { currentMap: 'izlude.gat', loading: false });
 Object.assign(state.session, { GID: 42, Playing: true, NavigationTeleportAllowed: true, NavigationTeleportCrossMap: true,
  Entity: { action: 0, ACTION: { DIE: 1 }, position: [10, 20] } });
});
afterEach(() => { endConnection(); vi.useRealTimers(); });
it('waits for matching physical arrival after a successful receipt and preserves cooldown', () => {
 const complete = vi.fn(), progress = vi.fn();
 teleportToCoordinate(target, complete, progress);
 expect(handleMapTeleportResult(reply(0, { requestId: 1 }))).toBe(false);
 const packet = reply(0, { cooldownRemaining: 15 });
 expect(handleMapTeleportResult(packet)).toBe(true);
 expect(handleMapTeleportResult(packet)).toBe(false);
 expect(complete).not.toHaveBeenCalled();
 expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'arrival' }));
 expect(getAdventureActionState()).toMatchObject({ mapPending: true, canTeleport: false, cooldownRemaining: 15 });
 state.renderer.currentMap = 'mora.gat';
 state.session.Entity.position = [packet.x, packet.y];
 state.renderer.loading = true;
 vi.advanceTimersByTime(100);
 expect(complete).not.toHaveBeenCalled();
 arrive(packet);
 expect(complete).toHaveBeenCalledExactlyOnceWith(packet);
 expect(getAdventureActionState()).toMatchObject({ mapPending: false, canTeleport: false, message: '', error: false });
 vi.advanceTimersByTime(15000);
 expect(getAdventureActionState().canTeleport).toBe(true);
});
it('does not mistake an updated map name and old coordinates for an arrival', () => {
 const complete = vi.fn(); teleportToCoordinate(target, complete);
 const packet = reply(); handleMapTeleportResult(packet);
 state.renderer.currentMap = 'mora.gat';
 vi.advanceTimersByTime(2000);
 expect(complete).not.toHaveBeenCalled();
 arrive(packet); expect(complete).toHaveBeenCalledExactlyOnceWith(packet);
});
it('bounds the accepted-but-not-arrived wait without retrying a warp or falsely reporting success', () => {
 const complete = vi.fn(); teleportToCoordinate(target, complete);
 const packet = reply(); handleMapTeleportResult(packet);
 vi.advanceTimersByTime(30000);
 expect(complete).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ result: -2 }));
 expect(getAdventureActionState()).toMatchObject({ mapPending: false, error: true });
 expect(getAdventureActionState().message).toContain('尚未确认到达');
 arrive(packet);
 expect(complete).toHaveBeenCalledTimes(1);
 expect(state.send).toHaveBeenCalledTimes(1);
});
it.each(['timeout', 'disconnect', 'rejected'])('settles %s and ignores stale replies without retrying', reason => {
 const complete = vi.fn(); teleportToCoordinate(target, complete); const packet = reply();
 if (reason === 'timeout') vi.advanceTimersByTime(8000);
 if (reason === 'disconnect') endConnection();
 if (reason === 'rejected') handleMapTeleportResult({ ...packet, result: 5 });
 expect(complete).toHaveBeenCalledOnce(); expect(complete.mock.calls[0][0].result).not.toBe(0);
 expect(handleMapTeleportResult(packet)).toBe(false);
 expect(state.send).toHaveBeenCalledTimes(1);
});
it('cancels receipt-to-arrival observation on disconnect and cannot complete in a new session', () => {
 const complete = vi.fn(); teleportToCoordinate(target, complete); const packet = reply();
 handleMapTeleportResult(packet); endConnection();
 state.session.GID = 43; arrive(packet); vi.advanceTimersByTime(60000);
 expect(complete).toHaveBeenCalledExactlyOnceWith({ result: -1 });
 expect(getAdventureActionState()).toMatchObject({ mapPending: false, npcPending: false, message: '' });
});
it('rejects an old reply after a timeout followed by a new explicit request', () => {
 const oldDone = vi.fn(), done = vi.fn(); teleportToCoordinate(target, oldDone); const old = reply();
 vi.advanceTimersByTime(8000); teleportToCoordinate(target, done); const current = reply();
 expect(handleMapTeleportResult(old)).toBe(false);
 handleMapTeleportResult(current); arrive(current);
 expect(oldDone).toHaveBeenCalledTimes(1); expect(done).toHaveBeenCalledExactlyOnceWith(current);
});
it('uses the authoritative reply destination for random safe cells and map aliases', () => {
 const complete = vi.fn(); expect(teleportToRandomCell('izlude_a', complete)).toBe(true);
 expect(state.send.mock.calls[0][0]).toMatchObject({ mapName: 'izlude_a', x: 65535, y: 65535 });
 const packet = reply(0, { mapName: 'izlude', x: 122, y: 207 });
 handleMapTeleportResult(packet); arrive(packet);
 expect(complete).toHaveBeenCalledExactlyOnceWith(packet);
});
it.each([[8, 'NPC 对话'], [9, '安全落点'], [10, '地图尚未加载']])('exposes map refusal %s and releases pending state', (result, message) => {
 const complete = vi.fn(); teleportToCoordinate(target, complete); const packet = reply(result);
 handleMapTeleportResult(packet);
 expect(complete).toHaveBeenCalledExactlyOnceWith(packet);
 expect(getAdventureActionState()).toMatchObject({ mapPending: false, error: true });
 expect(getAdventureActionState().message).toContain(message);
});
it.each(['loading', 'dead'])('prevents sending another navigation action while %s', condition => {
 if (condition === 'loading') state.renderer.loading = true;
 else state.session.Entity.action = 1;
 expect(teleportToCoordinate(target)).toBe(false); expect(teleportToNpc(npc)).toBe(false);
 expect(state.send).not.toHaveBeenCalled();
});
it('keeps NPC teleport pending until arrival and prevents overlapping coordinate requests', () => {
 expect(teleportToNpc(npc)).toBe(true); const packet = reply(); handleNpcTeleportResult(packet);
 expect(getAdventureActionState()).toMatchObject({ npcPending: true, canTeleport: false });
 expect(teleportToCoordinate(target)).toBe(false);
 expect(getAdventureActionState().message).not.toContain('已传送');
 arrive(packet);
 expect(getAdventureActionState()).toMatchObject({ npcPending: false });
 expect(getAdventureActionState().message).toContain('已传送到 NPC 附近');
});
it('bounds an NPC arrival wait and clears it on connection end', () => {
 teleportToNpc(npc); handleNpcTeleportResult(reply()); vi.advanceTimersByTime(30000);
 expect(getAdventureActionState()).toMatchObject({ npcPending: false, error: true });
 endConnection(); vi.advanceTimersByTime(60000); expect(getAdventureActionState().message).toBe('');
});
it('handles the NPC-specific not-ready result without confusing it with the map enum', () => {
 teleportToNpc(npc); handleNpcTeleportResult(reply(9));
 expect(getAdventureActionState()).toMatchObject({ npcPending: false, message: '地图尚未加载完成，请稍后重试。' });
});
it.each(['map', 'npc'])('releases %s pending state if sending throws', kind => {
 state.send.mockImplementationOnce(() => { throw new Error('socket closed'); });
 expect(kind === 'map' ? teleportToCoordinate(target) : teleportToNpc(npc)).toBe(false);
 expect(getAdventureActionState()).toMatchObject({ mapPending: false, npcPending: false, error: true });
 expect(teleportToCoordinate(target)).toBe(true);
});
it.each([[1.5, 20], [-1, 20], [65536, 20], [20, NaN]])('does not silently change invalid coordinates %s,%s', (x,y) => {
 expect(teleportToCoordinate({ mapName: 'izlude', x, y })).toBe(false); expect(state.send).not.toHaveBeenCalled();
});

it('confirms map-ready arrival before the next movement frame without leaving duplicate timers', async () => {
 const done = vi.fn(); teleportToCoordinate(target, done); const packet=reply(); handleMapTeleportResult(packet);
 state.renderer.currentMap='mora.gat';state.renderer.loading=true;state.session.Entity.position=[packet.x,packet.y];
 notifyAdventureMapReady(); state.renderer.loading=false;
 await Promise.resolve();
 expect(done).toHaveBeenCalledExactlyOnceWith(packet);
 state.session.Entity.position=[200,200];vi.advanceTimersByTime(60000);
 expect(done).toHaveBeenCalledTimes(1);
});
it('allows successive same-map and cross-map requests only after each actual arrival', () => {
 const done=vi.fn();
 for (const destination of [{mapName:'izlude',x:30,y:40},{mapName:'izlude',x:35,y:45},{mapName:'mora',x:116,y:165}]) {
  expect(teleportToCoordinate(destination,done)).toBe(true);
  const packet=reply(0,destination);handleMapTeleportResult(packet);
  expect(teleportToCoordinate(destination)).toBe(false);
  arrive(packet);expect(getAdventureActionState().mapPending).toBe(false);
 }
 expect(state.send).toHaveBeenCalledTimes(3);expect(done).toHaveBeenCalledTimes(3);
 vi.advanceTimersByTime(60000);expect(done).toHaveBeenCalledTimes(3);
});

it('refuses disconnected clicks even while character and capabilities remain in memory', () => {
 endConnection();expect(getAdventureActionState().connectionReady).toBe(false);expect(teleportToCoordinate(target)).toBe(false);expect(teleportToNpc(npc)).toBe(false);
 state.connectionId++;state.session.Playing=false;
 expect(teleportToCoordinate(target)).toBe(false);
 state.session.Playing=true;
 expect(teleportToCoordinate(target)).toBe(true);
 expect(state.send).toHaveBeenCalledTimes(1);
});

it('releases the source window only after a teleport request is actually sent',async()=>{
 const {beginNavigationVisit}=await import('../../src/UI/Game/NavigationVisit.js');
 const source={restore:vi.fn(),discard:vi.fn()};const visit=beginNavigationVisit(source);
 state.session.Playing=false;expect(teleportToCoordinate(target)).toBe(false);expect(source.discard).not.toHaveBeenCalled();
 state.session.Playing=true;state.send.mockImplementationOnce(()=>{throw Error('offline');});expect(teleportToCoordinate(target)).toBe(false);expect(source.discard).not.toHaveBeenCalled();
 expect(teleportToCoordinate(target)).toBe(true);expect(source.discard).toHaveBeenCalledOnce();visit.close();expect(source.restore).not.toHaveBeenCalled();
});
