import { expect, it } from 'vitest';
import { statusIconProgress } from '../../src/UI/Components/StatusIcons/StatusIconProgress.js';
it('uses the same white phase and final-minute orange phase across displays', () => {
 expect(statusIconProgress(0, 180000, 60000)).toEqual({fraction:.5,color:'rgba(255,255,255,0.65)'});
 expect(statusIconProgress(0, 180000, 120000)).toEqual({fraction:0,color:'rgba(255,150,50,0.65)'});
 expect(statusIconProgress(0, 180000, 150000)).toEqual({fraction:.5,color:'rgba(255,150,50,0.65)'});
 expect(statusIconProgress(0, 60000, 0).fraction).toBe(0);
 expect(statusIconProgress(0, 10000, 0).fraction).toBeCloseTo(5/6);
});
it('handles permanent effects, expiry and refreshed start times', () => {
 expect(statusIconProgress(0, Infinity, 100000)).toBeNull();
 expect(statusIconProgress(0, 10000, 11000).fraction).toBe(1);
 expect(statusIconProgress(60000, 240000, 60000).fraction).toBe(0);
});
