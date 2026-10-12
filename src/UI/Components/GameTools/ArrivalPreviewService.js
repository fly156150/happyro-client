import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';

let sequence = 0;
let pending = null;
let lastSent = 0;
function finish(error, value) {
	if (!pending) return;
	const request = pending;
	pending = null;
	clearTimeout(request.timer);
	request.signal?.removeEventListener('abort', request.abort);
	if (error) request.reject(error);
	else request.resolve(value);
}
onConnectionEnd(() => {
	finish(new Error('连接已断开'));
	lastSent = 0;
});

/** Latest selection wins. Debounce and spacing apply across window reopenings. */
export function requestArrivalPreview(mapName, signal) {
	finish(new Error('地图选择已变化'));
	if (signal?.aborted) return Promise.reject(new Error('预览已取消'));
	return new Promise((resolve, reject) => {
		const requestId = ++sequence;
		const abort = () => finish(new Error('预览已取消'));
		pending = { requestId, resolve, reject, signal, abort };
		signal?.addEventListener('abort', abort, { once: true });
		pending.timer = setTimeout(
			() => {
				const packet = new PACKET.CZ.HAPPYRO_ARRIVAL_PREVIEW();
				packet.requestId = requestId;
				packet.mapName = mapName;
				lastSent = Date.now();
				pending.timer = setTimeout(() => finish(new Error('落点预览超时')), 5000);
				try {
					if (Network.sendPacket(packet) === false) throw new Error('连接已断开');
				} catch (error) {
					finish(error);
				}
			},
			Math.max(200, 600 - (Date.now() - lastSent))
		);
	});
}
export function handleArrivalPreview(packet) {
	if (!pending || pending.requestId !== packet.requestId) return false;
	if (packet.result !== 0) {
		const messages = {
			1: '当前未开放传送',
			2: '不允许跨地图传送',
			3: '查询过于频繁，请稍后重新选择',
			4: '地图不可用',
			5: '当前无法进入该地图',
			6: '暂未找到预计落点，传送时由服务器完整检查'
		};
		finish(new Error(messages[packet.result] || '无法预览落点'));
	} else finish(null, { x: packet.x, y: packet.y });
	return true;
}
