import { afterEach, expect, it, vi } from 'vitest';
vi.mock('DB/DBManager.js', () => ({ default: {} }));
vi.mock('Renderer/Renderer.js', () => ({ default: {} }));
vi.mock('Core/Client.js', () => ({ default: {} }));
vi.mock('Core/Events.js', () => ({ default: {} }));
vi.mock('Core/Preferences.js', () => ({ default: { get: (_key, defaults) => defaults } }));
vi.mock('Controls/KeyEventHandler.js', () => ({ default: {} }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: {} }));
vi.mock('UI/CursorManager.js', () => ({ default: {} }));
vi.mock('Controls/BattleMode.js', () => ({ default: {} }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: component => component } }));
vi.mock('UI/GUIComponent.js', () => ({ default: class { static MouseMode = { CROSS: 0 }; constructor() { this._host = null; this._shadow = null; } } }));
vi.mock('UI/Elements/Elements.js', () => ({}));
vi.mock('UI/Components/ContextMenu/ContextMenu.js', () => ({ default: {} }));
vi.mock('Controls/ProcessCommand.js', () => ({ default: {} }));
vi.mock('UI/Platform.js', () => ({ default: {} }));
vi.mock('UI/Components/ChatBoxSettings/ChatBoxSettings.js', () => ({ default: { tabOption: [[0]] } }));
vi.mock('Core/Configs.js', () => ({ default: {} }));
vi.mock('Renderer/EntityManager.js', () => ({ default: {} }));
import ChatBox from '../../src/UI/Components/ChatBox/ChatBox.js';
import { publishChatMessage, subscribeChatFeed, clearChatFeed } from '../../src/UI/Game/ChatFeed.js';
afterEach(() => {
 ChatBox._host = null; ChatBox._shadow = null; ChatBox.tabs = [];
 clearChatFeed(); vi.unstubAllGlobals(); document.body.replaceChildren();
});
it('clears account chat before the desktop view has ever been mounted', () => {
 const listener = vi.fn(); const unsubscribe = subscribeChatFeed(listener);
 try {
  publishChatMessage({ text: 'previous account' });
  expect(() => ChatBox.clean()).not.toThrow();
  expect(listener).toHaveBeenLastCalledWith([]);
  expect(ChatBox._host).toBeNull();
 } finally { unsubscribe(); }
});
it('clears mounted chat, input and queued messages before another account can see them', () => {
 let flush;
 vi.stubGlobal('requestAnimationFrame', callback => { flush = callback; });
 vi.stubGlobal('URL', { revokeObjectURL: vi.fn() });
 const root = document.body.appendChild(document.createElement('div'));
 root.innerHTML = '<div class="content" data-content="0"><a href="blob:old-account">old</a></div><div class="input-chatbox">draft</div><div class="input"><input class="username" value="old name"></div>';
 ChatBox._shadow = root; ChatBox.tabs = [{ name: 'public' }];
 ChatBox.addText('queued from previous account', ChatBox.TYPE.PUBLIC, 0);
 ChatBox.clean();
 expect(root.querySelector('.content').textContent).toBe('');
 expect(root.querySelector('.input-chatbox').textContent).toBe('');
 expect(root.querySelector('.username').value).toBe('');
 expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:old-account');
 flush();
 expect(root.querySelector('.content').textContent).toBe('');
});
