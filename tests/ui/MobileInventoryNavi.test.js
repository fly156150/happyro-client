import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ end: null, openMap: vi.fn(), openMonster: vi.fn(), teleport: vi.fn(() => true), getState: vi.fn(() => ({ connectionReady:true,canTeleport: true, allowed: true, supportedMap: true })) }));
vi.mock('UI/Platform.js', () => ({ default: { isMobile: true } }));
vi.mock('Network/ConnectionLifecycle.js', () => ({ onConnectionEnd: fn => { state.end = fn; } }));
vi.mock('UI/Components/GameTools/AdventureActionService.js', () => ({ getAdventureActionState: state.getState, teleportToCoordinate: state.teleport }));
import manifest from '../../src/DB/Navigation/NaviTargets.json';
vi.mock('UI/Mobile/game/AdventureTools.js', () => ({default:state}));
import { createInventoryPanel } from '../../src/UI/Mobile/game/InventoryPanel.js';
import { contrastRatio } from '../../src/Utils/ReadableText.js';
import { createInventoryDescription } from '../../src/UI/Mobile/game/InventoryDescription.js';
const [key, target] = Object.entries(manifest.entries).find(([, entry]) => entry.kind === 'coordinate');
const markup = `<NAVI>^4D4DFF目标^000000<INFO>${key}</INFO></NAVI>`;
const render = (descriptionMarkup, sockets = []) => document.body.appendChild(createInventoryDescription({ index: 2, ID: 2033, name: '装备', count: 1, identified: true, descriptionMarkup, sockets }, async () => null));
beforeEach(() => { vi.clearAllMocks(); state.end(); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { state.end(); document.body.replaceChildren(); vi.unstubAllGlobals(); });
it('renders a colored live item NAVI safely and opens its reviewed target in the map without teleporting', async () => {
 const node = render(`说明\n${markup}\n<img src=x onerror=alert(1)>\n^777777重量：7^000000`);
 expect(node.querySelector('img')).toBeNull();
 expect(node.querySelector('.inventory-item-media').textContent).toBe('数量：1重量：7');
 expect(node.querySelector('.item-description').textContent).toContain('<img src=x onerror=alert(1)>');
 expect(node.querySelector('.item-description').textContent).not.toContain('<NAVI>');
 const link = node.querySelector('.navi-link');
 expect(link.dataset.naviInfo).toBe(key);
 link.firstElementChild.click();
 await vi.waitFor(() => expect(state.openMap).toHaveBeenCalledWith(expect.objectContaining({mapName:target.mapName,x:target.x,y:target.y}),undefined,expect.any(Function)));
 expect(state.teleport).not.toHaveBeenCalled();
 expect(fetch).not.toHaveBeenCalled();
});
it('opens socket navigation in the ordinary map too', async () => {
 const node = render('普通说明', [{ kind: 'card', slot: 1, name: '卡片', descriptionMarkup: markup }]);
 node.querySelector('details').open = true;
 node.querySelector('.navi-link span').click();
 await vi.waitFor(() => expect(state.openMap).toHaveBeenCalledOnce());
 expect(state.teleport).not.toHaveBeenCalled();
});
it('rejects unknown item NAVI without sending and preserves ordinary description text and spacing', () => {
 const node = render('普通物品\n____\n\n重量：3\n携带重量增加10%。\n<NAVI>未知<INFO>unknown_map,1,1</INFO></NAVI>');
 expect(node.querySelector('.item-description').textContent).toBe('普通物品\n\n携带重量增加10%。\n未知');
 expect(node.querySelector('.navi-link')).toBeNull();
 node.querySelector('[data-navi-info]').click();
 expect(state.teleport).not.toHaveBeenCalled();
 expect(state.openMap).not.toHaveBeenCalled();
});

it('corrects ordinary colored item text after mounting on the dark inventory surface', () => {
 const body = document.body.appendChild(document.createElement('div'));
 body.style.backgroundColor = 'rgb(25, 33, 42)';
 createInventoryPanel(body, { snapshot: () => [{ index: 2, ID: 2033, name: '装备', count: 1, identified: true, descriptionMarkup: '^777777属性说明^000000' }], preview: async () => null });
 body.querySelector('[data-index="2"]').click();
 const span = body.querySelector('.item-description span');
 const rgb = getComputedStyle(span).color.match(/\d+/g).map(Number);
 expect(contrastRatio(rgb, [25, 33, 42])).toBeGreaterThanOrEqual(4.5);
 expect(span.textContent).toBe('属性说明');
});
