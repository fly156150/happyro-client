import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
	network: { close: vi.fn(), requestPing: vi.fn(() => true) },
	session: { AID: 1, GID: 22, FreezeUI: false, Playing: true },
	camera: { zoom: 140, zoomFinal: 140, angle: new Float32Array([230, 35]), angleFinal: new Float32Array([230, 35]) },
	map: { currentMap: 'prontera.gat' }, reload: vi.fn(), logout: vi.fn(async () => true), auth: { available: false }
}));
vi.mock('Engine/Auth/GameSession.js', () => ({ default: mocks.auth }));
vi.mock('Network/NetworkManager.js', () => ({ default: mocks.network }));
vi.mock('Engine/SessionStorage.js', () => ({ default: mocks.session }));
vi.mock('Core/Configs.js', () => ({ default: { getServer: () => ({ address: 'local', port: 6900 }) } }));
vi.mock('Renderer/Camera.js', () => ({ default: mocks.camera }));
vi.mock('Renderer/MapRenderer.js', () => ({ default: mocks.map }));
vi.mock('Engine/LoginEngine.js', () => ({ default: { reload: mocks.reload, logout: mocks.logout } }));
import recovery, { gameRecoveryReady, rememberCharServer, recoverLogin } from '../../src/Engine/Recovery/GameRecovery.js';
const server = { ip: 1, port: 6121, name: 'Test' };
const dialog = () => document.querySelector('.mobile-message-host')?.shadowRoot;
let cleanup;
beforeEach(() => {
	vi.useFakeTimers(); vi.clearAllMocks();
	cleanup = vi.fn(); mocks.auth.available = false;
	Object.assign(mocks.session, { AID: 1, GID: 22, FreezeUI: false, Playing: true });
	mocks.map.currentMap = 'prontera.gat';
	mocks.camera.zoomFinal = 140; mocks.camera.angleFinal.set([230, 35]);
	rememberCharServer(server); gameRecoveryReady(cleanup);
});
afterEach(() => { recovery.cancel(); vi.useRealTimers(); });
it('blocks input while checking and restores the existing NPC freeze state on pong', () => {
	mocks.session.FreezeUI = true;
	window.dispatchEvent(new Event('online'));
	expect(dialog().textContent).toContain('正在检查连接');
	expect(mocks.network.requestPing).toHaveBeenCalledTimes(1);
	recovery.pong();
	expect(dialog()).toBeUndefined();
	expect(mocks.session.FreezeUI).toBe(true);
	expect(mocks.network.close).not.toHaveBeenCalled();
});
it('shows a bounded recovery action without auto-sending credentials', async () => {
	recovery.disconnected();
	expect(mocks.session.Playing).toBe(false);
	expect(mocks.session.FreezeUI).toBe(true);
	expect(dialog().textContent).toContain('未完成的交易');
	expect(mocks.reload).not.toHaveBeenCalled();
	dialog().querySelector('button').click();
	await vi.dynamicImportSettled();
	expect(cleanup).toHaveBeenCalledTimes(1);
	expect(mocks.reload).toHaveBeenCalledWith(true);
	expect(dialog()).toBeUndefined();
});
it('restores camera only after reauthentication, PIN and server-authoritative map load', () => {
	recovery.disconnected(); recovery.beginLogin();
	expect(recoverLogin(1, [server])).toEqual(server);
	recovery.characterList([{ GID: 22, CharNum: 1 }], vi.fn()); recovery.pin(0);
	expect(dialog().textContent).toContain('正在恢复角色');
	mocks.camera.zoomFinal = 110; mocks.camera.angleFinal.set([230, 0]);
	gameRecoveryReady(cleanup);
	expect(mocks.camera.zoomFinal).toBe(140);
	expect([...mocks.camera.angleFinal]).toEqual([230, 35]);
	expect(dialog()).toBeUndefined();
	expect(mocks.session.FreezeUI).toBe(false);
});
it('uses the new map camera if the server moved the character while offline', () => {
	recovery.disconnected(); recovery.beginLogin(); recoverLogin(1, [server]);
	recovery.pin(0); recovery.characterList([{ GID: 22 }], vi.fn());
	mocks.map.currentMap = 'prt_in.gat'; mocks.camera.zoomFinal = 100;
	gameRecoveryReady(cleanup);
	expect(mocks.camera.zoomFinal).toBe(100);
});
it('does not restore an old role when the user logs out', async () => {
	recovery.disconnected();
	dialog().querySelectorAll('button')[1].click();
	await vi.dynamicImportSettled();
	expect(recovery.state).toBe('idle');
	expect(recoverLogin(1, [server])).toBeNull();
});

it('automatically restores an authenticated foreground session once per failure', async () => {
	mocks.auth.available = true;
	recovery.disconnected();
	await vi.runAllTicks(); await vi.dynamicImportSettled();
	expect(mocks.reload).toHaveBeenCalledTimes(1);
	expect(mocks.reload).toHaveBeenCalledWith(true);
	recovery.disconnected(); await vi.runAllTicks();
	expect(mocks.reload).toHaveBeenCalledTimes(1);
});
