import Session from 'Engine/SessionStorage.js';
import EntityManager from 'Renderer/EntityManager.js';
import UIManager from 'UI/UIManager.js';

const pending = new Map();
const ids = { pet: 'petId', homunculus: 'homunId', mercenary: 'mercId' };

function valid(record) {
	return Boolean(
		Session.Playing && Session.Entity === record.owner &&
		record.owner.action !== record.owner.ACTION.DIE &&
		Session[ids[record.kind]] === record.gid &&
		EntityManager.get(record.gid) === record.actor &&
		record.actor.action !== record.actor.ACTION.DIE && !record.actor.remove_tick
	);
}

function cancel(record) {
	if (pending.get(record.kind) !== record) return;
	pending.delete(record.kind);
	record.prompt?.remove();
}

/** Bind legacy information-window confirmations to the exact owner and companion. */
export function confirmCompanionAction(kind, message, action) {
	const previous = pending.get(kind);
	if (previous) cancel(previous);
	const gid = Session[ids[kind]];
	const actor = EntityManager.get(gid);
	if (!Session.Entity || !actor) return null;
	const record = { kind, gid, actor, owner: Session.Entity, ownerId: Session.AID };
	if (!valid(record)) return null;
	pending.set(kind, record);
	record.prompt = UIManager.showPromptBox(message, 'ok', 'cancel', () => {
		if (pending.get(kind) !== record) return;
		pending.delete(kind);
		if (valid(record)) action();
	}, () => {
		if (pending.get(kind) === record) pending.delete(kind);
	});
	return record.prompt;
}

export function invalidateCompanionPrompts(gid) {
	for (const record of pending.values()) {
		if (record.gid === gid || record.ownerId === gid) cancel(record);
	}
}

export function clearCompanionPrompts() {
	for (const record of pending.values()) cancel(record);
}
