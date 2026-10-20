import { PET_INCUBATOR_ID } from 'DB/Pets/PetRules.js';
import { showToast } from 'UI/Components/Toast.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';

let pending = new WeakMap();
const labels = { use: '使用', equip: '穿戴', unequip: '卸下', drop: '丢弃', card: '镶嵌' };
onConnectionEnd(() => {
	pending = new WeakMap();
});

/** Track explicit player requests; shortcuts only need failure notifications. */
export function beginItemOperation(entity, action, index, { notifySuccess = true } = {}) {
	if (!pending.has(entity)) pending.set(entity, new Map());
	const requests = pending.get(entity),
		key = `${action}:${index}`;
	if (!requests.has(key)) requests.set(key, []);
	requests.get(key).push({ notifySuccess });
}
export function finishItemOperation(entity, action, index, success) {
	const requests = pending.get(entity),
		key = `${action}:${index}`;
	const queue = requests?.get(key);
	if (!queue?.length) return;
	const { notifySuccess } = queue.shift();
	if (!queue.length) requests.delete(key);
	if (success === null || (success && !notifySuccess)) return;
	const message = !success && action === 'use'
		? '使用失败，请检查物品的等级、职业及其它使用条件'
		: `${labels[action]}${success ? '成功' : '失败'}`;
	showToast(document.body, message, success ? 'success' : 'error');
}

/** Packet decoders normalize equipment result codes to booleans. */
export function receiveItemOperationResult(entity, action, packet) {
	const index = action === 'drop' ? packet.Index : action === 'card' ? packet.cardIndex : packet.index;
	const success =
		action === 'drop' ? packet.count > 0 : action === 'card' ? packet.result === 0 : Number(packet.result) === 1;
	// The egg selector (or its empty-list message) is the incubator's feedback.
	finishItemOperation(entity, action, index, action === 'use' && packet.id === PET_INCUBATOR_ID && success ? null : success);
}
