import { expect, it } from 'vitest';
import { skillRequirementReason } from '../../src/UI/Game/CombatSkillRequirements.js';

const actor = changes => ({ hp: 100, hpMax: 100, ap: 10, spiritCount: 5, soulCount: 5,
 weapons: ['Fist'], effects: 0, hasStatus: () => false, itemCount: () => 0, ...changes });
it.each([
 [{ ApCost: 10 }, 'ap', '', 'AP 不足'],
 [{ HpCost: 10 }, 'hp', '', 'HP 不足'],
 [{ SpiritSphereCost: 5 }, 'spiritCount', '', '气弹或仆从球不足'],
 [{ SpiritSphereCost: 5 }, 'soulCount', 'SP_SHA', '灵魂球不足']
])('does not infer a shortage from an unknown resource: %j', (req, field, name, reason) => {
 for (const value of [undefined, null, NaN])
  expect(skillRequirementReason(req, 1, actor({ [field]: value }), name)).toBe('');
 expect(skillRequirementReason(req, 1, actor({ [field]: 0 }), name)).toBe(reason);
});
it('does not infer a missing state from an unmapped status icon', () => {
 expect(skillRequirementReason({ Status: [{ name: 'Unknown' }] }, 1, actor())).toBe('');
 expect(skillRequirementReason({ Status: [{ name: 'Known', icon: 1 }] }, 1, actor())).toBe('缺少前置状态');
});
it('leaves uncatalogued weapons undecided but checks known unarmed and incompatible weapons', () => {
 const req = { Weapon: { '1hSpear': true } };
 for (const weapons of [undefined, [], [undefined], ['1hSword', undefined]])
  expect(skillRequirementReason(req, 1, actor({ weapons }))).toBe('');
 for (const weapons of [['Fist'], ['1hSword']])
  expect(skillRequirementReason(req, 1, actor({ weapons }))).toBe('武器类型不符');
 expect(skillRequirementReason(req, 1, actor({ weapons: ['1hSpear'] }))).toBe('');
});
it('leaves water and hidden material exemptions undecided without hiding a known material shortage', () => {
 const req = { State: 'Water', ItemCost: [{ Item: 717, Amount: 1, variable: true },
  { Item: 6146, Amount: 1, variable: true }] };
 expect(skillRequirementReason(req, 1, actor())).toBe('');
 expect(skillRequirementReason({ ...req, ItemCost: [...req.ItemCost, { Item: 1065, Amount: 1 }] }, 1, actor())).toBe('材料不足');
});
