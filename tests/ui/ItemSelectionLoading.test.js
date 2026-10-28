import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { openItemSelectionDialog } from '../../src/UI/Game/ItemSelectionDialog.js';
let body, close;
beforeEach(() => {
 vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function () { this.open = true; });
 vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function () { this.open = false; });
 body = document.body.appendChild(document.createElement('div'));
});
afterEach(() => { close?.(); body.remove(); vi.restoreAllMocks(); });
function mount(searchItems) {
 close = openItemSelectionDialog(body, { existingItems: [], image: () => document.createElement('img'), clearImages() {}, confirm() {}, title: '道具', searchLabel: '搜索', placeholder: '名称', allowEmptyQuery: true, searchItems });
}
it('shows initial loading, then keeps existing rows during the next request and removes loading on failure', async () => {
 let resolve, reject;
 const search = vi.fn().mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
 mount(search);
 expect(body.querySelector('.pickup-loading').textContent).toBe('正在加载物品…');
 resolve({ data: [{ id: 501, name: '苹果' }], total: 20 });
 await vi.waitFor(() => expect(body.querySelector('.pickup-item')).not.toBeNull());
 body.querySelector('[data-next]').click();
 expect(body.querySelector('.pickup-item').textContent).toContain('苹果');
 expect(body.querySelector('.pickup-loading')).toBeNull();
 expect(body.querySelector('.pickup-search-status').hidden).toBe(false);
 expect(body.querySelector('.pickup-search-status').textContent).toBe('正在加载物品…');
 reject(Error('offline'));
 await vi.waitFor(() => expect(body.querySelector('.pickup-search-status').textContent).toBe('搜索失败，请重试'));
 expect(body.querySelector('.pickup-results').hasAttribute('aria-busy')).toBe(false);
 expect(body.querySelector('.pickup-item')).not.toBeNull();
});
it('clears the loading placeholder when the first request fails', async () => {
 mount(async () => { throw Error('offline'); });
 await vi.waitFor(() => expect(body.querySelector('.pickup-search-status').dataset.error).toBe('true'));
 expect(body.querySelector('.pickup-loading')).toBeNull();
 expect(body.querySelector('.pickup-search-status').hidden).toBe(false);
});
it.each(['mobile', 'desktop'])('keeps tracking %s owner bounds after editing the search and stops when closed', kind => {
 const original = globalThis.ResizeObserver;
 globalThis.ResizeObserver = class { observe() {} disconnect() {} };
 const host = body.appendChild(document.createElement('div'));
 if (kind === 'mobile') host.dataset.menuDensity = 'compact';
 const root = host.attachShadow({ mode: 'open' });
 root.innerHTML = '<section class="panel"><div></div></section>';
 const owner = root.querySelector('section'), container = owner.firstElementChild;
 if (kind === 'desktop') owner.dataset.feedbackTheme = 'desktop';
 let rect = { left: 20, top: 40, right: 320, bottom: 400 };
 owner.getBoundingClientRect = () => rect;
 try {
  close = openItemSelectionDialog(container, { existingItems: [], image: () => document.createElement('img'), clearImages() {}, confirm() {}, title: '道具', searchLabel: '搜索', placeholder: '名称', searchItems: async () => ({ data: [], total: 0 }) });
  const dialog = container.querySelector('dialog');
  expect(dialog.style.getPropertyValue('--confirm-max-height')).toBe('360px');
  const input = dialog.querySelector('input');
  input.value = '苹果';
  input.dispatchEvent(new Event('input'));
  rect = { left: 20, top: 20, right: 600, bottom: 250 };
  window.dispatchEvent(new Event('resize'));
  expect(dialog.style.getPropertyValue('--confirm-max-height')).toBe('230px');
  expect(dialog.style.getPropertyValue('--confirm-max-width')).toBe('580px');
  close();
  rect.bottom = 200;
  window.dispatchEvent(new Event('resize'));
  expect(dialog.style.getPropertyValue('--confirm-max-height')).toBe('230px');
 } finally { globalThis.ResizeObserver = original; }
});

it('searches after typing, respects composition, and cancels pending work on close', async () => {
 vi.useFakeTimers();
 try {
  const search = vi.fn().mockResolvedValue({ data: [], total: 0 });
  mount(search);
  await vi.advanceTimersByTimeAsync(0);
  search.mockClear();
  const input = body.querySelector('input[type=search]');
  input.value = '苹'; input.dispatchEvent(new Event('input'));
  await vi.advanceTimersByTimeAsync(150);
  input.value = '苹果'; input.dispatchEvent(new Event('input'));
  await vi.advanceTimersByTimeAsync(249);
  expect(search).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(search).toHaveBeenLastCalledWith({ query: '苹果', page: 1, perPage: 10 });
  search.mockClear();
  input.dispatchEvent(new CompositionEvent('compositionstart'));
  input.value = '红色'; input.dispatchEvent(new Event('input'));
  await vi.advanceTimersByTimeAsync(300);
  expect(search).not.toHaveBeenCalled();
  input.dispatchEvent(new CompositionEvent('compositionend'));
  await vi.advanceTimersByTimeAsync(250);
  expect(search).toHaveBeenCalledOnce();
  input.value = '药水'; input.dispatchEvent(new Event('input'));
  close();
  await vi.advanceTimersByTimeAsync(300);
  expect(search).toHaveBeenCalledOnce();
 } finally { vi.useRealTimers(); }
});
