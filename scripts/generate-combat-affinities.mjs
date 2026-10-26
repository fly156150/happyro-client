import process from 'node:process';
import console from 'node:console';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import Status from '../src/DB/Status/StatusConst.js';
import { COMBAT_SKILL_RULES } from '../src/UI/Game/CombatSkillRules.js';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const color = !args.includes('--no-color');
const paint = (code, text) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);
if (!args.some(arg => arg !== '--no-color') || args.includes('--help')) {
	console.log(
		`\n${paint('1;36', '自动战斗克制资料')}\n\n${paint('1;33', '用法')}\n  ${paint('1;32', 'generate | check')} [--output 文件] [--no-color]\n\n${paint('1;33', '例子')}\n  ${paint('36', 'node scripts/generate-combat-affinities.mjs generate --output ../../work/combat-affinities.json')}\n  ${paint('36', 'node scripts/generate-combat-affinities.mjs check --output applications/pwa/data/combat/affinities.json --no-color')}\n`
	);
	process.exit(0);
}
const command = args.shift();
let output = path.resolve(root, '../../work/combat-affinities.json');
while (args.length) {
	const arg = args.shift();
	if (arg === '--output' && args.length) output = path.resolve(root, args.shift());
	else if (arg !== '--no-color') throw Error(`Unknown argument: ${arg}`);
}
if (!['generate', 'check'].includes(command)) throw Error(`Unknown command: ${command}`);
const server = path.resolve(root, '../happyro-server');
const sources = {};
async function read(file) {
	const text = await fs.readFile(path.join(server, file), 'utf8');
	sources[file] = crypto.createHash('sha256').update(text).digest('hex');
	return text;
}
const skillRows = yaml.load(await read('db/re/skill_db.yml')).Body;
const statusRows = yaml.load(await read('db/re/status.yml')).Body;
const statusIcons = Object.fromEntries(statusRows.map(row => [row.Status, Status[row.Icon?.replace(/^EFST_/, '')]]));
const itemRows = [];
for (const file of ['item_db_usable.yml', 'item_db_equip.yml', 'item_db_etc.yml']) {
	itemRows.push(
		...yaml.load(
			(await read(`db/re/${file}`))
				.split(/\r?\n/)
				.filter(line => /^Body:|^ {2}- Id:|^ {4}(?:AegisName|Type|SubType):/.test(line))
				.join('\n')
		).Body
	);
}
const itemIds = Object.fromEntries(itemRows.map(row => [row.AegisName, row.Id]));
const weapons = Object.fromEntries(itemRows.filter(row => row.Type === 'Weapon').map(row => [row.Id, row.SubType]));
const ammunition = Object.fromEntries(itemRows.filter(row => row.Type === 'Ammo').map(row => [row.Id, row.SubType]));
const requirements = row => {
	const req = { ...row.Requires };
	if (['NC_PILEBUNKER', 'NC_HOVERING', 'RL_P_ALTER'].includes(row.Name)) req.equippedRequired = true;
	if (req.Status)
		req.Status = Object.keys(req.Status)
			.filter(key => req.Status[key])
			.map(key => {
				return { name: key, icon: statusIcons[key] };
			});
	if (req.ItemCost)
		req.ItemCost = req.ItemCost.map(item => {
			if (!itemIds[item.Item]) throw Error(`Unknown required item: ${item.Item}`);
			return {
				...item,
				Item: itemIds[item.Item],
				...(item.Item.includes('Gemstone') || item.Item === 'Magic_Gear_Fuel' ? { variable: true } : {}),
				...(row.Name.startsWith('HT_') && item.Item === 'Booby_Trap'
					? {
							alternative: itemIds.Special_Alloy_Trap,
							requiresSkill: skillRows.find(skill => skill.Name === 'RA_RESEARCHTRAP').Id
						}
					: {})
			};
		});
	if (req.Equipment)
		req.Equipment = Object.keys(req.Equipment)
			.filter(key => req.Equipment[key])
			.map(key => {
				if (!itemIds[key]) throw Error(`Unknown required equipment: ${key}`);
				return itemIds[key];
			});
	return req;
};
const monsterSource = await read('db/re/mob_db.yml');
// Read only combat traits; unrelated upstream drop/race-group sections can repeat keys.
const monsterRows = yaml.load(
	monsterSource
		.split(/\r?\n/)
		.filter(line =>
			/^Body:|^ {2}- Id:|^ {4}(?:Size|Race|Element|ElementLevel|Class|Modes):|^ {6}(?:StatusImmune|SkillImmune):/.test(
				line
			)
		)
		.join('\n')
).Body;
const attributes = yaml.load(await read('db/re/attr_fix.yml')).Body;
for (const file of ['skill_db.yml', 'mob_db.yml', 'attr_fix.yml', 'item_db.yml', 'status.yml']) {
	const overrides = yaml.load(await read(`db/import/${file}`));
	if (overrides?.Body?.length || overrides?.Footer)
		throw Error(`Combat overrides in db/import/${file} require review before generating affinities`);
}
const customBattle = await read('conf/import/battle_conf.txt');
if (/^\s*undead_detect_type:/m.test(customBattle))
	throw Error('Review the custom undead detection rule before generating affinities');
const battleConfig = await read('conf/battle/battle.conf');
const undeadDetection = Number(battleConfig.match(/^undead_detect_type:\s*(\d+)/m)[1]);
// Element overrides depend on buffs, ammunition, multiple hits, etc. Do not
// pretend the database element alone describes those skills.
const dynamic = new Set(['MC_CARTREVOLUTION']);
async function scan(directory) {
	for (const entry of (await fs.readdir(path.join(server, directory), { withFileTypes: true })).sort((a, b) =>
		a.name.localeCompare(b.name)
	)) {
		const file = `${directory}/${entry.name}`;
		if (entry.isDirectory()) await scan(file);
		else if (entry.name.endsWith('.cpp')) {
			const text = await fs.readFile(path.join(server, file), 'utf8');
			if (!text.includes('::modifyElement(')) continue;
			await read(file);
			for (const match of text.matchAll(/(?:SkillImpl\w*|WeaponSkillImpl)\((\w+)\)/g)) dynamic.add(match[1]);
		}
	}
}
await scan('src/map/skills');
await read('src/map/mob.cpp');
await read('src/map/battle.cpp');
for (const file of [
	'acolyte/magnusexorcismus',
	'acolyte/turnundead',
	'acolyte/resurrection',
	'archer/beaststrafing',
	'gunslinger/bullseye',
	'swordman/pierce',
	'swordman/provoke',
	'acolyte/framen',
	'acolyte/effligo',
	'acolyte/pneumaticusprocella',
	'acolyte/massiveflameblaster',
	'mage/astralstrike',
	'mage/stonecurse',
	'archer/hawkboomerang',
	'thief/omegaabyssstrike',
	'swordman/dragonicaura',
	'swordman/traumaticblow',
	'thief/venomsplasher',
	'thief/steal',
	'thief/mug',
	'swordman/grandjudgement',
	'swordman/judgementcross',
	'thief/fatalshadowcrow',
	'merchant/rushquake',
	'mage/chainlightning',
	'mage/tetravortex'
]) {
	await read(`src/map/skills/${file}.cpp`);
}
await read('src/map/skill.cpp');
await read('src/map/pc.cpp');
await read('src/map/status.cpp');
// These no-damage entry points explicitly dispatch damage on eligible targets
// or from their ground units in skill.cpp. Other control/support spells must
// not inherit damage multipliers merely because their database has an element.
const skills = Object.fromEntries(
	skillRows.map(row => [
		row.Id,
		{
			name: row.Name,
			element: COMBAT_SKILL_RULES[row.Name]?.element ?? row.Element ?? 'Neutral',
			targetType: row.TargetType,
			damage: ['Weapon', 'Magic', 'Misc'].includes(row.Type) && !row.DamageFlags?.NoDamage,
			radius: row.SplashArea ?? row.Unit?.Range ?? 0,
			unitRange: row.Unit?.Range ?? 0,
			unitLayout: row.Unit?.Layout ?? 0,
			noFootSet: Boolean(row.Unit?.Flag?.NoFootSet),
			trap: Boolean(row.Flags?.IsTrap),
			requires: requirements(row),
			targetEmperium: Boolean(row.Flags?.TargetEmperium),
			elemental:
				(COMBAT_SKILL_RULES[row.Name]?.convertsDamage ||
					(['Weapon', 'Magic', 'Misc'].includes(row.Type) && !row.DamageFlags?.NoDamage)) &&
				!row.DamageFlags?.IgnoreElement,
			dynamic: dynamic.has(row.Name) || Boolean(COMBAT_SKILL_RULES[row.Name]?.dynamic)
		}
	])
);
// Same defaults and class-immunity additions as MobDatabase::loadingFinished.
const monsters = Object.fromEntries(
	monsterRows.map(row => [
		row.Id,
		{
			element: row.Element ?? 'Neutral',
			elementLevel: row.ElementLevel ?? 1,
			race: row.Race ?? 'Formless',
			class: row.Class ?? 'Normal',
			size: row.Size ?? 'Small',
			statusImmune: Boolean(row.Modes?.StatusImmune || ['Boss', 'Guardian', 'Battlefield'].includes(row.Class)),
			skillImmune: Boolean(row.Modes?.SkillImmune || row.Class === 'Battlefield')
		}
	])
);
const elements = Object.fromEntries(attributes.map(({ Level, ...rates }) => [Level, rates]));
const data = {
	schema: 'happyro-combat-affinities/v1',
	sources,
	undeadDetection,
	elements,
	skills,
	monsters,
	ammunition,
	weapons
};
const text = JSON.stringify(data) + '\n';
if (command === 'check') {
	if ((await fs.readFile(output, 'utf8')) !== text)
		throw Error('Combat affinity snapshot is stale; regenerate from the current Renewal server');
} else {
	await fs.mkdir(path.dirname(output), { recursive: true });
	await fs.writeFile(output, text);
}
console.log(
	`${command}: ${skillRows.length} skills, ${monsterRows.length} monsters, ${attributes.length} element levels`
);
