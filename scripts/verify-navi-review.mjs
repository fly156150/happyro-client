import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function sorted(value) {
 if (Array.isArray(value)) return value.map(sorted);
 if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
 return value;
}

/** Verify the published artifact and client-owned inputs, including in standalone/Docker builds.
 * The root review.py check separately verifies the complete server/localization corpus.
 */
export function verifyNaviReview(root = clientRoot) {
 const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/DB/Navigation/NaviTargets.json'), 'utf8'));
 const { version, ...payload } = manifest;
 if (manifest.schema !== 1 || manifest.accessPolicy !== 'adventure-tools-server-rules' ||
     !manifest.sources || !manifest.entries || Object.keys(manifest.entries).length === 0 ||
     version !== digest(JSON.stringify(sorted(payload), null, 2) + '\n')) {
  throw new Error('NAVI review is missing, invalid or has changed. Run the root NAVI review workflow before building.');
 }
 const prefix = 'repos/happyro-client/';
 if (!manifest.sources[`${prefix}src/DB/Map/SupportedMapTable.js`]) throw new Error('NAVI review is missing the client map support source.');
 for (const [source, hash] of Object.entries(manifest.sources)) {
  if (!source.startsWith(prefix)) continue;
  const file = path.resolve(root, source.slice(prefix.length));
  if (!file.startsWith(path.resolve(root) + path.sep) || digest(fs.readFileSync(file)) !== hash)
   throw new Error(`NAVI review is stale: ${source}. Review and regenerate before building.`);
 }
 for (const [key, entry] of Object.entries(manifest.entries)) {
  if (!key || !['coordinate', 'monster', 'blocked'].includes(entry.kind)) throw new Error('Invalid reviewed NAVI target.');
  if (entry.kind === 'coordinate' && (!entry.mapName || !Number.isInteger(entry.x) || !Number.isInteger(entry.y) || entry.x < 0 || entry.y < 0 || entry.x > 65534 || entry.y > 65534))
   throw new Error(`Invalid reviewed NAVI coordinate: ${key}`);
  if (entry.kind === 'monster' && (!Number.isInteger(entry.monsterId) || entry.monsterId <= 0)) throw new Error(`Invalid reviewed NAVI monster: ${key}`);
 }
 return version;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const args = process.argv.slice(2);
 if (!args.length || args.includes('--help') || args.every(arg => arg === '--no-color')) {
  const c = (code, value) => args.includes('--no-color') ? value : `\x1b[${code}m${value}\x1b[0m`;
  console.log(`\n${c('1;36', 'NAVI review verification')}\n\n${c('1;33', 'Usage')}\n  ${c('1;32', 'check')} [--no-color]\n\n${c('1;33', 'Example')}\n  ${c('36', 'node scripts/verify-navi-review.mjs check --no-color')}\n`);
 } else if (args[0] === 'check' && args.slice(1).every(arg => arg === '--no-color')) {
  try { console.log(`NAVI client inputs verified: ${verifyNaviReview()}`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
 } else { console.error('Usage: node scripts/verify-navi-review.mjs check [--no-color]'); process.exitCode = 2; }
}
