import { describe, expect, it } from 'vitest';
import SK from '../../src/DB/Skills/SkillConst.js';
import { legacySupportRenderEffects as render, legacySupportSkillEffects as skills } from '../../src/DB/Skills/LegacySupportEffects.js';

describe('legacy support skill activation feedback', () => {
	it('anchors detection to the selected ground location, not the moving hunter', () => {
		expect(skills[SK.HT_DETECTING]).toEqual({ groundCastEffectId: 119 });
		expect(render[119].filter(layer => layer.type).every(layer => layer.attachedEntity === false)).toBe(true);
	});
	it('only displays buffs on successful casts, with bounded visible layers', () => {
		for (const [id, mapping] of Object.entries(skills)) {
			if (Number(id) === SK.HT_DETECTING) continue;
			expect(mapping.effectId).toBeUndefined();
			const effect = mapping.successEffectId ?? mapping.successEffectIdOnCaster;
			const layers = render[effect].filter(layer => layer.type);
			expect(layers.length).toBeGreaterThan(0);
			for (const layer of layers) {
				expect(layer.duration).toBeGreaterThan(0);
				expect(layer.duration).toBeLessThanOrEqual(1500);
				expect(layer.repeat).toBeUndefined();
			}
		}
	});
	it('uses the expiatio texture and routes the silentium wave to its caster', () => {
		expect(render['priest:expiatio'][0].file).toBe('effect/expiatio.tga');
		expect(skills[SK.AB_SILENTIUM]).toEqual({ successEffectIdOnCaster: 'priest:silentium' });
	});
});
