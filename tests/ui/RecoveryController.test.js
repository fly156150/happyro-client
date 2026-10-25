import { beforeEach, expect, it, vi } from 'vitest';
import { createRecoveryController } from '../../src/UI/Game/RecoveryController.js';
import { defaultRecoverySettings, validRecoverySettings } from '../../src/UI/Game/RecoverySettings.js';
let now, life, stock, settings, controller, use, result, allowed;
beforeEach(() => {
 now = 0; life = { hp: 40, hp_max: 100, sp: 10, sp_max: 100 }; allowed = true;
 stock = [{id: 501, count: 3, hp: true}, {id: 505, count: 3, sp: true}];
 settings = defaultRecoverySettings(); settings.hp.enabled = settings.sp.enabled = true;
 settings.hp.items = [501]; settings.sp.items = [505];
 use = vi.fn((item, callback) => { result = callback; return true; });
 controller = createRecoveryController({ now: () => now, life: () => life, items: () => stock, allowed: () => allowed, busy: () => false, use });
});
it('prioritizes HP and stops at the upper threshold without repeatedly triggering', () => {
 controller.tick(settings, true); expect(use.mock.calls[0][0].id).toBe(501);
 life.hp = 60; result('success'); now = 800; controller.tick(settings, true); expect(use).toHaveBeenCalledTimes(2);
 life.hp = 80; result('success'); now = 1600; controller.tick(settings, true); expect(use.mock.calls[2][0].id).toBe(505);
 life.sp = 50; result('success'); life.hp = 60; now = 2400; controller.tick(settings, true); expect(use).toHaveBeenCalledTimes(3);
});
it('does not duplicate pending use and respects feedback settlement', () => {
 controller.tick(settings, true); controller.tick(settings, true); expect(use).toHaveBeenCalledOnce();
 result('success'); now = 799; controller.tick(settings, true); expect(use).toHaveBeenCalledOnce();
});
it('reevaluates both stats after a combined recovery item', () => {
 stock = [{id: 500, hp: true, sp: true, count: 1}]; settings.hp.items = settings.sp.items = [500];
 controller.tick(settings, true); life.hp = life.sp = 100; result('success'); now = 800;
 controller.tick(settings, true); expect(use).toHaveBeenCalledOnce();
});
it('tries the next approved item after failure without waiting forever on HP', () => {
 stock.push({id: 502, hp: true, count: 1}); settings.hp.items.push(502);
 controller.tick(settings, true); result('failed'); now = 800; controller.tick(settings, true);
 expect(use.mock.calls[1][0].id).toBe(502);
});
it('allows SP recovery when HP recovery items is empty', () => {
 stock[0].count = 0; controller.tick(settings, true); expect(use.mock.calls[0][0].id).toBe(505);
});
it('does not consume unselected or quarantined items', () => {
 stock[0].available = false; settings.sp.enabled = false; stock.push({id: 502, hp: true, count: 5});
 controller.tick(settings, true); expect(use).not.toHaveBeenCalled();
});
it('does not infer failure from unchanged HP, or retry an ambiguous outstanding request', () => {
 controller.tick(settings, true); now = 5000; controller.tick(settings, true);
 expect(use).toHaveBeenCalledOnce(); expect(controller.snapshot().status).toContain('未确认');
});
it('ignores old callbacks after stopping and restarting', () => {
 controller.tick(settings, true); const old = result; controller.tick(settings, false);
 controller.tick(settings, true); old('failed'); expect(controller.snapshot().pending).toBe(true);
});
it('does not send during disallowed states or invalid life values', () => {
 allowed = false; controller.tick(settings, true); expect(use).not.toHaveBeenCalled();
 allowed = true; life.hp_max = life.sp_max = -1; controller.tick(settings, true); expect(use).not.toHaveBeenCalled();
});
it('validates bounded hysteresis and unique approved item lists', () => {
 expect(validRecoverySettings(settings)).toBe(true);
 settings.hp.target = settings.hp.trigger; expect(validRecoverySettings(settings)).toBe(false);
 settings.hp.target = 75; settings.hp.items = [501,501]; expect(validRecoverySettings(settings)).toBe(false);
});
