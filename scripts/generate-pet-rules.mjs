import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import yaml from 'js-yaml';

const { values } = parseArgs({
	options: {
		server: { type: 'string' },
		output: { type: 'string' },
		check: { type: 'boolean' },
		help: { type: 'boolean' },
		'no-color': { type: 'boolean' }
	}
});
if (values.help || !values.server) {
	const color = (code, text) => (values['no-color'] ? text : `\x1b[${code}m${text}\x1b[0m`);
	console.log(
		`\n${color('1;36', 'HappyRO pet rules')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node scripts/generate-pet-rules.mjs --server PATH')} [--output PATH] [--check] [--no-color]\n\n${color('1;33', 'Examples')}\n  ${color('36', 'node scripts/generate-pet-rules.mjs --server ../happyro-server')}\n  ${color('36', 'node scripts/generate-pet-rules.mjs --server ../happyro-server --check --no-color')}\n`
	);
	process.exit(0);
}
const server = path.resolve(values.server);
const output = path.resolve(values.output || path.join(import.meta.dirname, '../src/DB/Pets/PetRules.generated.json'));
const sources = {};
async function database(file, key, entries = new Map()) {
	const raw = await fs.readFile(path.join(server, file));
	sources[file] = crypto.createHash('sha256').update(raw).digest('hex');
	const data = yaml.load(raw.toString('utf8'), { json: true });
	for (const entry of data.Body || []) {
		const old = entries.get(entry[key]) || {};
		const merged = { ...old, ...entry };
		if (entry.Evolution && old.Evolution) {
			const evolutions = new Map(old.Evolution.map(e => [e.Target, e]));
			for (const evolution of entry.Evolution) evolutions.set(evolution.Target, evolution);
			merged.Evolution = [...evolutions.values()];
		}
		entries.set(entry[key], merged);
	}
	for (const child of data.Footer?.Imports || [])
		if (!child.Mode || child.Mode === 'Renewal') await database(child.Path, key, entries);
	return entries;
}
const items = await database('db/item_db.yml', 'Id');
const mobs = await database('db/mob_db.yml', 'Id');
const pets = await database('db/pet_db.yml', 'Mob');
const itemIds = new Map([...items.values()].map(i => [i.AegisName, i.Id]));
const mobIds = new Map([...mobs.values()].map(m => [m.AegisName, m.Id]));
function itemId(name) {
	const id = itemIds.get(name);
	if (!id) throw new Error(`Unknown item ${name}`);
	return id;
}
const rules = {};
for (const pet of pets.values()) {
	const job = mobIds.get(pet.Mob);
	if (!job) throw new Error(`Unknown pet mob ${pet.Mob}`);
	const evolution = {};
	for (const branch of pet.Evolution || []) {
		const target = pets.get(branch.Target);
		if (!target) throw new Error(`Unknown evolution pet ${branch.Target}`);
		evolution[itemId(target.EggItem)] = branch.ItemRequirements.map(m => ({
			MaterialID: itemId(m.Item),
			Amount: m.Amount
		}));
	}
	rules[job] = {
		PetJobID: job,
		PetEggID: itemId(pet.EggItem),
		FoodID: pet.FoodItem ? itemId(pet.FoodItem) : 0,
		AutoFeeding: pet.AllowAutoFeed === true,
		Evolution: evolution
	};
}
const contents = JSON.stringify({ sources, pets: rules }, null, 2) + '\n';
if (values.check) {
	if ((await fs.readFile(output, 'utf8')) !== contents)
		throw new Error('Pet rules differ from server databases; regenerate them.');
	console.log(`Pet rules verified: ${Object.keys(rules).length} pets`);
} else {
	await fs.mkdir(path.dirname(output), { recursive: true });
	await fs.writeFile(output, contents);
	console.log(`Pet rules generated: ${Object.keys(rules).length} pets`);
}
