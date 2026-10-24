import { describe, expect, it } from 'vitest';
import skillNames from '../../src/DB/Skills/SkillLocalizationTable.generated.js';
import statusSkillNames from '../../src/DB/Status/StatusSkillNames.json';
import SC from '../../src/DB/Status/StatusConst.js';
import StatusInfo from '../../src/DB/Status/StatusInfo.js';
import officialStateIconTranslations from '../../src/DB/Status/stateiconinfo.zh-CN.json';
import {
	applyOfficialStateIconTranslations,
	restoreLocalizedStatusDescription,
	snapshotLocalizedStatusDescriptions
} from '../../src/DB/Status/StatusDescriptionLocalization.js';

const hangul = /[\uac00-\ud7a3]/;

describe('status description localization', () => {
	it('uses the Renewal overweight threshold from the official LUB', () => {
		expect(officialStateIconTranslations['35'].descript[0][0]).toBe('负重达到 70%');
	});
	it('contains Chinese descriptions for the novice spawn buffs', () => {
		expect(StatusInfo[SC.BLESSING].descript[0][0]).toBe('天使之赐福');
		expect(StatusInfo[SC.INC_AGI].descript[0][0]).toBe('敏捷提升');
	});

	it('covers every official stateiconinfo.lub description with Chinese after restore', () => {
		expect(Object.keys(officialStateIconTranslations).length).toBe(720);
		expect(officialStateIconTranslations['720'].descript[0][0]).toBe('全力推进');

		const statusInfo = {};
		for (const id of Object.keys(officialStateIconTranslations)) {
			statusInfo[id] = { descript: [['풀 스로틀'], ['All State 증가']] };
		}

		const descriptions = snapshotLocalizedStatusDescriptions(statusInfo, officialStateIconTranslations);

		for (const id of Object.keys(officialStateIconTranslations)) {
			statusInfo[id].descript = [['풀 스로틀'], ['이동속도 증가']];
			expect(restoreLocalizedStatusDescription(statusInfo, descriptions, Number(id))).toBe(true);
			const expected = officialStateIconTranslations[id].descript.map(line => [...line]);
            const binding = statusSkillNames[id];
            if (binding) expected[0][0] = `${binding.prefix || ''}${skillNames[binding.skillId].name}${binding.suffix || ''}`;
            expect(statusInfo[id].descript).toEqual(expected);
			for (const line of statusInfo[id].descript) {
				expect(hangul.test(String(line[0] ?? '')), `SC ${id} still has Hangul`).toBe(false);
			}
		}
	});

	it('applies the extracted Chinese overlay onto StatusInfo before Lua restore', () => {
		const statusInfo = { 720: { icon: 'full_throttle.tga' } };
		applyOfficialStateIconTranslations(statusInfo, officialStateIconTranslations);
		expect(statusInfo[720].descript[0][0]).toBe('全力推进');
		expect(StatusInfo[SC.FULL_THROTTLE].descript[0][0]).toBe('全力推进');
	});

	it('copies haveTimeLimit 0 from the official overlay instead of leaving a timed flag', () => {
		const statusInfo = { 132: { haveTimeLimit: 1, posTimeLimitStr: 2 } };
		applyOfficialStateIconTranslations(statusInfo, officialStateIconTranslations);
		expect(statusInfo[132].haveTimeLimit).toBe(0);
		expect(statusInfo[132].posTimeLimitStr).toBe(0);
		expect(officialStateIconTranslations['132'].haveTimeLimit).toBe(0);
	});

	it('restores localized descriptions after official status metadata loads', () => {
		const statusInfo = {
			10: { descript: [['中文名称', '#fff'], ['中文说明']] },
			99: {}
		};
		const descriptions = snapshotLocalizedStatusDescriptions(statusInfo, {});

		statusInfo[10].descript = [['한국어']];
		expect(restoreLocalizedStatusDescription(statusInfo, descriptions, 10)).toBe(true);
		expect(statusInfo[10].descript).toEqual([['中文名称', '#fff'], ['中文说明']]);

		expect(restoreLocalizedStatusDescription(statusInfo, descriptions, 99)).toBe(false);
		expect(statusInfo[99].descript).toEqual([]);
	});
});

it('keeps reviewed skill titles consistent without renaming independent ailments', () => {
 expect(skillNames[34].name).toBe('天使之赐福');
 expect(StatusInfo[SC.BLESSING].descript[0][0]).toBe(skillNames[34].name);
 expect(StatusInfo[SC.ANGELUS].descript[0][0]).toBe(skillNames[33].name);
 expect(StatusInfo[SC.KYRIE].descript[0][0]).toBe(skillNames[73].name);
 expect(skillNames[8].name).toBe('钢铁之心');
 expect(StatusInfo[SC.ENDURE].descript[0][0]).toBe('霸体');
 for (const id of [50, 737, 1142, 1210, 1211, 1212]) {
  expect(StatusInfo[id].descript).toEqual(officialStateIconTranslations[id].descript);
 }
 for (const [id, entry] of Object.entries(statusSkillNames)) {
  expect(skillNames[entry.skillId], `unknown source skill for ${id}`).toBeDefined();
  expect(officialStateIconTranslations[id]?.descript[0][0]).not.toBe('%s');
 }
});

it('keeps skill-derived titles and countdown rows distinct', () => {
 expect(StatusInfo[SC.SOULCOLLECT].descript[0][0]).toBe('灵魂收集');
 const benedictio = StatusInfo[SC.BENEDICTIO];
 expect(benedictio.descript[0][0]).toBe('圣体降福');
 expect(benedictio.descript[benedictio.posTimeLimitStr - 1][0]).toBe('%s');
 expect(StatusInfo[SC.RG_CCONFINE_M].descript[0][0]).toBe('近身禁锢（施法者）');
 expect(StatusInfo[SC.RG_CCONFINE_S].descript[0][0]).toBe('近身禁锢（目标）');
 expect(skillNames[2279].name).toBe('强力挥击');
 expect(skillNames[6507].name).toBe('爆发横扫');
});
