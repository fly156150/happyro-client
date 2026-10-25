import { expect, it } from 'vitest';
import { createPlayerStatuses } from '../../src/Network/PlayerStatuses.js';

it('tracks effects without icon metadata and handles refresh, removal and expiry', () => {
 let time = 0;
 const states = createPlayerStatuses(() => time);
 states.update({index:123456,state:1,RemainMS:1000});
 expect(states.has(123456)).toBe(true);
 time=900; states.update({index:123456,state:1,RemainMS:1000});
 time=1000; expect(states.has(123456)).toBe(true);
 time=1900; expect(states.has(123456)).toBe(false);
 states.update({index:10,state:1,RemainMS:-1});
 time=100000; expect(states.has(10)).toBe(true);
 states.update({index:10,state:0}); expect(states.has(10)).toBe(false);
});
it('accepts duration-only status packets and clears character state', () => {
 const states=createPlayerStatuses();
 states.update({index:12,RemainMS:9999}); expect(states.has(12)).toBe(true);
 states.clear(); expect(states.has(12)).toBe(false);
});
