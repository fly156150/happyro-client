const MiniMapTable = {
	// These official training worlds share tra_fild02 ground and minimap art.
	tra_fild01: 'tra_fild02',
	tra_fild03: 'tra_fild02',
	int_land: 'alb2trea',
	int_land01: 'alb2trea',
	int_land02: 'alb2trea',
	int_land03: 'alb2trea',
	int_land04: 'alb2trea'
};

// Official resnametable.txt maps the twenty classic grounds to four zone images.
for (let group = 1; group <= 5; group++) {
	for (let area = 1; area <= 4; area++) {
		MiniMapTable[`new_${group}-${area}`] = `new_zone0${area}`;
	}
}

export default MiniMapTable;
