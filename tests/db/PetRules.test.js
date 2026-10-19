import { expect, it } from 'vitest';
import rules from '../../src/DB/Pets/PetRules.generated.json';

it.each([
 [1107, 1106, 9129],
 [1040, 3023, 9131],
 [20696, 20697, 9124]
])('exposes the server evolution from %i even when the old Lua catalog omits it', (source, target, egg) => {
 expect(rules.pets[target].PetEggID).toBe(egg);
 expect(rules.pets[source].Evolution[egg].length).toBeGreaterThan(0);
});

it('resolves every current recipe to a pet egg and positive material quantities', () => {
 const eggs = new Set(Object.values(rules.pets).map(pet => pet.PetEggID));
 let branches = 0;
 for (const pet of Object.values(rules.pets)) {
  for (const [egg, materials] of Object.entries(pet.Evolution)) {
   branches++;
   expect(eggs.has(Number(egg))).toBe(true);
   expect(materials.length).toBeGreaterThan(0);
   for (const material of materials) {
    expect(Number.isInteger(material.MaterialID) && material.MaterialID > 0).toBe(true);
    expect(Number.isInteger(material.Amount) && material.Amount > 0).toBe(true);
   }
  }
 }
 expect(branches).toBe(27);
});

it('uses current server auto-feed eligibility and records reproducible source hashes', () => {
 expect(rules.pets[1002].AutoFeeding).toBe(false);
 expect(rules.pets[1090].AutoFeeding).toBe(true);
 expect(rules.sources['db/re/pet_db.yml']).toMatch(/^[a-f0-9]{64}$/);
 expect(rules.sources['db/import/pet_db.yml']).toMatch(/^[a-f0-9]{64}$/);
});
