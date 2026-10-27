import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	listNavigationMaps,
 listSharedMaps,
	listNavigationRows,
	searchNavigationMaps,
	searchNavigationRows
} from '../../src/DB/Navigation/NavigationData.js';
import { localizeNavigationNpcName } from '../../src/DB/Navigation/NavigationNameLocalization.js';

const localizers = {
	npc: name => ({ Kafra: '卡普拉职员' })[name] || name,
	npcAliases: name => (name === '카프라' ? ['Kafra'] : []),
	mob: (id, fallback) => ({ 1002: '波利' })[id] || fallback,
	map: map => ({ prontera: '普隆德拉' })[map] || map
};

const instanceNames = {
	'prontera:146:89': { name: '卡普拉员工', sourceName: 'Kafra Employee' }
};
const withInstances = (options = {}) => ({ ...options, instanceNames });

const mapEntry = (map, name) => ({ map, name, supported: true });
const novicePrtFild08 = ['prt_fild08', 'prt_fild08a', 'prt_fild08b', 'prt_fild08c', 'prt_fild08d'].map(id =>
	mapEntry(id, '普隆德拉南门')
);

describe('navigation data', () => {
	it('searches and displays localized NPC names', () => {
		const rows = [['prontera', 10, 100, 4, 'Kafra', '', 146, 89]];
		const results = searchNavigationRows(rows, [], '卡普拉', 'NPC', localizers, withInstances());

		expect(results).toEqual([
			{
				type: 'NPC',
				id: 10,
				npcClass: 4,
				name: '卡普拉员工',
				mapName: 'prontera',
				mapDisplayName: '普隆德拉',
				x: 146,
				y: 89
			}
		]);
	});

	it('supports a single-character localized search', () => {
		const rows = [['prontera', 10, 100, 4, 'Kafra', '', 146, 89]];

		expect(searchNavigationRows(rows, [], '卡', 'NPC', localizers, withInstances())).toHaveLength(1);
	});

	it('lists the complete NPC catalog with searchable source metadata', () => {
		const rows = [['prontera', 10, 100, 4, 'Kafra', '', 146, 89]];

		expect(listNavigationRows(rows, [], 'NPC', localizers, withInstances())[0]).toMatchObject({
			name: '卡普拉员工',
			rawName: 'Kafra',
			aliases: ['Kafra Employee']
		});
	});

	it('keeps resource names searchable and unpacks monster ids', () => {
		const packedMobId = (12 << 16) | 1002;
		const rows = [['prontera', 20, 300, packedMobId, 'PORING', 'PORING', 1, 0]];
		const results = searchNavigationRows([], rows, 'poring', 'MOB', localizers);

		expect(results[0]).toMatchObject({
			id: 1002,
			name: '波利',
			mapDisplayName: '普隆德拉',
			x: null,
			y: null
		});
	});

	it('matches navigation-only NPC aliases', () => {
		const rows = [['prontera', 10, 100, 4, '카프라', '', 146, 89]];

		expect(searchNavigationRows(rows, [], 'Kafra', 'NPC', localizers)).toHaveLength(1);
	});

	it('matches monster sprite names', () => {
		const rows = [['prontera', 20, 300, 1002, '포링', 'PORING', 1, 0]];

		expect(searchNavigationRows([], rows, 'PORING', 'MOB', localizers)).toHaveLength(1);
	});

	it('searches maps only by displayed name without duplicates', () => {
		const entries = [
			mapEntry('prontera', '普隆德拉'),
			mapEntry('prt_fild08', '普隆德拉原野 08'),
			mapEntry('prt_maze01', '普隆德拉迷宫 1F'),
			{ map: 'prt_unsupported', name: '普隆德拉未支持', supported: false }
		];

		const localizedResults = searchNavigationMaps(entries, '普隆德拉', 'MAP');
		expect(localizedResults).toHaveLength(3);
		expect(localizedResults[0]).toMatchObject({ id: 'prontera', name: '普隆德拉' });
		expect(searchNavigationMaps(entries, '普隆德拉原野 08', 'MAP')[0]).toMatchObject({
			type: 'MAP',
			mapName: 'prt_fild08',
			name: '普隆德拉原野 08',
			x: null,
			y: null
		});
		expect(searchNavigationMaps(entries, '普隆德拉', 'NPC')).toEqual([]);
	});

	it('lists all maps without requiring a search term', () => {
		const maps = listNavigationMaps([{ maps: [{ id: 'prontera', name: '普隆德拉' }] }], {}, 'MAP', id => id);
		expect(maps).toEqual([expect.objectContaining({ id: 'prontera', name: '普隆德拉' })]);
	});

	it('ignores navigation maps without matching client and server resources', () => {
		const maps = listNavigationMaps([], {}, 'MAP', id => id, {}, [
			['jor_tail', '冰冻尾巴', 5001, 100, 100]
		]);

		expect(maps).toEqual([]);
		expect(
			listNavigationRows([['jor_tail', 10, 100, 4, 'Kafra', '', 146, 89]], [], 'NPC', localizers, withInstances())
		).toEqual([]);
	});

	it('hides novice map channel replicas by default', () => {
		const results = searchNavigationMaps(novicePrtFild08, '普隆德拉南门', 'MAP');

		expect(results).toEqual([
			expect.objectContaining({ id: 'prt_fild08', name: '普隆德拉南门' })
		]);
	});

	it('labels every novice map channel when channels are enabled', () => {
		const results = searchNavigationMaps(novicePrtFild08, '普隆德拉南门', 'MAP', {
			channelsEnabled: true
		});

		expect(results.map(result => [result.id, result.name])).toEqual([
			['prt_fild08', '普隆德拉南门 · 频道 1'],
			['prt_fild08a', '普隆德拉南门 · 频道 2'],
			['prt_fild08b', '普隆德拉南门 · 频道 3'],
			['prt_fild08c', '普隆德拉南门 · 频道 4'],
			['prt_fild08d', '普隆德拉南门 · 频道 5']
		]);
	});

	it('filters and labels NPC results using the same channel policy', () => {
		const rows = [
			['izlude', 10, 100, 4, 'Kafra', '', 146, 89],
			['izlude_a', 11, 101, 4, 'Kafra', '', 146, 89]
		];
		const channelLocalizers = { ...localizers, map: () => '伊斯鲁得' };

		expect(searchNavigationRows(rows, [], '卡普拉', 'NPC', channelLocalizers)).toHaveLength(1);
		expect(
			searchNavigationRows(rows, [], '卡普拉', 'NPC', channelLocalizers, { channelsEnabled: true })
		).toEqual([
			expect.objectContaining({ mapName: 'izlude', mapDisplayName: '伊斯鲁得 · 频道 1' }),
			expect.objectContaining({ mapName: 'izlude_a', mapDisplayName: '伊斯鲁得 · 频道 2' })
		]);
	});

	it('filters all navigation result types to the current map', () => {
		const npcRows = [
			['prontera', 10, 100, 4, 'Kafra', '', 146, 89],
			['izlude', 11, 101, 4, 'Kafra', '', 120, 80]
		];
		const results = searchNavigationRows(npcRows, [], '卡普拉', 'NPC', localizers, {
			currentMap: 'prontera',
			scope: 'CURRENT'
		});

		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({ mapName: 'prontera', npcClass: 4 });
	});

	it('ranks current-map NPCs before remote matches', () => {
		const npcRows = [
			['izlude', 11, 101, 4, 'Kafra', '', 120, 80],
			['prontera', 10, 100, 4, 'Kafra', '', 146, 89]
		];
		const results = searchNavigationRows(npcRows, [], '卡普拉', 'NPC', localizers, {
			currentMap: 'prontera'
		});

		expect(results.map(result => result.mapName)).toEqual(['prontera', 'izlude']);
	});

	it('does not translate Korean terms embedded in unrelated NPC names', () => {
		expect(localizeNavigationNpcName('드워프 대장장이')).toBe('드워프 대장장이');
		expect(localizeNavigationNpcName('카프라 워프')).toBe('卡普拉 传送员');
		expect(localizeNavigationNpcName('카프라 이동 서비스')).toBe('卡普拉 传送服务');
		expect(localizeNavigationNpcName('카프라 이동 서비스 직원')).toBe('卡普拉 传送服务职员');
		expect(localizeNavigationNpcName('카프라 미스티')).toBe('卡普拉 米斯蒂');
	});
});

it('excludes old names while preserving channel filtering', () => {
 const entries = [
  {map:'prontera',name:'普隆德拉',supported:true,aliases:['卢恩·米德加兹王国 首都普隆德拉']},
  {map:'prt_fild08',name:'普隆德拉南门',supported:true,aliases:['南门','普隆德拉野外']},
  {map:'prt_fild08a',name:'普隆德拉南门',supported:true,aliases:['南门','普隆德拉野外']},
  {map:'gate',name:'南门训练区',supported:true,aliases:[]}
 ];
 expect(searchNavigationMaps(entries,'首都','MAP').map(row=>row.name)).toEqual([]);
 expect(searchNavigationMaps(entries,'南门','MAP').map(row=>row.id)).toEqual(['gate','prt_fild08']);
 expect(searchNavigationMaps(entries,'普隆德拉野外','MAP',{channelsEnabled:true}).map(row=>row.id)).toEqual([]);
});

it('excludes resource-only maps from player navigation even for exact/current-map searches', () => {
 const entries=[{map:'new_event',name:'new_event',supported:true,player_hidden:true},{map:'pprontera',name:'pprontera',supported:true,player_hidden:true},{map:'alde_gld',name:'艾尔帕兰 露依纳',aliases:['艾尔帕兰卫星都市 露依纳'],supported:true,player_hidden:false}];
 expect(listSharedMaps(entries).map(row=>row.mapName)).toEqual(['alde_gld']);
 for(const map of ['new_event','pprontera']) expect(searchNavigationMaps(entries,map,'MAP',{scope:'CURRENT',currentMap:map})).toEqual([]);
 expect(searchNavigationMaps(entries,'艾尔帕兰','MAP')[0].name).toBe('艾尔帕兰 露依纳');
});

it('matches only visible map names when a former city alias exists',()=>{
 const entries=[{map:'alde_gld',name:'艾尔帕兰 露依纳',supported:true},{map:'aldeg_cas01',name:'娜易修潘斯塔引',supported:true,aliases:['露依纳 公会 01 (艾尔帕兰)']}];
 expect(searchNavigationMaps(entries,'艾尔帕兰','MAP').map(row=>row.id)).toEqual(['alde_gld']);
 expect(searchNavigationMaps(entries,' ALDE_GLD ','MAP').map(row=>row.id)).toEqual(['alde_gld']);
 expect(searchNavigationMaps(entries,'卫星都市','MAP')).toEqual([]);
});

it('hides non-gameplay maps in the shipped catalog without hiding playable maps', () => {
 const { entries } = JSON.parse(readFileSync('applications/pwa/data/navigation/map-catalog.json', 'utf8'));
 for (const channelsEnabled of [false, true]) {
  const visible = listSharedMaps(entries, { channelsEnabled }).map(row => row.mapName);
  for (const map of ['alde_tt02', 'ordeal_a00', 'ordeal_a02', 'job_sword1', 'quiz_01', 'que_job02', 'que_job03']) {
   expect(visible).not.toContain(map);
   const entry = entries.find(row => row.map === map);
   expect(entry.supported).toBe(true);
   expect(searchNavigationMaps(entries, entry.name, 'MAP', { channelsEnabled }).some(row => row.mapName === map)).toBe(false);
  }
  for (const map of ['turbo_n_1', 'ordeal_1-1', 'ordeal_1-2', 'airport', 'lhz_airport', 'y_airport']) {
   expect(visible).toContain(map);
  }
  for (let i = 1; i <= 4; i++) {
   expect(visible).not.toContain(`new_zone0${i}`);
   expect(visible).toContain(`new_1-${i}`);
   expect(visible.includes(`new_2-${i}`)).toBe(channelsEnabled);
  }
  expect(searchNavigationMaps(entries, '初心者修炼场', 'MAP', { channelsEnabled }).some(row => /^new_zone0[1-4]$/.test(row.mapName))).toBe(false);
 }
});

 it('ranks exact map codes before prefixes and substrings without revealing hidden maps', () => {
  const entries = [
   {map:'x_town',name:'甲',supported:true},
   {map:'town_more',name:'乙',supported:true},
   {map:'town',name:'丙',supported:true},
   {map:'town_hidden',name:'丁',supported:true,player_hidden:true}
  ];
  expect(searchNavigationMaps(entries,' TOWN ','MAP').map(row=>row.id)).toEqual(['town','town_more','x_town']);
 });
