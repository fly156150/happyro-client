import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../src/UI/Components/GameTools/MonsterCatalogAssets.js',()=>({loadMonsterCatalog:vi.fn()}));
import {loadMonsterCatalog} from '../../src/UI/Components/GameTools/MonsterCatalogAssets.js';
import {createMapMonsterTable,mapMonsterRows} from '../../src/UI/Components/GameTools/MapMonsterTable.js';
const monsters=[{id:2,name:'绿棉虫',level:4,hp:150,kind:'normal',element:'Earth',elementLevel:1,baseExp:55,jobExp:30,spawns:[{mapName:'forest',count:10}]},{id:1,name:'<波利>',level:1,hp:50,kind:'normal',element:'Water',elementLevel:1,baseExp:20,jobExp:10,spawns:[{mapName:'forest',count:3},{mapName:'forest',count:5}]},{id:3,name:'其它地图',level:1,spawns:[{mapName:'other',count:1}]}];
afterEach(()=>{document.body.replaceChildren();vi.resetAllMocks();});
it('includes only the selected map species once, ordered by level',()=>{
 expect(mapMonsterRows(monsters,'forest').map(m=>m.id)).toEqual([1,2]);
 expect(mapMonsterRows(monsters,'town')).toEqual([]);
});
it('renders HP and both experience values safely and switches maps without another catalog load',async()=>{
 loadMonsterCatalog.mockResolvedValue({monsters});
 const region=document.body.appendChild(document.createElement('section'));
 const openMonster=vi.fn(); const view=createMapMonsterTable({openMonster});view.render(region,'forest');await Promise.resolve();
 expect([...region.querySelectorAll('th')].map(e=>e.textContent)).toEqual(['名称','等级','HP','属性','经验']);
 expect([...region.querySelector('tbody tr').children].map(e=>e.textContent)).toEqual(['<波利>','1','50','水 1','20 / 10']);
 expect(region.querySelector('波利')).toBeNull();
 region.querySelector('[data-monster-id="1"]').click();expect(openMonster).toHaveBeenCalledWith(1);
 view.render(region,'town');expect(region.textContent).toContain('暂无魔物刷新信息');
 expect(loadMonsterCatalog).toHaveBeenCalledTimes(1);view.destroy();
});
it('supports retry and does not populate a removed region with late results',async()=>{
 loadMonsterCatalog.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({monsters});
 const region=document.body.appendChild(document.createElement('section'));
 const openMonster=vi.fn(); const view=createMapMonsterTable({openMonster});view.render(region,'forest');await Promise.resolve();await Promise.resolve();
 expect(region.textContent).toContain('加载失败');region.querySelector('button').click();
 region.remove();await Promise.resolve();expect(region.querySelector('table')).toBeNull();view.destroy();
});

it('shows a dash for missing or non-finite stats', async()=>{
 loadMonsterCatalog.mockResolvedValue({monsters:[{...monsters[0],level:NaN,hp:undefined,elementLevel:NaN,baseExp:NaN,jobExp:Infinity}]});
 const region=document.body.appendChild(document.createElement('section'));
 const view=createMapMonsterTable({openMonster:vi.fn()});view.render(region,'forest');await Promise.resolve();
 expect([...region.querySelector('tbody tr').children].map(e=>e.textContent)).toEqual(['绿棉虫','-','-','地 -','-']);
 view.destroy();
});
