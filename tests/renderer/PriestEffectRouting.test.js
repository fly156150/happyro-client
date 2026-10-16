import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('Renderer/EntityManager.js', () => ({ default: {} }));
import SK from '../../src/DB/Skills/SkillConst.js';
import SU from '../../src/DB/Skills/SkillUnitConst.js';
import SkillEffect from '../../src/DB/Skills/SkillEffect.js';
import { fourthJobRenderEffects } from '../../src/DB/Skills/FourthJobEffects.js';
import { fourthJobGroundEffects, fourthJobGroundUnits } from '../../src/DB/Skills/FourthJobGroundEffects.js';

const source = readFileSync('src/Renderer/EffectManager.js', 'utf8').replaceAll('\r\n', '\n');
function routing() {
	const spam = vi.fn();
	const methods = ['spamSkill', 'spamSkillHit'].map(name => {
		const start = source.indexOf(`static ${name}(`);
		const end = source.indexOf('\n\t/**', start);
		return source.slice(start, end);
	}).join('\n');
	const Router = new Function('SkillEffect', 'EffectManager', `return class { ${methods} }`)(SkillEffect, { spam });
	return { Router, spam };
}

describe('priest packet effect routing', () => {
	it.each(['AB_CLEMENTIA', 'AB_CANTO', 'AB_PRAEFATIO', 'AB_LAUDAAGNUS', 'AB_LAUDARAMUS', 'AB_SECRAMENT'])(
		'%s plays its effect on the notified recipient', name => {
			const { Router, spam } = routing();
			Router.spamSkill(SK[name], 2, null, 1000, 1);
			expect(spam).toHaveBeenCalledOnce();
			expect(spam.mock.calls[0][0]).toMatchObject({ ownerAID: 2, otherAID: 1, startTick: 1000 });
		}
	);

	it('Dilectio renders both recipient layers without playing the casting layers again', () => {
		const { Router, spam } = routing();
		Router.spamSkill(SK.CD_DILECTIO_HEAL, 2, null, 1000, 1);
		expect(spam).toHaveBeenCalledOnce();
		const effect = spam.mock.calls[0][0];
		expect(effect.ownerAID).toBe(2);
		const layers = fourthJobRenderEffects[effect.effectId];
		expect(layers).toHaveLength(2);
		for (const layer of layers) expect(layer.file).toContain('target');
	});

	it('Pneumaticus keeps the persistent storm on its ground unit and damage on the victim', () => {
		const { Router, spam } = routing();
		Router.spamSkill(SK.CD_PNEUMATICUS_PROCELLA, 1, [10, 20, 0], 1000, 1);
		expect(spam).not.toHaveBeenCalled();
		Router.spamSkillHit(SK.CD_PNEUMATICUS_PROCELLA, 2, 1100, 1);
		expect(spam).toHaveBeenCalledOnce();
		expect(spam.mock.calls[0][0]).toMatchObject({ ownerAID: 2, otherAID: 1 });
		const layers = fourthJobGroundEffects[fourthJobGroundUnits[SU.UNT_PNEUMATICUS_PROCELLA]];
		expect(layers).toHaveLength(3);
		for (const layer of layers) expect(layer).toMatchObject({ type: 'STR', attachedEntity: true });
	});
});
