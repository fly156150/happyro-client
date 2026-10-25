vi.mock('../../src/UI/Components/GameTools/GameToolsNumberPrompt.js', () => ({ requestGameToolsNumber: vi.fn() }));
import { requestGameToolsNumber } from '../../src/UI/Components/GameTools/GameToolsNumberPrompt.js';
vi.mock('../../src/UI/Components/GameTools/MonsterCatalogAssets.js', () => ({ loadMonsterCatalog: vi.fn() }));
import { loadMonsterCatalog } from '../../src/UI/Components/GameTools/MonsterCatalogAssets.js';
vi.mock('Core/Client.js', () => ({ default: { loadFile: vi.fn() } }));
vi.mock('DB/DBManager.js', () => ({ default: { INTERFACE_PATH: 'data/interface/', getItemInfo: vi.fn(), listNavigation: vi.fn() } }));
import Client from 'Core/Client.js';
import DB from 'DB/DBManager.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('UI/Components/Toast.js', () => ({ showToast: vi.fn() }));
vi.mock('UI/Components/Confirmation.js', () => ({ requestConfirmation: vi.fn() }));
vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({
 loadAdventureItem: vi.fn(), searchAdventureItems: vi.fn(), grantAdventureItem: vi.fn(), grantAdventureZeny: vi.fn(), loadAdventureAsset: vi.fn()
}));
import tab from '../../src/UI/Components/GameTools/ItemCatalogTab.js';
import { loadAdventureItem, searchAdventureItems, grantAdventureItem, grantAdventureZeny, loadAdventureAsset } from '../../src/UI/Components/GameTools/AdventureControlService.js';
import { requestConfirmation } from 'UI/Components/Confirmation.js';
import { showToast } from 'UI/Components/Toast.js';
let root, cleanup;
const tick = () => vi.advanceTimersByTimeAsync(0);
const mount = async (mobile=false, allowed=true) => { cleanup=tab.mount(root,{mobile,capabilities:{itemGrantAllowed:allowed}});await tick(); };
beforeEach(() => {
 vi.useFakeTimers(); vi.resetAllMocks();
 requestGameToolsNumber.mockResolvedValue(null);
 loadAdventureItem.mockResolvedValue({dropSources:[]});
 DB.listNavigation.mockResolvedValue([]);loadMonsterCatalog.mockResolvedValue({monsters:[]});
 searchAdventureItems.mockImplementation(async ({ query }) => ({data: query === 'absent' ? [] : [501,502].map(Id => ({Id,Type:'Healing',AegisName:`Item_${Id}`,grantable:true})),total:query === 'absent' ? 0 : 2,subtypes:[]}));
 root=document.createElement('div');document.body.append(root);
});
afterEach(() => { cleanup?.();root.remove();vi.useRealTimers(); });
it.each([false,true])('remembers separate grant values and recovers from errors on mobile=%s', async mobile => {
 await mount(mobile);
 requestGameToolsNumber.mockResolvedValueOnce(25);
 root.querySelector('.item-grant').click();await tick();
 expect(grantAdventureItem).toHaveBeenCalledWith(501,25);
 requestGameToolsNumber.mockResolvedValueOnce(100000);
 grantAdventureZeny.mockRejectedValueOnce({code:'zeny_amount_exceeded'});
 root.querySelector('.zeny-grant-open').click();await tick();
 expect(requestGameToolsNumber).toHaveBeenLastCalledWith(root,expect.objectContaining({value:'',label:'金额'}));
 expect(showToast).toHaveBeenCalledWith(root,'发放后会超过角色 Zeny 持有上限','error');
 expect(root.querySelector('.zeny-grant-open').disabled).toBe(false);
 root.querySelector('.item-grant').click();await tick();
 expect(requestGameToolsNumber).toHaveBeenLastCalledWith(root,expect.objectContaining({value:'25',label:'数量'}));
 expect(grantAdventureItem).toHaveBeenCalledOnce();
});
it('locks both actions until the request finishes and respects permissions',async()=>{
 await mount(false,false);
 expect(root.querySelector('.item-grant').disabled).toBe(true);
 expect(root.querySelector('.zeny-grant-open').disabled).toBe(true);
 cleanup();await mount();let finish;
 requestGameToolsNumber.mockResolvedValueOnce(30000);
 grantAdventureItem.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 root.querySelector('.item-grant').click();await tick();
 expect(root.querySelector('.item-grant').disabled).toBe(true);
 expect(root.querySelector('.zeny-grant-open').disabled).toBe(true);
 root.querySelector('.item-grant').click();expect(grantAdventureItem).toHaveBeenCalledOnce();
 finish();await tick();expect(root.querySelector('.item-grant').disabled).toBe(false);
});
it('allows Zeny grants without selecting an item',async()=>{
 searchAdventureItems.mockResolvedValue({data:[],total:0,subtypes:[]});await mount();
 expect(root.querySelector('.item-grant').disabled).toBe(true);
 requestGameToolsNumber.mockResolvedValueOnce(1234567890);
 root.querySelector('.zeny-grant-open').click();await tick();
 expect(grantAdventureZeny).toHaveBeenCalledWith(1234567890);
});

it('offers only populated subtypes and keeps them during empty searches',async()=>{
 searchAdventureItems.mockImplementation(async({type})=>({data:[],total:0,subtypes:type==='Weapon'?['Dagger','Bow']:type==='Armor'?['Armor']:[]}));
 await mount();
 const type=root.querySelector('[name=type]'),subtype=root.querySelector('[name=subtype]');
 const values=()=>[...root.querySelectorAll('.item-subtype-filter [data-value]')].map(e=>e.dataset.value);
 type.value='Weapon';type.dispatchEvent(new Event('change'));await tick();
 expect(values()).toEqual(['','Dagger','Bow']);
 subtype.value='Dagger';subtype.dispatchEvent(new Event('change'));await tick();expect(subtype.value).toBe('Dagger');
 const search=root.querySelector('.catalog-search');search.value='absent';search.dispatchEvent(new Event('input'));await vi.advanceTimersByTimeAsync(300);
 expect(values()).toEqual(['','Dagger','Bow']);expect(subtype.value).toBe('Dagger');
 type.value='Armor';type.dispatchEvent(new Event('change'));await tick();expect(values()).toEqual(['','Armor']);expect(subtype.value).toBe('');
 type.value='Healing';type.dispatchEvent(new Event('change'));await tick();expect(values()).toEqual(['']);expect(root.querySelector('.item-subtype-filter button').disabled).toBe(true);
});
it('does not apply a stale type response to the current subtype menu',async()=>{
 await mount();let resolveWeapon;
 searchAdventureItems.mockImplementation(({type})=>type==='Weapon'?new Promise(resolve=>{resolveWeapon=resolve;}):Promise.resolve({data:[],total:0,subtypes:['Armor']}));
 const type=root.querySelector('[name=type]');type.value='Weapon';type.dispatchEvent(new Event('change'));
 type.value='Armor';type.dispatchEvent(new Event('change'));await tick();
 resolveWeapon({data:[],total:0,subtypes:['Dagger']});await tick();
 expect([...root.querySelectorAll('.item-subtype-filter [data-value]')].map(e=>e.dataset.value)).toEqual(['','Armor']);
});

it.each([true,false])('shows card artwork only in the detail while preserving list icons on mobile=%s',async mobile=>{
 DB.getItemInfo.mockReturnValue({illustResourcesName:'poring'});
 Client.loadFile.mockImplementation((path,resolve)=>resolve('data:image/png;base64,card'));
 loadAdventureAsset.mockResolvedValue('data:image/png;base64,icon');
 searchAdventureItems.mockResolvedValue({data:[{Id:4001,Type:'Card',AegisName:'Poring_Card',icon:'/icon',illustration:'/illustration'}],total:1,subtypes:[]});
 await mount(mobile);
 expect(Client.loadFile.mock.calls[0][0]).toBe('data/interface/cardbmp/poring.bmp');
 expect(root.querySelector('.item-portrait img').src).toBe('data:image/png;base64,card');
 expect(root.querySelector('.item-thumb img').src).toBe('data:image/png;base64,icon');
 expect(loadAdventureAsset).not.toHaveBeenCalledWith('/illustration');
});
it.each(['ordinary','no-art','missing-file'])('preserves ordinary detail images for %s',async kind=>{
 DB.getItemInfo.mockReturnValue(kind==='no-art'?{}:{illustResourcesName:'missing'});
 Client.loadFile.mockImplementation((path,resolve,reject)=>reject());
 loadAdventureAsset.mockImplementation(async path=>`data:image/png;base64,${path.slice(1)}`);
 searchAdventureItems.mockResolvedValue({data:[{Id:4001,Type:kind==='ordinary'?'Healing':'Card',AegisName:'Item',icon:'/icon',illustration:'/illustration'}],total:1,subtypes:[]});
 await mount();
 expect(root.querySelector('.item-portrait img').src).toBe('data:image/png;base64,illustration');
 if(kind==='ordinary') expect(DB.getItemInfo).not.toHaveBeenCalled();
});
it('ignores card artwork arriving after selection changes',async()=>{
 let resolveCard;
 DB.getItemInfo.mockReturnValue({illustResourcesName:'poring'});
 Client.loadFile.mockImplementation((path,resolve)=>{resolveCard=resolve;});
 loadAdventureAsset.mockResolvedValue('data:image/png;base64,ordinary');
 searchAdventureItems.mockResolvedValue({data:[{Id:4001,Type:'Card',AegisName:'Poring',icon:'/icon'},{Id:501,Type:'Healing',AegisName:'Potion',illustration:'/potion'}],total:2,subtypes:[]});
 await mount();root.querySelector('[data-catalog-key="501"]').click();await tick();
 resolveCard('data:image/png;base64,late');await tick();
 expect(root.querySelector('.item-portrait img').src).toBe('data:image/png;base64,ordinary');
});

it('filters every item type by drop source and resets pagination', async () => {
 await mount();
 const filter=root.querySelector('[name=dropKind]');
 filter.value='mvp';filter.dispatchEvent(new Event('change'));await tick();
 expect(searchAdventureItems).toHaveBeenLastCalledWith(expect.objectContaining({dropKind:'mvp',page:1}));
});
it('shows source names safely, expands inline and opens the selected monster', async () => {
 const openMonster=vi.fn();
 loadAdventureItem.mockResolvedValue({dropSources:Array.from({length:10},(_,i)=>({id:1000+i,name:i===0?'<b>波利</b>':`魔物${i}`,kind:'mvp',level:10,drops:[{method:'normal',rate:100,count:1},{method:'mvp_reward',rate:1,count:1}]}))});
 cleanup=tab.mount(root,{openMonster,capabilities:{}});await tick();
 expect(root.querySelectorAll('[data-method=normal] .item-source-monster')).toHaveLength(8);
 expect(root.querySelector('.item-source-monster b')).toBeNull();
 expect([...root.querySelectorAll('.item-source-table')][0].querySelector('thead').textContent).toBe('名称ID等级掉率地图');
 expect(root.querySelector('[data-method=mvp_reward] .item-source-rate').textContent).toBe('0.01%');
 root.querySelector('.item-source-monster').click();expect(openMonster).toHaveBeenCalledWith(1000);
 root.querySelector('.item-sources-more').click();expect(root.querySelectorAll('[data-method=normal] .item-source-monster')).toHaveLength(10);
 root.dispatchEvent(new Event('game-tools-reset-feedback'));await tick();expect(root.querySelectorAll('[data-method=normal] .item-source-monster')).toHaveLength(10);
 root.querySelector('.item-sources-more').click();expect(root.querySelectorAll('[data-method=normal] .item-source-monster')).toHaveLength(8);
});
it('retries source errors and ignores results for a previously selected item', async () => {
 let resolveFirst;
 loadAdventureItem.mockImplementationOnce(()=>new Promise(resolve=>{resolveFirst=resolve;})).mockRejectedValueOnce(new Error('offline'));
 await mount();
 root.querySelectorAll('.catalog-row')[1].click();await tick();
 expect(root.querySelector('.item-source-list').textContent).toContain('加载失败');
 resolveFirst({dropSources:[{id:1002,name:'过时的波利',kind:'normal',level:1,drops:[{method:'normal',rate:100,count:1}]}]});await tick();
 expect(root.querySelector('.item-source-list').textContent).not.toContain('波利');
 loadAdventureItem.mockResolvedValueOnce({dropSources:[]});
 root.querySelector('.item-sources-retry').click();await tick();
 expect(root.querySelector('.item-sources-empty').textContent).toBe('无掉落信息');
});

it('sorts rates before spawn availability and level, keeps distinct IDs and displays maps and slot counts', async () => {
 loadMonsterCatalog.mockResolvedValue({monsters:[{id:1002,spawns:[{mapName:'prt_fild08',count:10}]}]});
 DB.listNavigation.mockResolvedValue([{mapName:'prt_fild08',mapDisplayName:'普隆德拉南门'}]);
 loadAdventureItem.mockResolvedValue({dropSources:[
  {id:1002,name:'波利',level:1,drops:[{method:'normal',rate:100,count:2}]},
  {id:3384,name:'波利',level:100,drops:[{method:'normal',rate:500,count:1}]},
  {id:3815,name:'强化波利',level:34,drops:[{method:'normal',rate:100,count:1}]}
 ]});
 await mount();
 expect([...root.querySelectorAll('.item-source-monster')].map(e=>e.dataset.monsterId)).toEqual(['3384','1002','3815']);
 const rows=root.querySelectorAll('.item-source-table tbody tr');
 expect([...rows[1].children].map(e=>e.textContent)).toEqual(['波利','1002','1','1% × 2','普隆德拉南门']);
 expect(rows[0].lastElementChild.textContent).toBe('未收录');
});

it.each([false,true])('prompts grants with steps and retains the selected item on mobile=%s', async mobile => {
 await mount(mobile);
 expect(root.querySelector('.item-grant-amount')).toBeNull();
 let resolve;
 requestGameToolsNumber.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
 root.querySelector('.item-grant').click();
 expect(requestGameToolsNumber).toHaveBeenCalledWith(root, expect.objectContaining({min:1,max:30000,steps:true}));
 expect(root.querySelector('.zeny-grant-open').disabled).toBe(true);
 root.querySelectorAll('.catalog-row')[1].click();
 resolve(11); await tick();
 expect(grantAdventureItem).toHaveBeenCalledWith(501,11);
 expect(requestConfirmation).not.toHaveBeenCalled();
 requestGameToolsNumber.mockResolvedValueOnce(null);
 root.querySelector('.zeny-grant-open').click();await tick();
 expect(requestGameToolsNumber).toHaveBeenLastCalledWith(root, expect.objectContaining({max:2147483647,value:''}));
 expect(grantAdventureZeny).not.toHaveBeenCalled();
 expect(root.querySelector('.zeny-grant-open').disabled).toBe(false);
 requestGameToolsNumber.mockResolvedValueOnce(2147483647);
 root.querySelector('.zeny-grant-open').click();await tick();
 expect(grantAdventureZeny).toHaveBeenCalledWith(2147483647);
});
it.each([false,true])('does not grant after unmount on mobile=%s', async mobile => {
 await mount(mobile);let resolve;
 requestGameToolsNumber.mockImplementationOnce(() => new Promise(done => {resolve=done;}));
 root.querySelector('.item-grant').click();cleanup();resolve(1);await tick();
 expect(grantAdventureItem).not.toHaveBeenCalled();
});

it('retains cancelled drafts across selections and resets only when tools close',async()=>{
 await mount();
 requestGameToolsNumber.mockImplementationOnce(async (_, options)=>{options.onChange('42');return null;});
 root.querySelector('.item-grant').click();await tick();
 root.querySelectorAll('.catalog-row')[1].click();root.dispatchEvent(new Event('game-tools-reset-feedback'));
 root.querySelector('.item-grant').click();await tick();
 expect(requestGameToolsNumber).toHaveBeenLastCalledWith(root,expect.objectContaining({value:'42'}));
 expect(grantAdventureItem).not.toHaveBeenCalled();
 root.dispatchEvent(new Event('game-tools-close'));
 root.querySelector('.item-grant').click();await tick();
 expect(requestGameToolsNumber).toHaveBeenLastCalledWith(root,expect.objectContaining({value:'1'}));
 root.querySelector('.zeny-grant-open').click();await tick();
 expect(requestGameToolsNumber).toHaveBeenLastCalledWith(root,expect.objectContaining({value:'',stepMin:0,stepButtons:[
 {delta:-1000000,label:'-100万'},{delta:-100000,label:'-10万'},{delta:100000,label:'+10万'},{delta:1000000,label:'+100万'}]}));
});

it.each([false,true])('renders catalog NAVI safely and opens tool pages without granting or teleporting on mobile=%s',async mobile=>{
 const openMap=vi.fn(),openMonster=vi.fn();
 searchAdventureItems.mockResolvedValue({data:[{Id:6081,Type:'Etc',AegisName:'Splendide_Coin',description:[
  '<NAVI>^4D4DFF防具商^000000<INFO>ecl_in01,66,95,0,101,0</INFO></NAVI>',
  '<NAVI>商人<INFO>spl_in01,110,322,0,101,0</INFO></NAVI>',
  '<NAVI>魔物<INFO>STAPO,0,0,3,-222,1</INFO></NAVI>',
  '<img src=x onerror=alert(1)>'
 ]}],total:1,subtypes:[]});
 cleanup=tab.mount(root,{mobile,openMap,openMonster,capabilities:{}});await tick();
 const description=root.querySelector('.item-description');expect(description.querySelector('img')).toBeNull();expect(description.textContent).toContain('<img src=x onerror=alert(1)>');expect(description.textContent).not.toContain('<NAVI>');
 const links=description.querySelectorAll('[data-navi-info]');expect(links[0].classList.contains('navi-link')).toBe(true);expect(links[1].classList.contains('navi-link')).toBe(false);expect(links[1].hasAttribute('tabindex')).toBe(false);
 links[0].firstChild.click();expect(openMap).toHaveBeenCalledExactlyOnceWith({id:'ecl_in01',mapName:'ecl_in01',x:66,y:95,name:'防具商'});
 links[1].click();expect(openMap).toHaveBeenCalledOnce();
 links[2].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));expect(openMonster).toHaveBeenCalledWith(expect.any(Number));expect(grantAdventureItem).not.toHaveBeenCalled();
});
