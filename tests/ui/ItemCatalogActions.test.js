import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('UI/Components/Toast.js', () => ({ showToast: vi.fn() }));
vi.mock('UI/Components/Confirmation.js', () => ({ requestConfirmation: vi.fn(async () => false) }));
vi.mock('../../src/UI/Components/GameTools/GameToolsNumberPrompt.js', () => ({ requestGameToolsNumber: vi.fn(async () => null) }));
vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({
 searchAdventureItems: vi.fn(), grantAdventureItem: vi.fn(), grantAdventureZeny: vi.fn(), loadAdventureAsset: vi.fn()
}));
import tab from '../../src/UI/Components/GameTools/ItemCatalogTab.js';
import { searchAdventureItems, grantAdventureZeny } from '../../src/UI/Components/GameTools/AdventureControlService.js';
import { requestGameToolsNumber } from '../../src/UI/Components/GameTools/GameToolsNumberPrompt.js';
let root, cleanup;
beforeEach(() => {
 vi.useFakeTimers(); vi.clearAllMocks();
 searchAdventureItems.mockImplementation(async ({ query }) => ({data: query === 'absent' ? [] : [501,502].map(Id => ({Id,Type:'Healing',AegisName:`Item_${Id}`,grantable:true})),total:query === 'absent' ? 0 : 2}));
 root=document.createElement('div');document.body.append(root);
});
afterEach(() => { cleanup?.();root.remove();vi.useRealTimers(); });
it('retains the mobile Zeny action across selection, refresh, and empty searches', async () => {
 cleanup=tab.mount(root,{mobile:true,capabilities:{itemGrantAllowed:true}});await vi.advanceTimersByTimeAsync(0);
 const button=root.querySelector('.zeny-grant-open');
 expect(button.previousElementSibling.matches('.item-grant')).toBe(true);
 root.querySelectorAll('.catalog-row')[1].click();
 root.dispatchEvent(new Event('game-tools-reset-feedback'));
 expect(root.querySelector('.zeny-grant-open')).toBe(button);
 const search=root.querySelector('.catalog-search');search.value='absent';search.dispatchEvent(new Event('input'));await vi.advanceTimersByTimeAsync(300);
 expect(button.closest('.catalog-toolbar')).not.toBeNull();expect(root.querySelector('.item-grant')).toBeNull();
 search.value='';search.dispatchEvent(new Event('input'));await vi.advanceTimersByTimeAsync(300);
 expect(button.previousElementSibling.matches('.item-grant')).toBe(true);
 button.click();await vi.advanceTimersByTimeAsync(0);
 expect(requestGameToolsNumber).toHaveBeenCalledOnce();expect(grantAdventureZeny).not.toHaveBeenCalled();
});
it('keeps the desktop Zeny action in the toolbar and labels the amount accessibly', async () => {
 cleanup=tab.mount(root,{capabilities:{itemGrantAllowed:true}});await vi.advanceTimersByTimeAsync(0);
 expect(root.querySelector('.zeny-grant-open').closest('.catalog-toolbar')).not.toBeNull();
 const amount=root.querySelector('.item-grant-amount');expect(amount.getAttribute('aria-label')).toBe('数量');expect(amount.parentElement.textContent.trim()).toBe('');
});
