import NpcNameTranslations from './NpcNameTranslations.zh-CN.json';

const PACKET_NAME_VISIBLE_LENGTH = 23;
const NpcNameTable = { ...NpcNameTranslations };
const packetNames = new Map();

for (const [source, translated] of Object.entries(NpcNameTable)) {
	if (!/^[\u0020-\u007e]+$/.test(source) || source.length <= PACKET_NAME_VISIBLE_LENGTH) {
		continue;
	}

	const packetName = source.slice(0, PACKET_NAME_VISIBLE_LENGTH);
	if (!packetNames.has(packetName)) packetNames.set(packetName, new Set());
	packetNames.get(packetName).add(translated);
}

// A truncated packet must not assign one person's name to another NPC.
// Ambiguous names are resolved by the server's complete-name packet.
for (const [packetName, translations] of packetNames) {
	if (!NpcNameTable[packetName] && translations.size === 1) {
		NpcNameTable[packetName] = translations.values().next().value;
	}
}

export default NpcNameTable;
