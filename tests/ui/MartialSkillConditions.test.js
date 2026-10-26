import { describe, it, expect } from 'vitest';
import catalog from '../../applications/pwa/data/combat/affinities.json';
import { createCombatSkillPolicy } from '../../src/UI/Game/CombatSkillAffinity.js';
import { COMBAT_SKILL_RULES } from '../../src/UI/Game/CombatSkillRules.js';
import { skillRequirementReason } from '../../src/UI/Game/CombatSkillRequirements.js';

const monsters = {
  1: { class: 'Normal', statusImmune: false },
  2: { class: 'Boss', statusImmune: true },
  3: { class: 'Guardian', statusImmune: true }
};
const priority = (name, species) => {
  const id = Object.keys(catalog.skills).find(id => catalog.skills[id].name === name);
  return createCombatSkillPolicy({ ...catalog, monsters }, COMBAT_SKILL_RULES).priority({ id, level: 5 }, { species });
};
describe('martial target eligibility matches distinct server guards', () => {
  it('rejects Head Crush on Boss class but permits non-Boss status immunity', () => {
    expect(priority('LK_HEADCRUSH', 2)).toBeNull();
    expect(priority('LK_HEADCRUSH', 1)).not.toBeNull();
    expect(priority('LK_HEADCRUSH', 3)).not.toBeNull();
  });
  it.each(['AS_SPLASHER', 'TF_STEAL', 'RG_STEALCOIN', 'RG_STRIPWEAPON', 'RG_STRIPSHIELD', 'RG_STRIPARMOR', 'RG_STRIPHELM', 'ST_FULLSTRIP'])('%s rejects status-immune targets', name => {
    expect(priority(name, 1)).not.toBeNull();
    expect(priority(name, 2)).toBeNull();
    expect(priority(name, 3)).toBeNull();
  });
  it('keeps ordinary damaging skills usable when only their secondary ailment can fail', () => {
    expect(priority('TF_POISON', 2)).not.toBeNull();
    expect(priority('SHC_FATAL_SHADOW_CROW', 2)).not.toBeNull();
  });
  it('publishes actual monster class rather than guessing from immunity', () => {
    expect(catalog.monsters[1038].class).toBe('Boss');
    expect(Object.values(catalog.monsters).some(row => row.class === 'Guardian')).toBe(true);
  });
  it('requires Hovering equipment to be worn rather than merely carried', () => {
    const req = Object.values(catalog.skills).find(row => row.name === 'NC_HOVERING').requires;
    expect(req.equippedRequired).toBe(true);
    const actor = { effects: 0x80000, itemCount: () => 1, equippedItem: () => false };
    // Isolate the equipment condition from the separately checked Mado state.
    expect(skillRequirementReason({ Equipment: req.Equipment, equippedRequired: req.equippedRequired }, 1, actor)).toBe('缺少所需装备');
    actor.equippedItem = () => true;
    expect(skillRequirementReason({ Equipment: req.Equipment, equippedRequired: req.equippedRequired }, 1, actor)).toBe('');
  });
});
