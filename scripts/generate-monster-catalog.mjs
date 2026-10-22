import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const projectRoot = path.resolve(import.meta.dirname, '..');
const snapshotPath = path.resolve(
	projectRoot,
	process.env.MONSTER_CATALOG_SOURCE || '../happyro-api/resources/game-data/monsters/renewal.json'
);
const itemSnapshotPath = path.resolve(
	projectRoot,
	process.env.ITEM_CATALOG_SOURCE || '../happyro-api/resources/game-data/items/client-kro-20211105.json'
);
const imageDirectory = path.resolve(
	projectRoot,
	process.env.MONSTER_IMAGE_SOURCE || '../../work/game-data/monsters/kro-20211105'
);
const outputDirectory = path.resolve(projectRoot, 'applications/pwa/data/monsters');
const serverRoot = path.resolve(projectRoot, '../happyro-server');
const monsterConfigPaths = ['npc/scripts_monsters.conf', 'npc/re/scripts_monsters.conf'];
const tileSize = 96;
const contentSize = 88;
const columns = 20;
const rows = 20;
const entriesPerSheet = columns * rows;

const snapshotBuffer = await fs.readFile(snapshotPath);
const snapshot = JSON.parse(snapshotBuffer.toString('utf8'));
const itemSnapshotBuffer = await fs.readFile(itemSnapshotPath);
const itemSnapshot = JSON.parse(itemSnapshotBuffer.toString('utf8'));
const serverItemSnapshotPath = path.resolve(projectRoot, '../happyro-api/resources/game-data/items/renewal.json');
const serverItemSnapshot = JSON.parse((await fs.readFile(serverItemSnapshotPath)).toString('utf8'));
const itemsByAegisName = new Map();
const localizedItemsById = new Map(Object.entries(itemSnapshot.items));
for (const [id, item] of Object.entries(serverItemSnapshot.items)) {
	const localized = localizedItemsById.get(id);
	itemsByAegisName.set(item.AegisName, {
		id: Number.parseInt(id, 10),
		item: localized ? { ...item, names: localized.names } : item
	});
}
for (const [id, item] of Object.entries(itemSnapshot.items)) {
	itemsByAegisName.set(item.AegisName, { id: Number.parseInt(id, 10), item });
}
const imageFiles = (await fs.readdir(imageDirectory)).filter(file => /^\d+\.png$/.test(file));
const imageIds = new Set(imageFiles.map(file => Number.parseInt(file, 10)));
const monsters = Object.entries(snapshot.monsters)
	.map(([id, monster]) => ({ id: Number.parseInt(id, 10), monster }))
	.sort((left, right) => left.id - right.id);
const monstersWithImages = monsters.filter(({ id }) => imageIds.has(id));
const atlasIndexById = new Map(monstersWithImages.map(({ id }, index) => [id, index]));

async function collectEnabledNpcFiles(configPath, files = new Set(), configs = new Set()) {
	const normalizedPath = configPath.replaceAll('\\', '/');
	if (configs.has(normalizedPath)) return { files, configs };
	configs.add(normalizedPath);
	const contents = await fs.readFile(path.join(serverRoot, normalizedPath), 'utf8');
	for (const sourceLine of contents.split(/\r?\n/)) {
		const line = sourceLine.replace(/\/\/.*$/, '').trim();
		const directive = line.match(/^(import|npc):\s*(\S+)/i);
		if (!directive) continue;
		if (directive[1].toLocaleLowerCase() === 'import') {
			await collectEnabledNpcFiles(directive[2], files, configs);
		} else {
			files.add(directive[2].replaceAll('\\', '/'));
		}
	}
	return { files, configs };
}

function collectMonsterSpawns(contents, spawnsByMonster) {
	for (const sourceLine of contents.split(/\r?\n/)) {
		const line = sourceLine.replace(/\/\/.*$/, '').trim();
		if (!line) continue;
		const columns = line.split(/\t+/);
		if (columns.length < 4 || columns[1].toLocaleLowerCase() !== 'monster') continue;
		const location = columns[0].match(/^([a-z0-9_]+),(-?\d+),(-?\d+)(?:,(\d+),(\d+))?$/i);
		const parameters = columns[3].split(',');
		const monsterId = Number.parseInt(parameters[0], 10);
		const count = Number.parseInt(parameters[1], 10);
		if (!location || !Number.isInteger(monsterId) || !Number.isInteger(count) || count <= 0) continue;

		const mapName = location[1].toLocaleLowerCase();
		const spawn = {
			mapName,
			x: Math.max(0, Number.parseInt(location[2], 10)),
			y: Math.max(0, Number.parseInt(location[3], 10)),
			width: Number.parseInt(location[4] || '0', 10),
			height: Number.parseInt(location[5] || '0', 10),
			count
		};
		const byMap = spawnsByMonster.get(monsterId) || new Map();
		const current = byMap.get(mapName);
		if (!current) byMap.set(mapName, spawn);
		else {
			current.count += count;
			const currentArea = current.width * current.height;
			const candidateArea = spawn.width * spawn.height;
			if ((!current.x && spawn.x) || candidateArea > currentArea) {
				current.x = spawn.x;
				current.y = spawn.y;
				current.width = spawn.width;
				current.height = spawn.height;
			}
		}
		spawnsByMonster.set(monsterId, byMap);
	}
}

const enabledSources = { files: new Set(), configs: new Set() };
for (const configPath of monsterConfigPaths) {
	await collectEnabledNpcFiles(configPath, enabledSources.files, enabledSources.configs);
}
const spawnSourceHash = crypto.createHash('sha256');
const spawnsByMonster = new Map();
for (const sourcePath of [...enabledSources.configs, ...enabledSources.files].sort()) {
	const contents = await fs.readFile(path.join(serverRoot, sourcePath), 'utf8');
	spawnSourceHash.update(sourcePath).update(contents);
	if (enabledSources.files.has(sourcePath)) collectMonsterSpawns(contents, spawnsByMonster);
}

function localizeDrops(drops = []) {
	return drops.map(drop => {
		const entry = itemsByAegisName.get(drop.Item);
		if (!entry?.item.names?.['zh-CN']) {
			throw new Error(`Missing zh-CN item localization for monster drop: ${drop.Item}`);
		}
		return {
			...drop,
			itemId: entry.id,
			name: entry.item.names['zh-CN'],
			nameEn: entry.item.names['en-US'] || drop.Item
		};
	});
}

await fs.rm(outputDirectory, { recursive: true, force: true });
await fs.mkdir(outputDirectory, { recursive: true });

for (let sheetIndex = 0; sheetIndex * entriesPerSheet < monstersWithImages.length; sheetIndex += 1) {
	const sheetEntries = monstersWithImages.slice(sheetIndex * entriesPerSheet, (sheetIndex + 1) * entriesPerSheet);
	const composites = await Promise.all(
		sheetEntries.map(async ({ id }, tileIndex) => {
			const image = sharp(path.join(imageDirectory, `${id}.png`));
			const resized = await image
				.resize(contentSize, contentSize, { fit: 'inside', withoutEnlargement: true, kernel: 'nearest' })
				.png()
				.toBuffer({ resolveWithObject: true });
			const column = tileIndex % columns;
			const row = Math.floor(tileIndex / columns);
			return {
				input: resized.data,
				left: column * tileSize + Math.floor((tileSize - resized.info.width) / 2),
				top: row * tileSize + Math.floor((tileSize - resized.info.height) / 2)
			};
		})
	);

	await sharp({
		create: {
			width: columns * tileSize,
			height: rows * tileSize,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 }
		}
	})
		.composite(composites)
		.webp({ lossless: true, effort: 6 })
		.toFile(path.join(outputDirectory, `atlas-${sheetIndex}.webp`));
}

const catalog = {
	schema: 'happyro-monster-catalog/v4',
	source: {
		sha256: crypto.createHash('sha256').update(snapshotBuffer).digest('hex'),
		itemsSha256: crypto.createHash('sha256').update(itemSnapshotBuffer).digest('hex'),
		spawnsSha256: spawnSourceHash.digest('hex'),
		server: snapshot.serverSource,
		client: snapshot.clientSource,
		items: itemSnapshot.source
	},
	atlas: { tileSize, columns, rows },
	monsters: monsters.map(({ id, monster }) => {
		const atlasIndex = atlasIndexById.get(id);
		return {
			id,
			aegisName: monster.AegisName,
			name: monster.names?.['zh-CN'] || monster.names?.['en-US'] || monster.AegisName,
			nameEn: monster.names?.['en-US'] || monster.AegisName,
			level: monster.Level,
			hp: monster.Hp,
			attack: [monster.Attack, monster.Attack2],
			defense: monster.Defense,
			magicDefense: monster.MagicDefense,
			race: monster.Race,
			element: monster.Element,
			elementLevel: monster.ElementLevel,
			size: monster.Size,
			class: monster.Class || 'Normal',
			kind: monster.MvpDrops?.length ? 'mvp' : monster.Class === 'Boss' ? 'mini' : 'normal',
			baseExp: monster.BaseExp,
			jobExp: monster.JobExp,
			spawns: [...(spawnsByMonster.get(id)?.values() || [])].sort(
				(left, right) => right.count - left.count || left.mapName.localeCompare(right.mapName)
			),
			atlas: atlasIndex === undefined ? null : Math.floor(atlasIndex / entriesPerSheet),
			tile: atlasIndex === undefined ? null : atlasIndex % entriesPerSheet
		};
	})
};

// Drops are 70% of the catalog by size and are only needed when a monster is
// opened, so they ship as a separate file the detail pane fetches on demand.
const drops = {
	schema: 'happyro-monster-drops/v1',
	source: catalog.source,
	drops: Object.fromEntries(
		monsters.map(({ id, monster }) => [
			id,
			{ drops: localizeDrops(monster.Drops), mvpDrops: localizeDrops(monster.MvpDrops) }
		])
	)
};

await fs.writeFile(path.join(outputDirectory, 'catalog.json'), `${JSON.stringify(catalog)}\n`);
await fs.writeFile(path.join(outputDirectory, 'drops.json'), `${JSON.stringify(drops)}\n`);
console.log(
	`Generated ${monsters.length} monsters (${monstersWithImages.length} images) in ${Math.ceil(monstersWithImages.length / entriesPerSheet)} atlases.`
);
