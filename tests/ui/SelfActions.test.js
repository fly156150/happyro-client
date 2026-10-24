import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const s = vi.hoisted(() => ({ session: {}, focus: null, load: vi.fn(), mutate: vi.fn(), send: vi.fn() }));
vi.mock('Engine/SessionStorage.js', () => ({ default: s.session }));
vi.mock('Renderer/EntityManager.js', () => ({ default: { getFocusEntity: () => s.focus } }));
vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: s.send } }));
vi.mock('Network/PacketStructure.js', () => ({ default: { CZ: { REQUEST_ACT2: class {}, REQ_EMOTION: class {} } } }));
vi.mock('UI/Components/GameTools/AdventureControlService.js', () => ({ loadCurrentCharacter: s.load, maintainCurrentCharacter: s.mutate }));
vi.mock('../../src/UI/Game/ChatEmotionImages.js', () => ({ loadChatEmotionImages: async () => ({}) }));
import { createSelfActions } from '../../src/UI/Game/SelfActions.js';
let parent, view, root, stop;
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
const mount = active => ({ kind: 'peco', active, fee: 2500, ticket: false, reason: '' });
beforeEach(() => {
 vi.clearAllMocks();
 s.session.Entity = { display: { name: '自己' }, ACTION: { SIT: 2, DIE: 1 }, action: 0 };
 s.session.Playing = true; s.session.FreezeUI = false; s.focus = null;
 s.load.mockResolvedValue({ riding: [mount(false)] });
 s.mutate.mockResolvedValue({ riding: [mount(true)] });
 parent = document.body.appendChild(document.createElement('div')); stop = vi.fn();
 view = createSelfActions(parent, stop); root = parent.firstChild.shadowRoot;
});
afterEach(() => { view.destroy(); parent.remove(); });
async function select() { s.focus = s.session.Entity; view.update(); await flush(); }
it('only shows on self selection and uses live sit state', async () => {
 view.update(); expect(parent.firstChild.hidden).toBe(true); expect(s.load).not.toHaveBeenCalled();
 await select(); root.querySelector('[data-sit]').click();
 expect(stop).toHaveBeenCalledOnce(); expect(s.send).toHaveBeenLastCalledWith(expect.objectContaining({ action: 2 }));
 s.session.Entity.action = 2; view.update();
 expect(root.querySelector('[data-sit]').textContent).toBe('站起');
 root.querySelector('[data-sit]').click(); expect(s.send).toHaveBeenLastCalledWith(expect.objectContaining({ action: 3 }));
 s.focus = null; view.update(); expect(parent.firstChild.hidden).toBe(true);
 root.querySelector('[data-sit]').click(); expect(s.send).toHaveBeenCalledTimes(2);
});
it('uses adventure riding directly, prevents duplicate writes and updates to dismount', async () => {
 await select(); const button = root.querySelector('[data-mount]');
 button.click(); button.click(); await flush();
 expect(s.mutate).toHaveBeenCalledExactlyOnceWith('character.riding.update', { kind: 'peco', enabled: true, fee: 2500, ticket: false });
 expect(button.textContent).toBe('下骑');
 s.load.mockResolvedValue({ riding: [mount(true)] });
 s.mutate.mockResolvedValue({ riding: [mount(false)] });
 button.click(); await flush();
 expect(s.mutate).toHaveBeenLastCalledWith('character.riding.update', expect.objectContaining({ enabled: false }));
 expect(button.textContent).toBe('骑乘');
});
it('shows eligible mounts with unmet conditions and does not offer followers as mounts', async () => {
 s.load.mockResolvedValue({ riding: [{ kind: 'falcon', active: true }, { ...mount(false), reason: 'riding_skill_required' }] });
 await select(); const button = root.querySelector('[data-mount]');
 expect(button.hidden).toBe(false); expect(button.disabled).toBe(false);
 button.click(); await flush();
 expect(root.querySelector('p').textContent).toBe('需要学习「骑乘术」技能 Lv.1');
 expect(s.mutate).not.toHaveBeenCalled();
 s.load.mockResolvedValue({ riding: [mount(false)] });
 button.click(); await flush(); expect(s.mutate).toHaveBeenCalledOnce();
});
it('rejects stale selection and changed mount state before sending', async () => {
 await select(); s.load.mockResolvedValue({ riding: [mount(true)] });
 root.querySelector('[data-mount]').click(); await flush(); expect(s.mutate).not.toHaveBeenCalled();
 expect(root.querySelector('p').textContent).toContain('状态已变化');
 let resolve; s.load.mockImplementation(() => new Promise(r => { resolve = r; }));
 root.querySelector('[data-mount]').click(); s.focus = null; view.update();
 resolve({ riding: [mount(true)] }); await flush(); expect(s.mutate).not.toHaveBeenCalled();
});
it('sends a native expression and hides all controls on death', async () => {
 await select(); root.querySelector('[data-emotions]').click(); await flush();
 root.querySelector('[data-emotion="!"]').click();
 expect(s.send).toHaveBeenLastCalledWith(expect.objectContaining({ type: 0 }));
 expect(root.querySelector('.emotions').hidden).toBe(true);
 s.session.Entity.action = 1; view.update(); expect(parent.firstChild.hidden).toBe(true);
 root.querySelector('[data-sit]').click(); expect(s.send).toHaveBeenCalledOnce();
});
it('ignores async results after map teardown', async () => {
 let resolve; s.load.mockImplementation(() => new Promise(r => { resolve = r; }));
 s.focus = s.session.Entity; view.update(); view.destroy();
 resolve({ riding: [mount(true)] }); await flush(); expect(parent.childElementCount).toBe(0);
});

it.each([false, true])('keeps the mount button during server state refresh (desktop=%s)', async desktop => {
 view.destroy(); view = createSelfActions(parent, stop, { desktop }); root = parent.firstChild.shadowRoot;
 await select();
 const button = root.querySelector('[data-mount]');
 button.click(); await flush();
 expect(button.textContent).toBe('下骑');
 let resolve; s.load.mockImplementation(() => new Promise(r => { resolve = r; }));
 s.session.Entity.effectState = 0x20; view.update();
 expect(button.hidden).toBe(false); expect(button.disabled).toBe(false);
 expect(button.getAttribute('aria-busy')).toBe('true');
 expect(button.getAttribute('aria-disabled')).toBe('true');
 const calls = s.mutate.mock.calls.length; button.click(); expect(s.mutate).toHaveBeenCalledTimes(calls);
 expect(button.textContent).toBe('下骑');
 resolve({ riding: [mount(true)] }); await flush();
 expect(button.hidden).toBe(false); expect(button.disabled).toBe(false);
 s.mutate.mockResolvedValue({ riding: [mount(false)] });
 s.load.mockResolvedValue({ riding: [mount(true)] }); button.click(); await flush();
 expect(button.textContent).toBe('骑乘');
 s.load.mockImplementation(() => new Promise(r => { resolve = r; }));
 s.session.Entity.effectState = 0; view.update();
 expect(button.hidden).toBe(false); expect(button.textContent).toBe('骑乘');
 resolve({ riding: [mount(false)] }); await flush(); expect(button.hidden).toBe(false);
});

it.each([false, true])('reveals all available controls together after initial loading (desktop=%s)', async desktop => {
 view.destroy(); view = createSelfActions(parent, stop, { desktop }); root = parent.firstChild.shadowRoot;
 let resolve; s.load.mockImplementation(() => new Promise(r => { resolve = r; }));
 s.focus = s.session.Entity; view.update();
 expect(parent.firstChild.hidden).toBe(true);
 view.update(); expect(parent.firstChild.hidden).toBe(true);
 resolve({ riding: [mount(false)] }); await flush();
 expect(parent.firstChild.hidden).toBe(false);
 expect(root.querySelector('[data-mount]').hidden).toBe(false);
 expect(root.querySelectorAll('.actions button:not([hidden])')).toHaveLength(3);
});
it('still offers local actions when initial mount lookup fails', async () => {
 s.load.mockRejectedValue(new Error('读取失败'));
 await select(); expect(parent.firstChild.hidden).toBe(false);
 expect(root.querySelector('[data-mount]').hidden).toBe(true);
 expect(root.querySelector('p').textContent).toBe('读取失败');
});

it('keeps desktop controls visible without selecting self and preserves actions when another entity is focused', async () => {
 view.destroy(); view = createSelfActions(parent, stop, { desktop: true }); root = parent.firstChild.shadowRoot;
 view.update(); await flush();
 expect(parent.firstChild.hidden).toBe(false);
 expect(root.querySelector('.actions').firstElementChild.hasAttribute('data-emotions')).toBe(true);
 expect(root.querySelector('[data-sit] svg')).not.toBeNull();
 s.focus = { GID: 123 }; view.update();
 expect(parent.firstChild.hidden).toBe(false);
 root.querySelector('[data-sit]').click();
 expect(s.send).toHaveBeenLastCalledWith(expect.objectContaining({ action: 2 }));
 s.session.Entity.action = 2; view.update();
 expect(root.querySelector('[data-sit]').getAttribute('aria-label')).toBe('站起');
 expect(root.querySelector('[data-sit]').getAttribute('aria-pressed')).toBe('true');
 s.session.Playing = false; view.update();
 expect(parent.firstChild.hidden).toBe(true);
});

it.each([false, true])('refreshes eligibility on click after Zeny changes (desktop=%s)', async desktop => {
 view.destroy(); view = createSelfActions(parent, stop, { desktop }); root = parent.firstChild.shadowRoot;
 s.load.mockResolvedValue({ riding: [{ ...mount(false), reason: 'riding_insufficient_zeny' }] });
 await select(); const button = root.querySelector('[data-mount]');
 expect(button.hidden).toBe(false); button.click(); await flush();
 expect(root.querySelector('p').textContent).toBe('Zeny 不足'); expect(s.mutate).not.toHaveBeenCalled();
 s.load.mockResolvedValue({ riding: [mount(false)] }); button.click(); await flush();
 expect(s.mutate).toHaveBeenCalledOnce();
});
it('hides riding when the new job has no mount', async () => {
 await select(); s.load.mockResolvedValue({ riding: [{kind: 'falcon', active: true}] });
 s.session.Entity._job = 3; view.update(); await flush();
 expect(root.querySelector('[data-mount]').hidden).toBe(true);
});
