/** Companion names must fit the server's 23-byte UTF-8 field without truncation. */
export function normalizeCompanionName(value) {
	const name = String(value).trim();
	return name &&
		new TextEncoder().encode(name).length <= 23 &&
		!Array.from(name).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
		? name
		: null;
}
