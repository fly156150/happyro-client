import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import process from 'node:process';
import console from 'node:console';
const args = process.argv.slice(2),
	color = !args.includes('--no-color');
const paint = (code, value) => (color ? `\x1b[${code}m${value}\x1b[0m` : value);
if (!args.some(arg => arg !== '--no-color') || args.includes('--help')) {
	console.log(
		`\n${paint('1;36', '自动恢复物品资料')}\n\n${paint('1;33', '用法')}\n  ${paint('1;32', 'generate | check')} --output 文件 [--no-color]\n\n${paint('1;33', '例子')}\n  ${paint('36', 'node scripts/generate-recovery-items.mjs generate --output ../../work/auto-recovery/items.json')}\n`
	);
	process.exit(0);
}
const command = args.shift();
let output;
while (args.length) {
	const arg = args.shift();
	if (arg === '--output') output = args.shift();
	else if (arg !== '--no-color') throw Error(`Unknown option: ${arg}`);
}
if (!['generate', 'check'].includes(command) || !output) throw Error('Specify generate/check and --output');
const server = path.resolve(import.meta.dirname, '../../happyro-server');
const sources = {},
	rows = new Map();
for (const file of ['db/re/item_db_usable.yml', 'db/import/item_db.yml']) {
	const source = await fs.readFile(path.join(server, file), 'utf8');
	sources[file] = crypto.createHash('sha256').update(source).digest('hex');
	const document = yaml.load(source);
	if (document?.Footer) throw Error(`Review nested item imports: ${file}`);
	for (const row of document?.Body || []) rows.set(row.Id, { ...rows.get(row.Id), ...row });
}
// Only complete, immediate healing scripts with constant/rand operands are admitted.
// Status cures, buffs, delayed consumption and conditional scripts require separate reviewed rules.
const operand = '(?:\\d+|rand\\(\\s*\\d+\\s*,\\s*\\d+\\s*\\))';
const pattern = new RegExp(`^\\s*(itemheal|percentheal)\\s+(${operand})\\s*,\\s*(${operand})\\s*;\\s*$`);
const positive = value => (value.match(/\d+/g) || []).some(value => Number(value) > 0);
const items = [...rows.values()]
	.flatMap(row => {
		const match = pattern.exec(row.Script || '');
		if (!match || row.Flags?.DelayConsume || row.Flags?.NoConsume || !['Healing', 'Usable'].includes(row.Type))
			return [];
		const hp = positive(match[2]),
			sp = positive(match[3]);
		return hp || sp
			? [
					{
						id: row.Id,
						hp,
						sp,
						mode: match[1] === 'percentheal' ? 'percent' : 'fixed',
						cooldownMs: row.Delay?.Duration || 0,
				cooldownGroup: row.Delay?.Status || `item:${row.Id}`,
				hpAmount: match[2],
						spAmount: match[3]
					}
				]
			: [];
	})
	.sort((a, b) => a.id - b.id);
const content = JSON.stringify({ sources, items }, null, 2) + '\n';
if (command === 'check') {
	if ((await fs.readFile(output, 'utf8')) !== content) throw Error('Recovery catalog is stale');
} else {
	await fs.mkdir(path.dirname(output), { recursive: true });
	await fs.writeFile(output, content);
}
console.log(`${command}: ${items.length} reviewed immediate recovery items`);
