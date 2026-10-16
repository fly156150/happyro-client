import { describe, expect, it } from 'vitest';
import SK from '../../src/DB/Skills/SkillConst.js';
import SkillInfo from '../../src/DB/Skills/SkillInfo.generated.js';
import {
	fourthJobEffectResources,
	fourthJobRenderEffects,
	fourthJobSkillEffects,
	fourthJobStatusEffects
} from '../../src/DB/Skills/FourthJobEffects.js';
import StatusConst from '../../src/DB/Status/StatusConst.js';

function filesOf(resources) {
	return [resources?.files ?? resources].flat();
}

describe('fourth-job explicit skill effects', () => {
	it('resolves later fourth-job packet IDs to their own effect stages', () => {
		for (const name of Object.keys(fourthJobEffectResources)) {
			const id = Number(Object.keys(SkillInfo).find(key => SkillInfo[key].Name === name));
			expect(SK[name], name).toBe(id);
			const mapping = fourthJobSkillEffects[id];
			expect(mapping, name).toBeDefined();
			for (const effect of Object.values(mapping)) {
				expect(fourthJobRenderEffects[effect].every(layer => typeof layer.file === 'string' && layer.file.length > 0)).toBe(true);
			}
		}
	});

	it('plays area explosions once on success, separately from damage hit packets', () => {
		for (const name of ['BO_EXPLOSIVE_POWDER', 'BO_MAYHEMIC_THORNS', 'MT_MIGHTY_SMASH', 'MT_SPARK_BLASTER']) {
			const stages = fourthJobSkillEffects[SK[name]];
			expect(stages.successEffectId, name).toBeDefined();
			expect(stages.effectId, name).toBeUndefined();
			expect(stages.hitEffectId, name).toBeUndefined();
		}
	});

	it('routes Abyss Chaser area starts once and keeps impacts separate', () => {
		const dagger = fourthJobSkillEffects[SK.ABC_ABYSS_DAGGER];
		expect(dagger.successEffectId).toBeDefined();
		expect(dagger.hitEffectId).toBeDefined();
		expect(dagger.effectId).toBeUndefined();
		const rush = fourthJobSkillEffects[SK.ABC_UNLUCKY_RUSH];
		expect(rush.successEffectIdOnCaster).toBeDefined();
		expect(rush.hitEffectId).toBeDefined();
		expect(rush.effectId).toBeUndefined();
		const strike = fourthJobSkillEffects[SK.ABC_ABYSS_STRIKE];
		expect(strike.groundCastEffectId).toBeDefined();
		expect(strike.hitEffectId).toBeDefined();
		expect(strike.effectId).toBeUndefined();
	});

	it('registers performer activations separately from victim damage', () => {
		for (const name of ['TR_MYSTIC_SYMPHONY', 'TR_KVASIR_SONATA', 'TR_NIPELHEIM_REQUIEM', 'TR_PRON_MARCH']) {
			const effect = fourthJobSkillEffects[SK[name]];
			expect(effect.beginCastEffectId, name).toBeDefined();
			expect(effect.successEffectId, name).toBeDefined();
			expect(effect.effectId, name).toBeUndefined();
		}
		expect(fourthJobSkillEffects[SK.TR_METALIC_FURY].hitEffectId).toBeDefined();
	});

	it('keeps official floor layers behind entities and separates cross-slash impact', () => {
		const cast = fourthJobRenderEffects[fourthJobSkillEffects[SK.WH_WILD_WALK].beginCastEffectId];
		expect(cast.map(layer => layer.renderBeforeEntities)).toEqual([false, true]);
		expect(cast.map(layer => layer.yOffset)).toEqual([10, 10]);
		const slash = fourthJobSkillEffects[SK.SHC_CROSS_SLASH];
		expect(fourthJobRenderEffects[slash.successEffectId][0].file).toContain('cross_slash/cross_slash');
		expect(fourthJobRenderEffects[slash.hitEffectId][0].file).toContain('shadow_stab_hit1');
	});

	it('registers every configured stage and all of its visual layers', () => {
		for (const [name, stages] of Object.entries(fourthJobEffectResources)) {
			const mapped = fourthJobSkillEffects[SK[name]];
			expect(mapped, name).toBeDefined();
			for (const [stage, resources] of Object.entries(stages)) {
				const effectId = mapped[stage];
				const layers = fourthJobRenderEffects[effectId];
				expect(layers, `${name}.${stage}`).toHaveLength(filesOf(resources).length);
				expect(layers.map(layer => layer.file), `${name}.${stage}`).toEqual(filesOf(resources));
				expect(layers.every(layer => layer.texturePath.endsWith('/'))).toBe(true);
			}
		}
	});

	it('maps representative classes and secondary damage packet IDs', () => {
		for (const name of [
			'SHC_POTENT_VENOM', 'MT_AXE_STOMP', 'CD_REPARATIO', 'WH_FLAMETRAP',
			'ABC_CHAIN_REACTION_SHOT_ATK', 'BO_HELLTREE', 'EM_ELEMENTAL_BUSTER_FIRE',
			'IQ_JUDGE', 'TR_ROSEBLOSSOM_ATK', 'HN_JUPITEL_THUNDER_STORM'
		]) {
			expect(fourthJobSkillEffects[SK[name]], name).toBeDefined();
		}
	});

	it('selects four distinct one-shot charm effects from server status IDs', () => {
		for (const [status, color] of [['FIRE_CHARM_POWER', 'fire'], ['WATER_CHARM_POWER', 'ice'], ['WIND_CHARM_POWER', 'wind'], ['GROUND_CHARM_POWER', 'earth']]) {
			const layers = fourthJobRenderEffects[fourthJobStatusEffects[StatusConst[status]]];
			expect(layers).toHaveLength(2);
			expect(layers.every(layer => layer.file.includes(`four_charm_${color}`) && layer.repeat === false)).toBe(true);
			expect(layers.map(layer => layer.renderBeforeEntities)).toEqual([false, true]);
		}
	});

	it('preserves high-value visual semantics for status, projectile, and summon samples', () => {
		const mysteryStatus = fourthJobRenderEffects[fourthJobStatusEffects[StatusConst.MYSTERY_POWDER]];
		expect(mysteryStatus).toHaveLength(2);
		expect(mysteryStatus.every(layer => layer.attachedEntity && layer.repeat)).toBe(true);
		expect(mysteryStatus.map(layer => layer.renderBeforeEntities)).toEqual([false, true]);
		expect(StatusConst.MAX).toBeGreaterThan(StatusConst.MYSTERY_POWDER);

		// Servant weapon count notifications own the orbiting weapons.
		expect(fourthJobStatusEffects[StatusConst.SERVANTWEAPON]).toBeUndefined();
		const servantCast = fourthJobRenderEffects[fourthJobSkillEffects[SK.DK_SERVANTWEAPON].successEffectId];
		expect(servantCast.every(layer => layer.attachedEntity && !layer.repeat)).toBe(true);

		const servantShot = fourthJobRenderEffects[fourthJobSkillEffects[SK.DK_SERVANTWEAPON_ATK].beforeHitEffectId];
		expect(servantShot).toHaveLength(2);
		expect(servantShot.every(layer => layer.travelsFromOther)).toBe(true);

		const summon = fourthJobSkillEffects[SK.MT_SUMMON_ABR_BATTLE_WARIOR];
		expect(fourthJobRenderEffects[summon.beginCastEffectId]).toHaveLength(1);
		expect(fourthJobRenderEffects[summon.effectId]).toHaveLength(2);
	});
});
