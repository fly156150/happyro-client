import { describe, expect, it } from 'vitest';
import { getMapChannel, isVisibleMapChannel } from '../../src/DB/Map/MapChannels.js';

describe('novice training channels', () => {
 it('keeps one result per area and preserves the actual channel identity', () => {
  for (let area = 1; area <= 4; area++) {
   const maps = Array.from({length: 5}, (_, i) => `new_${i + 1}-${area}`);
   expect(maps.filter(map => isVisibleMapChannel(map, false))).toEqual([`new_1-${area}`]);
   expect(maps.filter(map => isVisibleMapChannel(map, true))).toEqual(maps);
   expect(getMapChannel(`NEW_5-${area}.gat`)).toEqual({canonicalMapName: `new_1-${area}`, channel: 5});
  }
 });
 it('does not collapse separate job stages or level-restricted arenas', () => {
  for (const map of ['sword_1-1', 'sword_2-1', 'force_1-1', 'force_2-1', 'pvp_y_2-1', 'pvp_y_3-1']) {
   expect(getMapChannel(map)).toBeNull();
   expect(isVisibleMapChannel(map, false)).toBe(true);
  }
 });
});
