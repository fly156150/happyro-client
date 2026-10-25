// Names verified against localization/maps/display-names.json in the root repository.
import { describe, expect, it } from 'vitest';
import MapInfo from '../../src/DB/Map/MapTable.js';
import {
	ADVENTURE_ACHIEVEMENT_MAPS,
	localizeAdventureAchievementMaps
} from '../../src/DB/Achievement/AdventureAchievementLocalization.js';

describe('adventure achievement map localization', () => {
	it('maps every exploration achievement to a known client map', () => {
		expect(ADVENTURE_ACHIEVEMENT_MAPS).toHaveLength(146);
		ADVENTURE_ACHIEVEMENT_MAPS.forEach(map => expect(MapInfo[map]?.displayName).toBeTruthy());
	});

	it('uses exact map names and disambiguates repeated display names', () => {
		const achievements = {};
		for (let id = 120001; id <= 120146; id++) {
			achievements[id] = {
				title: '旧名称',
				content: {},
				resource: [{ text: '旧目标' }]
			};
		}
		achievements[129001] = {
			resource: {
				1: { shortcut: 120001, text: '旧汇总目标' }
			}
		};

		localizeAdventureAchievementMaps(achievements, MapInfo);

		expect(achievements[120001].title).toBe('探索普隆德拉北门');
		expect(achievements[120003].title).toBe('探索普隆德拉东北遗迹');
		expect(achievements[120007].title).toBe('探索蝗虫区');
		expect(achievements[120011].title).toBe('探索吉芬野外 00');
		expect(achievements[120012].title).toBe('探索吉芬野外 01');
		expect(achievements[120001].content.details).toBe('发现普隆德拉北门的宝藏');
		expect(achievements[129001].resource[1].text).toBe('完成探索普隆德拉北门');
	});
});
