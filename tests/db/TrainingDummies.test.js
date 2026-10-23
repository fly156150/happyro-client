import { describe, it, expect } from 'vitest';
import monsters from '../../src/DB/Monsters/MonsterTable.js';
import names from '../../src/DB/Monsters/MonsterNameTable.js';

// All monster IDs spawned by the three official training fields.
const ids = [
 ...Array.from({ length: 25 }, (_, index) => 21064 + index),
 ...Array.from({ length: 118 }, (_, index) => 22551 + index)
];
describe('official training dummies', () => {
 it('resolves every dummy explicitly instead of the unknown-monster appearance', () => {
  expect(ids).toHaveLength(143);
  for (const id of ids) {
   expect(Object.hasOwn(monsters, id), String(id)).toBe(true);
   expect(monsters[id], String(id)).toMatch(/^S_DUMMY_/);
  }
 });
 it('retains distinct physical and magic resistance appearances', () => {
  expect(monsters[22551]).toBe('S_DUMMY_RES');
  expect(monsters[22589]).toBe('S_DUMMY_MRES');
  expect(monsters[22561]).toBe('S_DUMMY_DEFAULT');
 });
 it('provides translated names without YAML quotation marks', () => {
  for (const id of ids) {
   expect(names[id], String(id)).toMatch(/[\u3400-\u9fff]/);
   expect(names[id], String(id)).not.toMatch(/^["']|["']$/);
  }
 });
});
