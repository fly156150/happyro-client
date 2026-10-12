import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('UI/Components/GameTools/AdventureControlService.js', () => ({ searchAdventureItems: vi.fn(), loadAdventureAsset: vi.fn() }));
import { searchAdventureItems, loadAdventureAsset } from '../../src/UI/Components/GameTools/AdventureControlService.js';
import { createPickupSettingsPanel } from '../../src/UI/Game/PickupSettingsPanel.js';
import { pickupDefaults } from '../../src/UI/Game/PickupSettings.js';
let section, draft, editor, persist;
beforeEach(() => {
 vi.spyOn(HTMLDialogElement.prototype,'showModal').mockImplementation(function(){this.open=true;});
 vi.spyOn(HTMLDialogElement.prototype,'close').mockImplementation(function(){this.open=false;});
 loadAdventureAsset.mockResolvedValue('blob:item');
 section=document.body.appendChild(document.createElement('section'));
 draft={...pickupDefaults(),enabled:true}; persist=vi.fn(()=>true);
});
afterEach(()=>{editor?.destroy();document.body.replaceChildren();vi.restoreAllMocks();vi.clearAllMocks();});
function mount(){editor=createPickupSettingsPanel(section,draft,persist);}
function click(text,root=section){[...root.querySelectorAll('button')].find(b=>b.textContent===text).click();}
function choose(selector){const input=section.querySelector(selector);input.checked=!input.checked;input.dispatchEvent(new Event('change'));}
async function search(data,total=1){
 searchAdventureItems.mockResolvedValueOnce({data,total});
 section.querySelector('input[type=search]').value='药水';click('搜索');
 await vi.waitFor(()=>expect(section.querySelector('.pickup-picker .pickup-item')).not.toBeNull());
}
it('allows editing and saving while pickup is off',()=>{
 draft.enabled=false;mount();expect(section.querySelector('fieldset').disabled).toBe(false);
 const range=section.querySelector('[data-pickup=range]');range.value='8';range.dispatchEvent(new Event('input'));editor.flush();
 expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({enabled:false,range:8}));
 expect(section.querySelector('.pickup-save-error').hidden).toBe(true);
 const toggle=section.querySelector('[data-pickup=enabled]');toggle.checked=true;toggle.dispatchEvent(new Event('input'));
 expect(section.querySelector('fieldset').disabled).toBe(false);expect(draft.enabled).toBe(true);
});
it('keeps multi-page selections pending until confirmation and avoids duplicates',async()=>{
 mount();click('添加');await search([{Id:501,names:{'zh-CN':'红色药水'}}],41);
 choose('[data-item-id="501"]');expect(draft.excluded).toEqual([]);expect(persist).not.toHaveBeenCalled();
 searchAdventureItems.mockResolvedValueOnce({data:[{Id:502,names:{'zh-CN':'橙色药水'}}],total:41});click('下一页');
 await vi.waitFor(()=>expect(section.querySelector('[data-item-id="502"]')).not.toBeNull());choose('[data-item-id="502"]');
 searchAdventureItems.mockResolvedValueOnce({data:[{Id:501,names:{'zh-CN':'红色药水'}}],total:41});click('上一页');
 await vi.waitFor(()=>expect(section.querySelector('[data-item-id="501"]')?.checked).toBe(true));
 expect(section.querySelector('[data-selected]').textContent).toBe('已选 2 件');click('确认添加');
 expect(draft.excluded.map(i=>i.id)).toEqual([501,502]);expect(persist).toHaveBeenCalledOnce();expect(section.querySelector('dialog')).toBeNull();
 click('添加');await search([{Id:501,names:{'zh-CN':'红色药水'}}]);
 expect(section.querySelector('[data-item-id="501"]').disabled).toBe(true);expect(section.querySelector('[data-confirm]').disabled).toBe(true);
});
it('cancels without saving and deletes only selected entries',async()=>{
 draft.excluded=[{id:501,name:'红色药水'},{id:502,name:'橙色药水'}];mount();click('添加');
 await search([{Id:503,names:{'zh-CN':'黄色药水'}}]);choose('[data-item-id="503"]');click('取消');
 expect(draft.excluded).toHaveLength(2);expect(persist).not.toHaveBeenCalled();
 choose('[data-excluded-id="501"]');click('删除');expect(draft.excluded).toEqual([{id:502,name:'橙色药水'}]);expect(persist).toHaveBeenCalledOnce();
});
it('requires confirmation to clear the exclusion list',()=>{
 draft.excluded=[{id:501,name:'红色药水'}];mount();click('清空');click('取消');expect(draft.excluded).toHaveLength(1);
 click('清空');click('确认');expect(draft.excluded).toEqual([]);expect(persist).toHaveBeenCalledOnce();
});
it('keeps results and pagination mounted during loading and after a failed request',async()=>{
 mount();click('添加');await search([{Id:501,names:{'zh-CN':'红色药水'}}],41);
 const row=section.querySelector('.pickup-results .pickup-item'),next=section.querySelector('[data-next]');
 let reject;searchAdventureItems.mockReturnValueOnce(new Promise((_,fail)=>{reject=fail;}));click('下一页');
 expect(row.isConnected).toBe(true);expect(next.isConnected).toBe(true);expect(next.disabled).toBe(true);
 reject(new Error('offline'));await vi.waitFor(()=>expect(section.querySelector('.pickup-search-status').textContent).toContain('搜索失败'));
 expect(row.isConnected).toBe(true);expect(next.disabled).toBe(false);
});
it('shows placeholders and releases late images after closing the picker',async()=>{
 const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 let resolve;loadAdventureAsset.mockReturnValueOnce(new Promise(done=>{resolve=done;}));
 mount();click('添加');await search([{Id:501,icon:'/api/adventure-tools/items/501/icon'},{Id:502}],2);
 expect(loadAdventureAsset).toHaveBeenCalledWith('/items/501/icon');
 expect(section.querySelectorAll('.pickup-item-icon')).toHaveLength(2);
 for(const image of section.querySelectorAll('.pickup-item-icon'))expect(image.src).toMatch(/^data:image\/svg\+xml,/);
 click('取消');resolve('blob:late');await vi.waitFor(()=>expect(revoke).toHaveBeenCalledWith('blob:late'));
});
it('loads icons for saved exclusions and falls back when an image is unavailable',async()=>{
 draft.excluded=[{id:501,name:'红色药水'},{id:502,name:'橙色药水'}];
 loadAdventureAsset.mockResolvedValueOnce('blob:501').mockRejectedValueOnce(new Error('missing'));mount();
 await vi.waitFor(()=>expect(section.querySelector('.pickup-excluded img').src).toBe('blob:501'));
 const images=section.querySelectorAll('.pickup-excluded img');expect(images[1].src).toMatch(/^data:image\/svg\+xml,/);
 images[0].dispatchEvent(new Event('error'));expect(images[0].src).toMatch(/^data:image\/svg\+xml,/);
});
it('ignores pending search responses after the editor is destroyed',async()=>{
 mount();click('添加');let resolve;searchAdventureItems.mockReturnValueOnce(new Promise(done=>{resolve=done;}));
 section.querySelector('input[type=search]').value='501';click('搜索');editor.destroy();
 resolve({data:[{Id:501}],total:1});await Promise.resolve();expect(section.querySelector('dialog')).toBeNull();expect(persist).not.toHaveBeenCalled();
});
it('debounces valid numbers and retains the last valid setting',()=>{
 vi.useFakeTimers();try{mount();const range=section.querySelector('[data-pickup=range]');
 range.value='8';range.dispatchEvent(new Event('input'));vi.advanceTimersByTime(400);expect(persist).toHaveBeenCalledOnce();expect(draft.range).toBe(8);
 range.value='99';range.dispatchEvent(new Event('input'));vi.advanceTimersByTime(400);expect(persist).toHaveBeenCalledOnce();expect(draft.range).toBe(8);
 }finally{vi.useRealTimers();}
});
