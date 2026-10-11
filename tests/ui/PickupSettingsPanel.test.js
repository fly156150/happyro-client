import { afterEach, expect, it, vi } from 'vitest';
vi.mock('UI/Components/GameTools/AdventureControlService.js', () => ({ searchAdventureItems: vi.fn(), loadAdventureAsset: vi.fn() }));
import { loadAdventureAsset, searchAdventureItems } from '../../src/UI/Components/GameTools/AdventureControlService.js';
import { createPickupSettingsPanel } from '../../src/UI/Game/PickupSettingsPanel.js';
import { pickupDefaults } from '../../src/UI/Game/PickupSettings.js';
loadAdventureAsset.mockResolvedValue('blob:item');
afterEach(() => { document.body.replaceChildren(); vi.clearAllMocks(); });
it('disables filters while off, preserves them and searches/adds/removes exclusions', async () => {
 const section = document.createElement('section'); document.body.append(section); const draft = pickupDefaults();
 createPickupSettingsPanel(section, draft);
 expect(section.querySelector('fieldset').disabled).toBe(true);
 const toggle = section.querySelector('[data-pickup=enabled]'); toggle.checked = true; toggle.dispatchEvent(new Event('input'));
 expect(draft.enabled).toBe(true); expect(section.querySelector('fieldset').disabled).toBe(false);
 const range = section.querySelector('[data-pickup=range]'); range.value = '8'; range.dispatchEvent(new Event('input')); expect(draft.range).toBe(8);
 const card = section.querySelector('[data-category=card]'); card.checked = false; card.dispatchEvent(new Event('input')); expect(draft.categories).not.toContain('card');
 searchAdventureItems.mockResolvedValue({ data: [{ Id: 501, names: { 'zh-CN': '红色药水' } }], total: 1 });
 section.querySelector('input[type=search]').value = '药水';
 const click = text => [...section.querySelectorAll('button')].find(button => button.textContent === text).click();
 click('搜索'); await vi.waitFor(() => expect(section.textContent).toContain('红色药水'));
 click('排除'); expect(draft.excluded).toEqual([{ id: 501, name: '红色药水' }]);
 await vi.waitFor(()=>expect(section.querySelector('.pickup-excluded img').getAttribute('src')).toBe('blob:item'));
 toggle.checked = false; toggle.dispatchEvent(new Event('input')); expect(draft.range).toBe(8); expect(draft.excluded).toHaveLength(1);
 toggle.checked = true; toggle.dispatchEvent(new Event('input')); click('移除'); expect(draft.excluded).toEqual([]);
});

it('debounces valid numbers, ignores invalid values, retries failures and cancels timers on destroy', () => {
 vi.useFakeTimers();
 try {
 const section=document.body.appendChild(document.createElement('section'));
 const save=vi.fn(() => true);
 const editor=createPickupSettingsPanel(section,{...pickupDefaults(),enabled:true},save);
 const range=section.querySelector('[data-pickup=range]');
 const input=value=>{range.value=value;range.dispatchEvent(new Event('input'));};
 input('8'); vi.advanceTimersByTime(200); input('9'); vi.advanceTimersByTime(399); expect(save).not.toHaveBeenCalled();
 vi.advanceTimersByTime(1); expect(save).toHaveBeenLastCalledWith(expect.objectContaining({range:9}));
 input('99'); vi.advanceTimersByTime(500); expect(save).toHaveBeenCalledOnce();
 input('10'); save.mockReturnValue(false); range.dispatchEvent(new Event('blur'));
 expect(section.querySelector('.pickup-save-status').textContent).toContain('保存失败');
 save.mockReturnValue(true); [...section.querySelectorAll('button')].find(x=>x.textContent==='重试').click();
 expect(section.querySelector('.pickup-save-status').textContent).toBe('已保存');
 const count=save.mock.calls.length; input('11'); editor.destroy(); vi.advanceTimersByTime(500); expect(save).toHaveBeenCalledTimes(count);
 } finally {vi.useRealTimers();}
});

it('loads authenticated item icons, pages results and releases image URLs', async () => {
 const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
 const section = document.body.appendChild(document.createElement('section'));
 const editor = createPickupSettingsPanel(section, {...pickupDefaults(), enabled:true}, () => true);
 loadAdventureAsset.mockResolvedValueOnce('blob:first').mockResolvedValueOnce('blob:second');
 searchAdventureItems.mockResolvedValue({data:[{Id:501, names:{'zh-CN':'红色药水'}, icon:'/api/adventure-tools/assets/items/501.png'}],total:60});
 section.querySelector('input[type=search]').value='药水';
 [...section.querySelectorAll('button')].find(b=>b.textContent==='搜索').click();
 await vi.waitFor(()=>expect(section.querySelector('.pickup-item-icon')?.getAttribute('src')).toBe('blob:first'));
 expect(loadAdventureAsset).toHaveBeenCalledWith('/assets/items/501.png');
 section.querySelector('.pickup-pagination button:last-child').click();
 await vi.waitFor(()=>expect(section.querySelector('.pickup-item-icon')?.getAttribute('src')).toBe('blob:second'));
 expect(searchAdventureItems).toHaveBeenLastCalledWith({query:'药水',page:2,perPage:20});
 expect([...section.querySelectorAll('.pickup-pagination button')].map(b=>b.textContent)).toEqual(['上一页','下一页']);
 expect(revoke).toHaveBeenCalledWith('blob:first');
 editor.destroy();
 expect(revoke).toHaveBeenCalledWith('blob:second');
 revoke.mockRestore();
});

it('releases icons that finish loading after the panel closes', async () => {
 const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
 let resolveImage;
 loadAdventureAsset.mockReturnValue(new Promise(resolve => {resolveImage=resolve;}));
 searchAdventureItems.mockResolvedValue({data:[{Id:501,icon:'/api/adventure-tools/assets/items/501.png'}],total:1});
 const section=document.body.appendChild(document.createElement('section'));
 const editor=createPickupSettingsPanel(section,{...pickupDefaults(),enabled:true},()=>true);
 section.querySelector('input[type=search]').value='501';
 [...section.querySelectorAll('button')].find(b=>b.textContent==='搜索').click();
 await vi.waitFor(()=>expect(resolveImage).toBeTypeOf('function'));
 editor.destroy(); resolveImage('blob:late');
 await vi.waitFor(()=>expect(revoke).toHaveBeenCalledWith('blob:late'));
 expect(section.querySelector('.pickup-item-icon').getAttribute('src')).toMatch(/^data:image\/svg\+xml,/);
 revoke.mockRestore();
});

it('shows placeholders for missing, failed and corrupt icons in both lists', async () => {
 loadAdventureAsset.mockRejectedValue(new Error('missing asset'));
 const section=document.body.appendChild(document.createElement('section'));
 const editor=createPickupSettingsPanel(section,{...pickupDefaults(),enabled:true,excluded:[{id:501,name:'红色药水'}]},()=>true);
 searchAdventureItems.mockResolvedValue({data:[{Id:502},{Id:503,icon:'/items/503/icon'}],total:2});
 section.querySelector('input[type=search]').value='药水';
 [...section.querySelectorAll('button')].find(b=>b.textContent==='搜索').click();
 await vi.waitFor(()=>expect(section.querySelectorAll('.pickup-item-icon')).toHaveLength(3));
 expect(loadAdventureAsset).toHaveBeenCalledWith('/items/501/icon');
 for(const image of section.querySelectorAll('.pickup-item-icon')) {
  expect(image.src).toMatch(/^data:image\/svg\+xml,/);
  expect(image.hidden).toBe(false);
 }
 const image=section.querySelector('.pickup-excluded img');
 image.src='blob:corrupt'; image.dispatchEvent(new Event('error'));
 expect(image.src).toMatch(/^data:image\/svg\+xml,/);
 editor.destroy();
});

it('keeps results and pagination mounted while the next page loads', async () => {
 const section=document.body.appendChild(document.createElement('section'));
 const editor=createPickupSettingsPanel(section,{...pickupDefaults(),enabled:true},()=>true);
 searchAdventureItems.mockResolvedValueOnce({data:[{Id:501,names:{'zh-CN':'第一页'}}],total:60});
 section.querySelector('input[type=search]').value='药水';
 [...section.querySelectorAll('button')].find(b=>b.textContent==='搜索').click();
 await vi.waitFor(()=>expect(section.querySelector('.pickup-results').textContent).toContain('第一页'));
 const row=section.querySelector('.pickup-item'),next=section.querySelector('.pickup-pagination button:last-child');
 let resolve;
 searchAdventureItems.mockReturnValueOnce(new Promise(done=>{resolve=done;}));
 next.click();
 expect(row.isConnected).toBe(true);
 expect(next.isConnected).toBe(true);
 resolve({data:[{Id:502,names:{'zh-CN':'第二页'}}],total:60});
 await vi.waitFor(()=>expect(section.querySelector('.pickup-results').textContent).toContain('第二页'));
 editor.destroy();
});
