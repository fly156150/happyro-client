import { acquireInputFreeze, releaseInputFreeze } from 'UI/InputFreeze.js';
import gameSession from '../Auth/GameSession.js';
import Network from 'Network/NetworkManager.js';
import Session from 'Engine/SessionStorage.js';
import Configs from 'Core/Configs.js';
import Camera from 'Renderer/Camera.js';
import MapRenderer from 'Renderer/MapRenderer.js';
import { showMobileDialog } from 'UI/Mobile/MessageDialog.js';
import { createRecoveryController } from './RecoveryController.js';

let dialog;
const recoveryInput = Symbol('game-recovery');
let charServer;
let prepareLogin;
let automaticAttempted = false;
async function logoutRecovery() {
	automaticAttempted = true;
	recovery.disconnected();
	const { default: login } = await import('Engine/LoginEngine.js');
	if (await login.logout()) recovery.beginLogin(false);
	else present('disconnected');
}
function tryAutomaticRecovery() {
	if (document.hidden || automaticAttempted || !gameSession.available || recovery.state !== 'disconnected') return;
	automaticAttempted = true;
	recovery.beginLogin();
}
const serverKey = () => {
	const server = Configs.getServer();
	return `${server.address}:${server.port}`;
};
function present(state, message) {
	if (state === 'playing') automaticAttempted = false;
	if (state === 'disconnected') queueMicrotask(tryAutomaticRecovery);
	dialog?.remove();
	dialog = null;
	if (['checking', 'disconnected', 'restoring'].includes(state)) acquireInputFreeze(recoveryInput);
	else releaseInputFreeze(recoveryInput);
	if (!['checking', 'disconnected', 'restoring'].includes(state)) return;
	const waiting = state === 'checking';
	const restoring = state === 'restoring';
	dialog = showMobileDialog({
		title: waiting ? '正在检查连接' : restoring ? '正在恢复角色' : '连接已断开',
		text:
			message ||
			(waiting
				? '正在确认服务器连接，请稍候。'
				: restoring
					? '正在重新获取角色和地图状态。'
					: '恢复连接后将自动进入原角色。未完成的交易和其他操作不会重复提交。'),
		buttons: waiting
			? []
			: restoring
				? [
						{
							name: '退出登录',
							callback: logoutRecovery
						}
					]
				: [
						{
							name: gameSession.available ? '恢复连接' : '重新登录并恢复',
							primary: true,
							callback: () => recovery.beginLogin()
						},
						{
							name: '退出登录',
							callback: logoutRecovery
						}
					]
	});
}
const recovery = createRecoveryController({
	probe: () => Network.requestPing(),
	close: () => {
		Session.Playing = false;
		acquireInputFreeze(recoveryInput);
		Network.close();
	},
	capture: () => ({ map: MapRenderer.currentMap, zoom: Camera.zoomFinal, angle: [...Camera.angleFinal] }),
	restore: view => {
		if (view.map !== MapRenderer.currentMap) return;
		Camera.zoom = Camera.zoomFinal = view.zoom;
		Camera.angle.set(view.angle);
		Camera.angleFinal.set(view.angle);
	},
	present,
	login: () => {
		prepareLogin?.();
		releaseInputFreeze(recoveryInput);
		import('Engine/LoginEngine.js').then(module => module.default.reload(true));
	},
	visible: () => !document.hidden
});

export default recovery;
export function rememberCharServer(server) {
	charServer = { ip: server.ip, port: server.port, name: server.name };
}
export function recoverLogin(accountId, servers) {
	return recovery.loginAccepted(accountId, serverKey(), servers);
}
export function gameRecoveryReady(cleanup) {
	prepareLogin = cleanup;
	releaseInputFreeze(recoveryInput);
	recovery.ready({ accountId: Session.AID, characterId: Session.GID, serverKey: serverKey(), charServer });
}
window.addEventListener('online', () => {
	recovery.check();
	tryAutomaticRecovery();
});
window.addEventListener('pageshow', () => recovery.check());
document.addEventListener('visibilitychange', () => {
	if (document.hidden) recovery.hidden();
	else {
		recovery.check();
		tryAutomaticRecovery();
	}
});
