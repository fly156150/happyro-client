import { PET_INCUBATOR_ID } from 'DB/Pets/PetRules.js';
import { showToast } from 'UI/Components/Toast.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';

let pending = new WeakMap();
const labels = { use: '使用', equip: '穿戴', unequip: '卸下', drop: '丢弃', card: '镶嵌' };
onConnectionEnd(() => {
	pending = new WeakMap();
});

/** Only menu requests receive feedback; unrelated inventory updates are silent. */
export function beginItemOperation(entity, action, index) {
	if (!pending.has(entity)) pending.set(entity, new Map());
	const requests = pending.get(entity),
		key = `${action}:${index}`;
	requests.set(key, (requests.get(key) || 0) + 1);
}
export function finishItemOperation(entity, action, index, success) {
	const requests = pending.get(entity),
		key = `${action}:${index}`;
	const count = requests?.get(key);
	if (!count) return;
	if (count === 1) requests.delete(key);
	else requests.set(key, count - 1);
	if (success === null) return;
	showToast(document.body, `${labels[action]}${success ? '成功' : '失败'}`, success ? 'success' : 'error');
}

/** Packet decoders normalize equipment result codes to booleans. */
export function receiveItemOperationResult(entity, action, packet) {
	const index = action === 'drop' ? packet.Index : action === 'card' ? packet.cardIndex : packet.index;
	const success =
		action === 'drop' ? packet.count > 0 : action === 'card' ? packet.result === 0 : Number(packet.result) === 1;
	// The egg selector (or its empty-list message) is the incubator's feedback.
	finishItemOperation(entity, action, index, action === 'use' && packet.id === PET_INCUBATOR_ID && success ? null : success);
}
