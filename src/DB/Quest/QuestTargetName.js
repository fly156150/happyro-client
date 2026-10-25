import MonsterNameTable from '../Monsters/MonsterNameTable.js';
import MonsterServerNameTable from '../Monsters/MonsterServerNameTable.js';

// Generic race/map objectives use a placeholder monster ID. Only expand an
// exact current database label, preserving the server's objective description.
export function questTargetName(hunt) {
	const name = hunt.mobName || '';
	return name && name === MonsterServerNameTable[hunt.mobGID] ? MonsterNameTable[hunt.mobGID] : name;
}
