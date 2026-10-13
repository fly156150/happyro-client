import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('UI/Components/Toast.js', () => ({ showToast: vi.fn() }));
vi.mock('UI/Components/Confirmation.js', () => ({ requestConfirmation: vi.fn() }));
vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({
 searchAdventureItems: vi.fn(), grantAdventureItem: vi.fn(), grantAdventureZeny: vi.fn(), loadAdventureAsset: vi.fn()
}));
import tab from '../../src/UI/Components/GameTools/ItemCatalogTab.js';
import { searchAdventureItems, grantAdventureItem, grantAdventureZeny } from '../../src/UI/Components/GameTools/AdventureControlService.js';
import { requestConfirmation } from 'UI/Components/Confirmation.js';
import { showToast } from 'UI/Components/Toast.js';
let root, cleanup;
const tick = () => vi.advanceTimersByTimeAsync(0);
const amount = value => { const input=root.querySelector('.item-grant-amount');input.value=value;input.dispatchEvent(new Event('input')); };
const mount = async (mobile=true, allowed=true) => { cleanup=tab.mount(root,{mobile,capabilities:{itemGrantAllowed:allowed}});await tick(); };
beforeEach(() => {
 vi.useFakeTimers(); vi.resetAllMocks();
 requestConfirmation.mockResolvedValue(false);
 searchAdventureItems.mockImplementation(async ({ query }) => ({data: query === 'absent' ? [] : [501,502].map(Id => ({Id,Type:'Healing',AegisName:`Item_${Id}`,grantable:true})),total:query === 'absent' ? 0 : 2}));
 root=document.createElement('div');document.body.append(root);
});
afterEach(() => { cleanup?.();root.remove();vi.useRealTimers(); });
it.each([true,false])('shares a persistent quantity and confirms Zeny on mobile=%s', async mobile => {
 await mount(mobile);amount('1234567890');
 root.querySelectorAll('.catalog-row')[1].click();root.dispatchEvent(new Event('game-tools-reset-feedback'));
 expect(root.querySelector('.item-grant-amount').value).toBe('1234567890');
 const search=root.querySelector('.catalog-search');search.value='absent';search.dispatchEvent(new Event('input'));await vi.advanceTimersByTimeAsync(300);
 expect(root.querySelector('.item-grant').disabled).toBe(true);
 expect(root.querySelector('.zeny-grant-open').closest('.item-grant-panel')).not.toBeNull();
 requestConfirmation.mockResolvedValueOnce(true);root.querySelector('.zeny-grant-open').click();await tick();
 expect(requestConfirmation.mock.calls[0][1]).toContain('1,234,567,890 Zeny');
 expect(grantAdventureZeny).toHaveBeenCalledWith(1234567890);expect(grantAdventureItem).not.toHaveBeenCalled();
 expect(root.querySelector('.item-grant-amount').value).toBe('1234567890');
 search.value='';search.dispatchEvent(new Event('input'));await vi.advanceTimersByTimeAsync(300);
 expect(root.querySelector('.item-grant').disabled).toBe(false);
 expect([...root.querySelector('.item-grant-panel').children].slice(0,3).map(e=>e.className)).toEqual(['item-grant-quantity','zeny-grant-open','item-grant']);
});
it('uses separate limits without clamping or resetting the entered quantity',async()=>{
 await mount();amount('30001');root.querySelector('.item-grant').click();await tick();
 expect(requestConfirmation).not.toHaveBeenCalled();expect(showToast).toHaveBeenCalledWith(root,expect.stringContaining('30000'),'error');
 expect(root.querySelector('.item-grant-amount').value).toBe('30001');
 root.querySelector('.zeny-grant-open').click();await tick();expect(requestConfirmation).toHaveBeenCalledOnce();expect(grantAdventureZeny).not.toHaveBeenCalled();
 for(const value of ['','0','-1','1.5','2147483648']){amount(value);root.querySelector('.zeny-grant-open').click();await tick();}
 expect(requestConfirmation).toHaveBeenCalledOnce();
 amount('2147483647');requestConfirmation.mockResolvedValueOnce(true);root.querySelector('.zeny-grant-open').click();await tick();expect(grantAdventureZeny).toHaveBeenCalledWith(2147483647);
});
it('locks both actions through confirmation and request, and sends the confirmed item snapshot',async()=>{
 await mount();amount('30000');let confirm,finish;
 requestConfirmation.mockImplementationOnce(()=>new Promise(resolve=>{confirm=resolve;}));
 grantAdventureItem.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 root.querySelector('.item-grant').click();
 expect(root.querySelector('.zeny-grant-open').disabled).toBe(true);expect(root.querySelector('.item-grant-amount').disabled).toBe(true);
 root.querySelectorAll('.catalog-row')[1].click();root.querySelector('.item-grant').click();
 expect(requestConfirmation).toHaveBeenCalledOnce();confirm(true);await tick();
 expect(grantAdventureItem).toHaveBeenCalledWith(501,30000);expect(root.querySelector('.item-grant').disabled).toBe(true);
 finish();await tick();expect(root.querySelector('.item-grant').disabled).toBe(false);expect(root.querySelector('.item-grant-amount').value).toBe('30000');
});
it('recovers after cancellation and failed Zeny grants',async()=>{
 await mount();amount('100000');root.querySelector('.zeny-grant-open').click();await tick();expect(grantAdventureZeny).not.toHaveBeenCalled();expect(root.querySelector('.zeny-grant-open').disabled).toBe(false);
 requestConfirmation.mockResolvedValueOnce(true);grantAdventureZeny.mockRejectedValueOnce({code:'zeny_amount_exceeded'});root.querySelector('.zeny-grant-open').click();await tick();
 expect(showToast).toHaveBeenCalledWith(root,'发放后会超过角色 Zeny 持有上限','error');expect(root.querySelector('.zeny-grant-open').disabled).toBe(false);expect(root.querySelector('.item-grant-amount').value).toBe('100000');
});
it('does not grant after unmount or without permission',async()=>{
 await mount(false,false);expect(root.querySelector('.zeny-grant-open').disabled).toBe(true);expect(root.querySelector('.item-grant').disabled).toBe(true);
 cleanup();await mount();let confirm;requestConfirmation.mockImplementationOnce(()=>new Promise(resolve=>{confirm=resolve;}));root.querySelector('.zeny-grant-open').click();cleanup();confirm(true);await tick();expect(grantAdventureZeny).not.toHaveBeenCalled();
});
