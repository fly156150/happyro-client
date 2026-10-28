import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ catalog: vi.fn(), drops: vi.fn(), maps: vi.fn() }));
vi.mock('UI/Components/GameTools/MonsterCatalogAssets.js', () => ({ loadMonsterCatalog: mocks.catalog, loadMonsterDrops: mocks.drops }));
vi.mock('DB/DBManager.js', () => ({ default: { listNavigation: mocks.maps } }));
vi.mock('Network/NetworkManager.js', () => ({ default: {} }));
vi.mock('Network/PacketStructure.js', () => ({ default: {} }));
vi.mock('Engine/SessionStorage.js', () => ({ default: {} }));
vi.mock('Preferences/AdventureTools.js', () => ({ default: { monsterCurrentMap: false, save() {} } }));
vi.mock('UI/Components/GameTools/AdventureActionService.js', () => ({
 getCurrentAdventureMap: () => '', getAdventureActionState: () => ({}),
 subscribeAdventureActions: () => () => {}, teleportToCoordinate() {}
}));
import tab from '../../src/UI/Components/GameTools/MonsterCatalogTab.js';
const monster = { id: 1002, name: '波利', nameEn: 'Poring', kind: 'normal', atlas: null, attack: [1, 2], spawns: [] };
const catalog = { monsters: [monster, { ...monster, id: 1003, name: '土波利' }] };
let root, dispose;
function mount(context = {}) {
 root = document.body.appendChild(document.createElement('div'));
 dispose = tab.mount(root, { mobile: true, ...context });
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
beforeEach(() => {
 vi.resetAllMocks(); mocks.maps.mockResolvedValue([]); mocks.drops.mockResolvedValue({ drops: {} });
});
afterEach(() => { dispose?.(); root?.remove(); });
it('keeps loading and failed states in the list while filters change, then retries with current filters', async () => {
 mocks.catalog.mockRejectedValueOnce(Error('offline'));
 const pending = deferred(); mocks.catalog.mockReturnValueOnce(pending.promise);
 mount();
 expect(root.querySelector('.monster-list [role=status]').textContent).toContain('正在加载');
 expect(root.querySelector('.page-next').disabled).toBe(true);
 await vi.waitFor(() => expect(root.querySelector('.monster-catalog-retry')).not.toBeNull());
 const search = root.querySelector('.monster-search');search.value = '1003';search.dispatchEvent(new Event('input'));
 expect(root.querySelector('.monster-list').textContent).toContain('加载失败');
 const retry = root.querySelector('.monster-catalog-retry');retry.click();retry.click();
 expect(mocks.catalog).toHaveBeenCalledTimes(2);
 expect(root.querySelector('.monster-list').textContent).toContain('正在加载');
 pending.resolve(catalog);
 await vi.waitFor(() => expect(root.querySelector('.monster-row.selected')?.dataset.id).toBe('1003'));
 expect(root.querySelectorAll('.monster-row')).toHaveLength(1);
 expect(root.querySelector('.monster-catalog-retry')).toBeNull();
});
it('retains a requested monster across navigation-data failure and retry', async () => {
 mocks.catalog.mockResolvedValue(catalog);mocks.maps.mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce([]);
 mount({ initialMonsterId: 1003 });
 await vi.waitFor(() => expect(root.querySelector('.monster-catalog-retry')).not.toBeNull());
 root.querySelector('.monster-catalog-retry').click();
 await vi.waitFor(() => expect(root.querySelector('.monster-row.selected')?.dataset.id).toBe('1003'));
});
it('does not render or load drops after a pending catalog completes on a disposed tab', async () => {
 const pending = deferred();mocks.catalog.mockReturnValue(pending.promise);mount();dispose();
 const html = root.innerHTML;pending.resolve(catalog);await vi.dynamicImportSettled();
 expect(root.innerHTML).toBe(html);expect(mocks.drops).not.toHaveBeenCalled();
});
it('retries drop loading independently and marks loading, error and empty guidance', async () => {
 mocks.catalog.mockResolvedValue(catalog);const pending = deferred();mocks.drops.mockRejectedValueOnce(Error('offline')).mockReturnValueOnce(pending.promise);
 mount();await vi.waitFor(() => expect(root.querySelector('.monster-drops .error')?.textContent).toContain('加载失败'));
 root.querySelector('.monster-drops-retry').click();
 expect(root.querySelector('.monster-drops .menu-hint').textContent).toContain('加载中');
 pending.resolve({ drops: {} });
 await vi.waitFor(() => expect(root.querySelector('.monster-drops .menu-hint')?.textContent).toBe('无掉落资料'));
 expect(root.querySelector('.monster-drops .error')).toBeNull();expect(mocks.catalog).toHaveBeenCalledOnce();
});
it('does not show an empty-drop hint when MVP rewards exist', async () => {
 mocks.catalog.mockResolvedValue(catalog);
 mocks.drops.mockResolvedValue({ drops: { 1002: { drops: [], mvpDrops: [{ Item: 'Apple', name: '苹果', Rate: 1000 }] } } });
 mount();
 await vi.waitFor(() => expect(root.querySelector('.monster-drops').textContent).toContain('苹果'));
 expect(root.querySelector('.monster-drops').textContent).not.toContain('无掉落资料');
});
