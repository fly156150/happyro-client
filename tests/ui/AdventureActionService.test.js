import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ send: vi.fn(), session: { NavigationTeleportAllowed: true } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: state.session }));
vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: state.send } }));
vi.mock('Network/PacketStructure.js', () => ({ default: { CZ: { HAPPYRO_MAP_TELEPORT: class {} } } }));
vi.mock('Renderer/MapRenderer.js', () => ({ default: { currentMap: 'izlude' } }));
vi.mock('DB/Map/SupportedMapTable.js', () => ({ isSupportedMapResource: () => true }));
import { teleportToRandomCell, teleportToCoordinate, handleMapTeleportResult, getAdventureActionState } from '../../src/UI/Components/GameTools/AdventureActionService.js';
import { endConnection } from '../../src/Network/ConnectionLifecycle.js';
beforeEach(() => { vi.useFakeTimers(); endConnection(); vi.clearAllMocks(); });
afterEach(() => { endConnection(); vi.useRealTimers(); });
it('correlates automatic teleport completion and retains the server cooldown', () => {
 const complete = vi.fn(); teleportToCoordinate({ mapName: 'izlude', x: 0, y: 0 }, complete);
 const packet = state.send.mock.calls[0][0]; expect(packet).toMatchObject({ mapName: 'izlude', x: 0, y: 0 });
 expect(handleMapTeleportResult({ requestId: packet.requestId - 1, result: 0 })).toBe(false); expect(complete).not.toHaveBeenCalled();
 const reply = { requestId: packet.requestId, result: 0, cooldownRemaining: 15 };
 handleMapTeleportResult(reply); handleMapTeleportResult(reply); expect(complete).toHaveBeenCalledExactlyOnceWith(reply);
 expect(getAdventureActionState()).toMatchObject({ canTeleport: false, cooldownRemaining: 15 });
 vi.advanceTimersByTime(15000); expect(getAdventureActionState().canTeleport).toBe(true);
});
it.each(['timeout', 'disconnect', 'rejected'])('completes on %s without later accepting a stale result', reason => {
 const complete = vi.fn(); teleportToCoordinate({ mapName: 'izlude', x: 0, y: 0 }, complete);
 const { requestId } = state.send.mock.calls[0][0];
 if (reason === 'timeout') vi.advanceTimersByTime(8000);
 if (reason === 'disconnect') endConnection();
 if (reason === 'rejected') handleMapTeleportResult({ requestId, result: 5 });
 expect(complete).toHaveBeenCalledOnce(); expect(complete.mock.calls[0][0].result).not.toBe(0);
 expect(handleMapTeleportResult({ requestId, result: 0 })).toBe(false);
});

it('distinguishes random safe cells from default map arrivals and keeps completion handling', () => {
 const complete = vi.fn();
 expect(teleportToRandomCell('izlude', complete)).toBe(true);
 const packet = state.send.mock.calls[0][0];
 expect(packet).toMatchObject({ mapName: 'izlude', x: 65535, y: 65535 });
 const reply = { requestId: packet.requestId, result: 0, cooldownRemaining: 0 };
 handleMapTeleportResult(reply);
 expect(complete).toHaveBeenCalledExactlyOnceWith(reply);
 teleportToCoordinate({mapName: 'izlude', x: 0, y: 0});
 expect(state.send.mock.calls[1][0]).toMatchObject({x: 0, y: 0});
});
