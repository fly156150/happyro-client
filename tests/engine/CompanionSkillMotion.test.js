import { describe, expect, it, vi } from 'vitest';
import SK from '../../src/DB/Skills/SkillConst.js';
import { isFalconTargetAttackSkill, moveSkillCompanions } from '../../src/Engine/MapEngine/CompanionSkillMotion.js';

describe('falcon target attack movement', () => {
	it('covers hunter and fourth-job windhawk attacks', () => {
		for (const skill of [SK.HT_BLITZBEAT, SK.SN_FALCONASSAULT, SK.WH_HAWKRUSH, SK.WH_HAWKBOOMERANG, SK.WH_WILD_WALK]) {
			expect(isFalconTargetAttackSkill(skill)).toBe(true);
		}
	});

	it('does not move the falcon for unrelated skills', () => {
		expect(isFalconTargetAttackSkill(SK.WH_HAWK_M)).toBe(false);
	});
});

describe('companion motion from skill damage packets', () => {
	const companion = () => ({ position: [3, 4], walk: {}, walkToNonWalkableGround: vi.fn() });
	it('ignores a disappeared target for both falcon and warg skills', () => {
		const source = { falcon: companion(), wug: companion(), action: 2 };
		for (const skill of [SK.HT_BLITZBEAT, SK.WH_HAWKRUSH, SK.RA_WUGSTRIKE, SK.RA_WUGBITE]) {
			expect(() => moveSkillCompanions(source, undefined, skill)).not.toThrow();
		}
		expect(source.falcon.walkToNonWalkableGround).not.toHaveBeenCalled();
		expect(source.wug.walkToNonWalkableGround).not.toHaveBeenCalled();
	});
	it('preserves different flight and running paths for visible targets', () => {
		const source = { falcon: companion(), wug: companion(), action: 2 };
		const target = { position: [8, 9] };
		moveSkillCompanions(source, target, SK.WH_HAWKBOOMERANG);
		moveSkillCompanions(source, target, SK.RA_WUGSTRIKE);
		expect(source.falcon.walkToNonWalkableGround).toHaveBeenCalledWith(3, 4, 8, 9, 0, true, true);
		expect(source.wug.walkToNonWalkableGround).toHaveBeenCalledWith(3, 4, 8, 9, 1, false, true);
		expect(source.falcon.action).toBe(2);
		expect(source.wug.walk.speed).toBe(35);
	});
	it('does not move missing companions or move them for unrelated skills', () => {
		expect(() => moveSkillCompanions({}, { position: [8, 9] }, SK.RA_WUGBITE)).not.toThrow();
		const source = { falcon: companion(), wug: companion() };
		moveSkillCompanions(source, { position: [8, 9] }, SK.RA_ARROWSTORM);
		expect(source.falcon.walkToNonWalkableGround).not.toHaveBeenCalled();
		expect(source.wug.walkToNonWalkableGround).not.toHaveBeenCalled();
	});
});
