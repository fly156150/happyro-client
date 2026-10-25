import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const data = vi.hoisted(() => ({ items: [{ id:501, hp:true, count:3 }, { id:505, sp:true, count:2 }] }));
import { createRecoveryPanel } from '../../src/UI/Game/RecoveryPanel.js';
import { defaultRecoverySettings } from '../../src/UI/Game/RecoverySettings.js';
import { publishRecoveryStatus } from '../../src/UI/Game/RecoveryStatus.js';
let body, editor, actions, state;
beforeEach(() => {
 vi.spyOn(HTMLDialogElement.prototype,'showModal').mockImplementation(function(){this.open=true;});
 vi.spyOn(HTMLDialogElement.prototype,'close').mockImplementation(function(){this.open=false;});
 body = document.createElement('div'); document.body.append(body);
 state = { species: [], skills: [], ranges: {search:20,activity:30}, teleport:{enabled:false,waitSeconds:2,intervalSeconds:2}, recovery: defaultRecoverySettings() };
 actions = { loadRecoveryItemIcon: vi.fn(async () => 'blob:recovery-item'), recoveryItems: () => data.items, recoveryItemName: id => ({501: "红色药水",505:"蓝色药水"})[id],snapshot: () => structuredClone(state), configure: vi.fn((species, skills, ranges, teleport, recovery) => { state = structuredClone({species,skills,ranges,teleport,recovery}); return true; })};
 editor = createRecoveryPanel(body,actions);
});
afterEach(() => { editor.destroy(); body.remove(); publishRecoveryStatus(''); vi.restoreAllMocks(); });
it('saves independent thresholds and switches without starting combat', () => {
 body.querySelector('[aria-label="HP 恢复"]').click(); expect(state.recovery.hp.enabled).toBe(true); expect(state.recovery.sp.enabled).toBe(false);
 const input = body.querySelector('[aria-label="HP 低于百分比"]'); input.value = '55'; input.dispatchEvent(new Event('change')); expect(state.recovery.hp.trigger).toBe(55);
});
it('uses a modal with item icons and confirms selection before saving', async () => {
 body.querySelector('.recovery-select').click();
 await vi.waitFor(()=>expect(body.querySelector('.pickup-results input')).not.toBeNull());
 expect(body.querySelector('dialog').open).toBe(true);
 expect(body.querySelector('.pickup-results').textContent).toContain('红色药水');
 expect(body.querySelector('.pickup-results').textContent).not.toContain('蓝色药水');
 const checkbox=body.querySelector('[data-item-id="501"]');checkbox.checked=true;checkbox.dispatchEvent(new Event('change'));
 expect(state.recovery.hp.items).toEqual([]);
 body.querySelector('[data-confirm]').click(); expect(state.recovery.hp.items).toEqual([501]);
 expect(body.querySelector('dialog')).toBeNull();
 expect(body.querySelector('.recovery-items .pickup-item-icon')).not.toBeNull();
 [...body.querySelectorAll('.recovery-items button')].find(node => node.textContent === '移除').click(); expect(state.recovery.hp.items).toEqual([]);
});
it('cancels pending item selection without changing saved settings', async () => {
 body.querySelector('.recovery-select').click();
 await vi.waitFor(()=>expect(body.querySelector('[data-item-id="501"]')).not.toBeNull());
 const checkbox=body.querySelector('[data-item-id="501"]');checkbox.checked=true;checkbox.dispatchEvent(new Event('change'));
 body.querySelector('[data-cancel]').click();expect(state.recovery.hp.items).toEqual([]);expect(actions.configure).not.toHaveBeenCalled();
});
it('preserves concurrent battle settings and displays recovery status without saving it', () => {
 state.skills = [19]; body.querySelector('[aria-label="SP 恢复"]').click(); expect(state.skills).toEqual([19]);
 publishRecoveryStatus('道具暂时无法使用'); expect(body.querySelector('.recovery-runtime-status').textContent).toBe('道具暂时无法使用');
 expect(state.recovery.status).toBeUndefined();
});
it('shows persistence failure and allows retry', async () => {
 actions.configure.mockReturnValueOnce(false); body.querySelector('[aria-label="SP 恢复"]').click();
 await Promise.resolve(); expect(body.querySelector('.recovery-status').hidden).toBe(false);
 [...body.querySelectorAll('button')].find(node => node.textContent === '重试').click(); expect(body.querySelector('.recovery-status').hidden).toBe(true);
});

it('reorders existing item rows without resetting scroll or images, then removes the correct item', () => {
 editor.destroy();
 state.recovery.hp.items = [501, 502, 503, 504];
 editor = createRecoveryPanel(body, actions);
 const list = body.querySelector('.recovery-items');
 const rows = [...list.children], images = [...list.querySelectorAll('img')];
 list.scrollTop = 80;
 const up = rows[2].querySelector('[data-move="up"]');
 up.focus(); up.click();
 expect(state.recovery.hp.items).toEqual([501, 503, 502, 504]);
 expect([...list.children]).toEqual([rows[0], rows[2], rows[1], rows[3]]);
 expect(list.scrollTop).toBe(80);
 expect(document.activeElement).toBe(up);
 expect(rows[2].querySelector('img')).toBe(images[2]);
 up.click();
 expect(state.recovery.hp.items).toEqual([503, 501, 502, 504]);
 expect(up.disabled).toBe(true);
 rows[2].querySelector('[data-move="down"]').click();
 expect(state.recovery.hp.items).toEqual([501, 503, 502, 504]);
 [...rows[2].querySelectorAll('button')].find(node => node.textContent === '移除').click();
 expect(state.recovery.hp.items).toEqual([501, 502, 504]);
 expect(list.lastElementChild.querySelector('[data-move="down"]').disabled).toBe(true);
});

it('clamps recovery thresholds and restores empty number inputs', () => {
 const trigger = body.querySelector('[aria-label="HP 低于百分比"]');
 const target = body.querySelector('[aria-label="HP 恢复至百分比"]');
 trigger.value = '99'; trigger.dispatchEvent(new Event('change'));
 expect(state.recovery.hp.trigger).toBe(79);
 target.value = '10'; target.dispatchEvent(new Event('change'));
 expect(state.recovery.hp.target).toBe(80);
 trigger.value = ''; trigger.dispatchEvent(new Event('change'));
 expect(trigger.value).toBe('79');
 target.value = '100'; target.dispatchEvent(new Event('change'));
 expect(state.recovery.hp.target).toBe(100);
});

it('commits numeric edits on blur even when the browser has not fired change', () => {
 const input = body.querySelector('[aria-label="HP 低于百分比"]');
 input.value = '45'; input.dispatchEvent(new Event('blur'));
 expect(state.recovery.hp.trigger).toBe(45);
 expect(input.value).toBe('45');
 const calls = actions.configure.mock.calls.length;
 input.dispatchEvent(new Event('change'));
 expect(actions.configure).toHaveBeenCalledTimes(calls);
});

it('steps both percentages by five and disables controls at valid bounds', () => {
 const up = body.querySelector('[aria-label="增大HP低于比例"]');
 up.click(); expect(state.recovery.hp.trigger).toBe(55);
 body.querySelector('[aria-label="减小HP恢复至比例"]').click();
 expect(state.recovery.hp.target).toBe(75);
 for(let i=0;i<4;i++) up.click();
 expect(state.recovery.hp.trigger).toBe(70); expect(up.disabled).toBe(true);
 const down = body.querySelector('[aria-label="减小HP恢复至比例"]');
 expect(down.disabled).toBe(true);
 body.querySelector('[aria-label="增大HP恢复至比例"]').click();
 expect(state.recovery.hp.target).toBe(80); expect(up.disabled).toBe(false);
});

it('moves to adjacent five-percent ticks after arbitrary numeric edits', () => {
 const input = body.querySelector('[aria-label="HP 低于百分比"]');
 const plus = body.querySelector('[aria-label="增大HP低于比例"]');
 const minus = body.querySelector('[aria-label="减小HP低于比例"]');
 const set = value => { input.value=String(value); input.dispatchEvent(new Event('change')); };
 set(1); plus.click(); expect(state.recovery.hp.trigger).toBe(5);
 plus.click(); expect(state.recovery.hp.trigger).toBe(10);
 set(7); plus.click(); expect(state.recovery.hp.trigger).toBe(10);
 set(7); minus.click(); expect(state.recovery.hp.trigger).toBe(5);
 minus.click(); expect(state.recovery.hp.trigger).toBe(5); expect(minus.disabled).toBe(true);
 const target=body.querySelector('[aria-label="HP 恢复至百分比"]');
 target.value='87';target.dispatchEvent(new Event('change'));
 body.querySelector('[aria-label="增大HP恢复至比例"]').click();expect(state.recovery.hp.target).toBe(90);
 target.value='87';target.dispatchEvent(new Event('change'));
 body.querySelector('[aria-label="减小HP恢复至比例"]').click();expect(state.recovery.hp.target).toBe(85);
});

it('disables a step instead of clamping it to a non-multiple boundary', () => {
 const trigger = body.querySelector('[aria-label="HP 低于百分比"]');
 const target = body.querySelector('[aria-label="HP 恢复至百分比"]');
 trigger.value='76';trigger.dispatchEvent(new Event('change'));
 const up=body.querySelector('[aria-label="增大HP低于比例"]');
 expect(up.disabled).toBe(true);up.click();expect(state.recovery.hp.trigger).toBe(76);
 const down=body.querySelector('[aria-label="减小HP恢复至比例"]');
 expect(down.disabled).toBe(true);down.click();expect(state.recovery.hp.target).toBe(80);
 target.value='87';target.dispatchEvent(new Event('change'));
 expect(up.disabled).toBe(false);up.click();expect(state.recovery.hp.trigger).toBe(80);
});

it('pages recovery items by ten and retains selection across the last page', async () => {
 actions.recoveryItems = () => Array.from({length:11}, (_,i) => ({id:501+i,hp:true,count:1}));
 actions.recoveryItemName = id => `道具 ${id}`;
 editor.destroy(); editor = createRecoveryPanel(body, actions);
 body.querySelector('.recovery-select').click();
 await vi.waitFor(() => expect(body.querySelectorAll('.pickup-results .pickup-item')).toHaveLength(10));
 expect(body.querySelector('[data-page]').textContent).toBe('1 / 2');
 body.querySelector('[data-item-id="501"]').click();
 body.querySelector('[data-next]').click();
 await vi.waitFor(() => expect(body.querySelector('[data-item-id="511"]')).not.toBeNull());
 expect(body.querySelectorAll('.pickup-results .pickup-item')).toHaveLength(1);
 expect(body.querySelector('[data-next]').disabled).toBe(true);
 body.querySelector('[data-item-id="511"]').click();
 body.querySelector('[data-previous]').click();
 await vi.waitFor(() => expect(body.querySelector('[data-item-id="501"]')?.checked).toBe(true));
 body.querySelector('[data-confirm]').click();
 expect(state.recovery.hp.items).toEqual([501,511]);
});
