import { afterEach, expect, it, vi } from 'vitest';
vi.mock('UI/Components/GameTools/GameSelect.js', () => ({ mountGameSelects() {} }));
import { mountRemoteCatalogBrowser } from '../../src/UI/Components/GameTools/RemoteCatalogBrowser.js';
let root, dispose;
function mount(load) {
 root = document.body.appendChild(document.createElement('div'));
 dispose = mountRemoteCatalogBrowser(root, {
  load, pageSize: 1, key: item => item.id, placeholder: '搜索', searchLabel: '搜索', emptyDetail: '请选择',
  renderRow: item => `<button data-catalog-key="${item.id}">${item.id}</button>`,
  renderDetail: (detail, item) => { detail.textContent = `详情 ${item.id}`; }
 });
}
afterEach(() => { dispose?.(); root?.remove(); });
const result = id => ({ items: [{ id }], total: 2 });
it('shows initial loading and failure inside the list and retries without interpreting error HTML', async () => {
 const load = vi.fn().mockRejectedValueOnce(Error('<b>offline</b>')).mockResolvedValueOnce(result(1));
 mount(load);
 expect(root.querySelector('.catalog-list [role=status]').textContent).toContain('正在加载');
 await vi.waitFor(() => expect(root.querySelector('.catalog-retry')).not.toBeNull());
 expect(root.querySelector('.catalog-list b')).toBeNull();
 expect(root.querySelector('.catalog-list').textContent).toContain('<b>offline</b>');
 root.querySelector('.catalog-retry').click();
 await vi.waitFor(() => expect(root.querySelector('[data-catalog-key="1"]')).not.toBeNull());
 expect(root.querySelector('.catalog-retry')).toBeNull();
});
it('retains the successful page and selection on failure, then retries the requested page', async () => {
 const load = vi.fn().mockResolvedValueOnce(result(1)).mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(result(2));
 mount(load);
 await vi.waitFor(() => expect(root.querySelector('.catalog-detail').textContent).toBe('详情 1'));
 root.querySelector('.catalog-next').click();
 await vi.waitFor(() => expect(root.querySelector('.catalog-retry')).not.toBeNull());
 expect(root.querySelector('[data-catalog-key="1"]')).not.toBeNull();
 expect(root.querySelector('.catalog-detail').textContent).toBe('详情 1');
 expect(root.querySelector('.catalog-page').textContent).toBe('1 / 2');
 root.querySelector('.catalog-retry').click();
 await vi.waitFor(() => expect(root.querySelector('.catalog-detail').textContent).toBe('详情 2'));
 expect(load.mock.calls.map(([request]) => request.page)).toEqual([1, 2, 2]);
 expect(root.querySelector('.catalog-page').textContent).toBe('2 / 2');
});
it('ignores a late result after the tab is disposed', async () => {
 let resolve;
 mount(() => new Promise(done => { resolve = done; }));
 dispose(); const html = root.innerHTML;
 resolve(result(1)); await vi.dynamicImportSettled();
 expect(root.innerHTML).toBe(html);
});
it('renders guidance when a successful catalog response is empty', async () => {
 mount(vi.fn().mockResolvedValue({ items: [], total: 0 }));
 await vi.waitFor(() => expect(root.querySelector('.catalog-empty-state')?.textContent).toBe('暂无资料'));
 expect(root.querySelector('.catalog-retry')).toBeNull();
});
