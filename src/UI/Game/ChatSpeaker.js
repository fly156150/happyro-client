import Session from 'Engine/SessionStorage.js';

/** Only another identified player's message offers a channel action. */
export function chatSpeakerMetadata({ id, name }) {
	const replyable = id !== undefined
		? Boolean(id) && id !== Session.AID && id !== Session.Entity?.GID
		: Boolean(name) && name !== Session.Entity?.display.name;
	return { replyable };
}
