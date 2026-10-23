const channelGroups = [
	// Parallel novice training grounds share one catalog entry per area.
	['new_1-1', 'new_2-1', 'new_3-1', 'new_4-1', 'new_5-1'],
	['new_1-2', 'new_2-2', 'new_3-2', 'new_4-2', 'new_5-2'],
	['new_1-3', 'new_2-3', 'new_3-3', 'new_4-3', 'new_5-3'],
	['new_1-4', 'new_2-4', 'new_3-4', 'new_4-4', 'new_5-4'],
	['iz_int', 'iz_int01', 'iz_int02', 'iz_int03', 'iz_int04'],
	['int_land', 'int_land01', 'int_land02', 'int_land03', 'int_land04'],
	['izlude', 'izlude_a', 'izlude_b', 'izlude_c', 'izlude_d'],
	['prt_fild08', 'prt_fild08a', 'prt_fild08b', 'prt_fild08c', 'prt_fild08d'],
	['iz_ac01', 'iz_ac01_a', 'iz_ac01_b', 'iz_ac01_c', 'iz_ac01_d'],
	['iz_ac02', 'iz_ac02_a', 'iz_ac02_b', 'iz_ac02_c', 'iz_ac02_d']
];

const channelsByMap = new Map();
for (const group of channelGroups) {
	group.forEach((mapName, index) => {
		channelsByMap.set(mapName, {
			canonicalMapName: group[0],
			channel: index + 1
		});
	});
}

function normalizeResourceName(mapName) {
	return String(mapName || '')
		.replace(/\.(?:gat|rsw)$/i, '')
		.toLocaleLowerCase();
}

export function getMapChannel(mapName) {
	return channelsByMap.get(normalizeResourceName(mapName)) || null;
}

export function isVisibleMapChannel(mapName, channelsEnabled) {
	const channel = getMapChannel(mapName);
	return channelsEnabled || !channel || channel.channel === 1;
}

export function getMapChannelDisplayName(mapName, displayName, channelsEnabled) {
	const channel = getMapChannel(mapName);
	if (!channelsEnabled || !channel) return displayName;
	return `${displayName} · 频道 ${channel.channel}`;
}
