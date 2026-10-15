import { interactionSnapshot } from './ServerInteraction.js';

export function storageTransferStatus() {
	const request = interactionSnapshot()?.storageTransfer;
	if (!request) return '';
	if (!request.pending) return request.message;
	return Date.now() - request.started > 8000
		? '服务器尚未确认，请关闭并重新打开仓库核对物品'
		: '已请求转移，等待服务器更新';
}

export function acknowledgeStorageTransfer(kind, packet) {
	const request = interactionSnapshot()?.storageTransfer;
	if (!request?.pending) return;
	if (kind === 'remove' && packet.count === 0) {
		request.pending = false;
		request.success = false;
		request.message = '转移未成功，请检查容量、负重及物品限制';
		return;
	}
	const matches =
		kind === 'add'
			? request.destination === 'storage' && packet.ITID === request.id
			: request.source === 'storage' && packet.index === request.index;
	if (!matches || packet.count !== request.count) return;
	request.pending = false;
	request.success = true;
	request.message = `已${kind === 'add' ? '存入' : '取出'} ${packet.count} 个物品`;
}
