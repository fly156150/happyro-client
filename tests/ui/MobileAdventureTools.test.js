import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createAdventureToolsView } from '../../src/UI/Mobile/game/AdventureToolsView.js';
let view;
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { view?.destroy(); document.body.replaceChildren(); vi.unstubAllGlobals(); });
function mount() {
	const root = document.createElement('div'); document.body.append(root);
	const cleanup = vi.fn(), context = { capabilities: { itemGrantAllowed: true } }, close = vi.fn();
	const tabs = ['maps','monsters','items','npcs','character','settings'].map(id => ({
		id, label: id, mount: vi.fn((container, passed) => {
			expect(passed).toMatchObject(context);
			container.innerHTML = '<div class="catalog-list"><button data-catalog-key="1">Entry</button></div><section class="catalog-detail"><input aria-label="数量" value="1"></section>';
			return cleanup;
		})
	}));
	view = createAdventureToolsView(root,{tabs,context,close});
	return { root, tabs, cleanup, close };
}
it('exposes every supplied feature and delegates to its shared implementation with capabilities', () => {
	const { root, tabs, cleanup } = mount();
	expect(root.querySelectorAll('[data-tool]')).toHaveLength(6);
	for (const tab of tabs) {
		root.querySelector(`[data-tool="${tab.id}"]`).click();
		expect(tab.mount).toHaveBeenCalledOnce(); expect(view.activeFeature()).toBe(tab.id);
		expect(root.querySelector(`[data-tool="${tab.id}"]`).getAttribute('aria-selected')).toBe('true');
	}
	expect(cleanup).toHaveBeenCalledTimes(5);
});
it('opens details explicitly and returns to the same list without destroying its search state', () => {
	const { root, tabs } = mount(); root.querySelector('[data-tool="items"]').click();
	const list = root.querySelector('.catalog-list'); list.scrollTop = 150;
	root.querySelector('[data-catalog-key]').click();
	expect(root.querySelector('.show-detail')).not.toBeNull();
	root.querySelector('[data-back]').click();
	expect(root.querySelector('.show-detail')).toBeNull(); expect(list.scrollTop).toBe(150);
	expect(tabs.find(tab => tab.id === 'items').mount).toHaveBeenCalledOnce();
});
it('cancels a pending confirmation before disposing the feature', () => {
	const { root, cleanup } = mount(); root.querySelector('[data-tool="character"]').click();
	const overlay = document.createElement('div'); overlay.className='ui-confirm';
	overlay.innerHTML='<button data-cancel>取消</button>'; root.append(overlay);
	const cancel=vi.fn(); overlay.querySelector('button').onclick=cancel;
	view.destroy(); expect(cancel).toHaveBeenCalledOnce(); expect(cleanup).toHaveBeenCalledTimes(2);
});
it('routes close without rendering a global feedback bar', () => {
	const { root, close } = mount();
	expect(root.querySelector('.adventure-feedback')).toBeNull();
	root.querySelector('[data-close]').click(); expect(close).toHaveBeenCalledOnce();
});

it('opens current character attributes before choosing another profession', () => {
 const { root } = mount(); root.querySelector('[data-tool="character"]').click();
 expect(root.querySelector('.show-detail')).not.toBeNull();
 expect(root.querySelector('[data-back]').textContent).toBe('选择职业');
 root.querySelector('[data-back]').click();
 expect(root.querySelector('.show-detail')).toBeNull();
});

it('keeps the same window and close control while loading available tabs', () => {
 const root = document.createElement('div'); document.body.append(root);
 const close = vi.fn();
 view = createAdventureToolsView(root, {tabs:[],context:{},close});
 const window = root.querySelector('.game-tools-window');
 const closeButton = root.querySelector('[data-close]');
 expect(root.querySelector('.adventure-loading-message')).not.toBeNull();
 view.setTabs([{id:'maps',label:'地图',mount: container => {container.textContent='地图内容';}}]);
 expect(root.querySelector('.game-tools-window')).toBe(window);
 expect(root.querySelector('[data-close]')).toBe(closeButton);
 expect(root.querySelector('.adventure-loading-message')).toBeNull();
 expect(root.textContent).toContain('地图内容');
 closeButton.click(); expect(close).toHaveBeenCalledOnce();
});

it('places menu return before close and delegates to the parent menu', () => {
 const root = document.createElement('div'); document.body.append(root);
 const close = vi.fn(), backToMenu = vi.fn();
 view = createAdventureToolsView(root, {tabs:[], context:{}, close, backToMenu});
 const back = root.querySelector('[data-menu-back]');
 expect(back.hidden).toBe(false);
 expect(back.nextElementSibling).toBe(root.querySelector('[data-close]'));
 back.click(); expect(backToMenu).toHaveBeenCalledOnce(); expect(close).not.toHaveBeenCalled();
});

it('returns from a drop monster to the same item DOM and destroys suspended views on close', () => {
 const {root,tabs,cleanup}=mount();
 root.querySelector('[data-tool="items"]').click();
 const item=root.querySelector('.game-tools-tab');
 item.querySelector('input').value='123';
 const list=item.querySelector('.catalog-list');list.scrollTop=70;
 const itemContext=tabs.find(tab => tab.id === 'items').mount.mock.calls[0][1];
 itemContext.openMonster(1002);
 expect(view.activeFeature()).toBe('monsters');
 const monsterContext=tabs[1].mount.mock.calls[0][1];
 expect(monsterContext.initialMonsterId).toBe(1002);
 monsterContext.returnToItem();
 expect(root.querySelector('.game-tools-tab')).toBe(item);
 expect(item.querySelector('input').value).toBe('123');
 expect(list.scrollTop).toBe(70);
 expect(tabs.find(tab => tab.id === 'items').mount).toHaveBeenCalledOnce();
 itemContext.openMonster(1039);
 const count=cleanup.mock.calls.length;
 view.destroy();expect(cleanup).toHaveBeenCalledTimes(count+2);
 view=null;
});
