import { afterEach, expect, it } from 'vitest';
import Configs from '../../src/Core/Configs';
import { dateParts, formatDateTime } from '../../src/Utils/DateTime';

afterEach(() => Configs.set('timeZone', 'Asia/Shanghai'));
it('uses Beijing by default and handles UTC date rollover', () => {
  expect(formatDateTime(Date.parse('2026-10-22T16:00:00Z'))).toBe('2026-10-23 00:00:00');
  expect(dateParts(Date.parse('2026-12-31T20:00:00Z'))).toMatchObject({ year: '2027', month: '01', day: '01' });
});
it('honors runtime configuration and DST rather than device timezone', () => {
  Configs.set('timeZone', 'America/New_York');
  expect(formatDateTime(Date.parse('2026-03-08T06:59:59Z'))).toBe('2026-03-08 01:59:59');
  expect(formatDateTime(Date.parse('2026-03-08T07:00:00Z'))).toBe('2026-03-08 03:00:00');
  Configs.set('timeZone', 'UTC');
  expect(formatDateTime(0)).toBe('1970-01-01 00:00:00');
});
