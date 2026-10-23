import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameHUDView } from '../../src/UI/Mobile/game/GameHUDView.js';
import { clearChatFeed, publishChatMessage, subscribeChatFeed } from '../../src/UI/Game/ChatFeed.js';

let host, root, view, actions;
const state = { name: '测试角色', job: '初心者', level: 10, jobLevel: 5, money: 123, hp: 80, maxHp: 100, sp: 20, maxSp: 40, position: [12, 34], mapName: '普隆德拉', statuses: [{ id: 1, title: '加速术', description: '10秒', icon: 'data:image/png;base64,AA==' }] };
beforeEach(() => {
 vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	host = document.createElement('div'); document.body.append(host); root = host.attachShadow({ mode: 'open' });
	actions = { openAdventureMap: vi.fn(), equipmentSnapshot: () => ({ slots: [], stats: [], attachment: {mask:0,label:"",removal:null} }), inventorySnapshot: () => [], cancelSceneInput: vi.fn(), setModal: vi.fn(), sendChat: vi.fn(), returnToCharacters: vi.fn() };
	view = createGameHUDView(root, actions); view.update(state);
});
afterEach(() => {
 vi.unstubAllGlobals(); view.destroy(); host.remove(); clearChatFeed(); vi.restoreAllMocks(); });
const click = selector => root.querySelector(selector).click();

describe('mobile game HUD', () => {
	it('updates live values and details without replacing chat input', () => {
		expect(root.querySelector('[data-hp]').value).toBe(80);
		expect(root.querySelectorAll('[data-status-icons] img')).toHaveLength(1);
		click('[data-panel="profile"]');
		view.update({ ...state, hp: 45 });
		expect(root.querySelector('.panel-body').textContent).toContain('45 / 100');
		click('[data-close]'); click('[data-panel="chat"]'); click('[data-chat-filter="public"]');
		const input = root.querySelector('[aria-label="聊天内容"]'); input.value = '正在输入'; input.focus();
		view.update({ ...state, hp: 30 });
		expect(root.querySelector('[aria-label="聊天内容"]')).toBe(input);
		expect(root.activeElement).toBe(input);
		expect(input.value).toBe('正在输入');
	});
	it('blocks touch and mouse propagation while allowing panel clicks', () => {
		const bubble = vi.fn();
		for (const name of ['pointerdown', 'touchstart', 'touchend', 'click']) window.addEventListener(name, bubble);
		try {
			const button = root.querySelector('[data-panel="menu"]');
			for (const name of ['pointerdown', 'touchstart', 'touchend']) button.dispatchEvent(new Event(name, { bubbles: true, composed: true }));
			button.click();
			expect(bubble).not.toHaveBeenCalled();
			expect(actions.cancelSceneInput).toHaveBeenCalledOnce();
			expect(root.querySelector('.backdrop').hidden).toBe(false);
		} finally { for (const name of ['pointerdown', 'touchstart', 'touchend', 'click']) window.removeEventListener(name, bubble); }
	});
	it('renders messages as text, submits once, and releases modal state on removal', () => {
		click('[data-panel="chat"]'); click('[data-chat-filter="public"]');
		view.setMessages([{ text: '<img src=x onerror=alert(1)>', channel: 'public' }]);
		expect(root.querySelector('.chat-log img')).toBeNull();
		root.querySelector('[aria-label="聊天内容"]').value = '你好';
		root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		expect(actions.sendChat).toHaveBeenCalledExactlyOnceWith('你好', 'public', '');
		view.destroy();
		expect(actions.setModal).toHaveBeenLastCalledWith(false);
		expect(root.childElementCount).toBe(0);
	});
	it('provides touch shortcut buttons and provides menu navigation', () => {
		expect([...root.querySelectorAll('.combat .skill')].every(button => !button.disabled)).toBe(true);
		click('[data-panel="menu"]');
		const buttons = [...root.querySelectorAll('.menu-grid button')];
		expect(buttons.find(button => button.textContent === '背包').disabled).toBe(false);
		buttons.find(button => button.textContent === '背包').click();
		expect(root.querySelector('h2').textContent).toBe('背包');
		expect(root.querySelector('.inventory-list').textContent).toContain('暂无物品');
		view.update(state);
		click('[data-close]');
		click('[data-panel="profile"]');
		expect(root.querySelector('h2').textContent).toBe('人物信息');
		root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(root.querySelector('.backdrop').hidden).toBe(true);
	});
});

it('bounds shared chat history and unsubscribes removed views', () => {
	clearChatFeed();
	for (let i = 0; i < 90; i++) publishChatMessage({ text: String(i) });
	const receive = vi.fn(); const unsubscribe = subscribeChatFeed(receive);
	expect(receive.mock.calls[0][0]).toHaveLength(80);
	expect(receive.mock.calls[0][0][0].text).toBe('10');
	unsubscribe(); publishChatMessage({ text: 'later' });
	expect(receive).toHaveBeenCalledOnce();
	clearChatFeed();
	const next = vi.fn(); const stop = subscribeChatFeed(next);
	expect(next).toHaveBeenCalledWith([]); stop();
});

it('does not dismiss a panel from a pre-existing touch release, but accepts a new backdrop tap', () => {
 click('[data-panel="menu"]');
 const backdrop = root.querySelector('.backdrop');
 const pointer = type => { const event = new Event(type, { bubbles: true }); Object.defineProperty(event, 'pointerId', { value: 7 }); backdrop.dispatchEvent(event); };
 pointer('pointerup'); backdrop.click(); expect(backdrop.hidden).toBe(false);
 pointer('pointerdown'); pointer('pointercancel'); backdrop.click(); expect(backdrop.hidden).toBe(false);
 pointer('pointerdown'); pointer('pointerup'); backdrop.click(); expect(backdrop.hidden).toBe(true);
});

it('opens independent equipment navigation and updates it without affecting the other panels', () => {
 click('[data-panel="menu"]');
 [...root.querySelectorAll('.menu-grid button')].find(button => button.textContent === '装备').click();
 expect(root.querySelector('h2').textContent).toBe('装备');
 expect(root.querySelectorAll('.equipment-tabs button')).toHaveLength(4);
 view.update(state); click('[data-close]');
 expect(actions.setModal).toHaveBeenLastCalledWith(false);
 click('[data-panel="profile"]'); expect(root.querySelector('.panel').classList.contains('equipment-panel')).toBe(false);
});

it('keeps server input and focus during a portrait update and prevents unsupported cancellation', () => {
 const token = {}; const close = vi.fn();
 const npc = { kind: 'npc', token, mode: 'text', canClose: false, lines: ['输入'], close, respond: vi.fn() };
 view.showInteraction(npc); const input = root.querySelector('input'); input.value = '正在输入'; input.focus();
 view.showInteraction({ ...npc, image: 'portrait.bmp' });
 expect(root.querySelector('input')).toBe(input); expect(root.activeElement).toBe(input); expect(input.value).toBe('正在输入');
 view.close(); expect(close).not.toHaveBeenCalled(); expect(root.querySelector('.backdrop').hidden).toBe(false);
 view.showInteraction({ kind: 'npc', token: {}, mode: 'menu', canClose: true, options: [], close });
 click('[data-close]'); expect(close).toHaveBeenCalledOnce(); expect(root.querySelector('.backdrop').hidden).toBe(true);
});


it('groups six skills and combat controls at the bottom right and highlights only the pending skill', () => {
 expect(root.querySelector('.target')).toBeNull();
 expect(root.querySelectorAll('.battle-dock [data-shortcut]')).toHaveLength(6);
 expect(root.querySelector('.battle-dock [data-auto-toggle]')).not.toBeNull();
 view.update({ ...state, autoCombat: { active: true, species: [{ id: 1002, name: '波利' }], status: '攻击：波利' } });
 expect(root.querySelector('[data-auto-target]').textContent).toContain('波利');
 expect(root.querySelector('[data-auto-toggle]').getAttribute('aria-pressed')).toBe('true');
 expect(root.querySelector('[data-auto-toggle]').textContent).toBe('停止战斗');
 view.updateShortcuts({ page: 0, pages: 6, slots: Array.from({ length: 6 }, (_, index) => ({ index, name: '技能', available: true, empty: true })), pending: { index: 2, name: '狂击' } });
 expect(root.querySelectorAll('.selected-skill')).toHaveLength(1);
 expect(root.querySelector('.selected-skill').dataset.shortcut).toBe('2');
 expect(root.querySelector('.skill-prompt').hidden).toBe(false);
 expect(root.querySelector('.skill-actions').hidden).toBe(false);
 expect(root.querySelector('.shortcut-tools').hidden).toBe(true);
 expect(root.querySelector('.skill-actions [data-skill-cancel]')).not.toBeNull();
});

it('opens adventure maps directly from the minimap without mounting the old map panel', () => {
 click('[data-panel="map"]');
 expect(actions.openAdventureMap).toHaveBeenCalledOnce();
 expect(actions.setModal).not.toHaveBeenCalledWith(true);
 expect(root.querySelector('.map-preview')).toBeNull();
});

it('updates AP with the character and hides it when unavailable', () => {
 expect(root.querySelector('[data-ap-row]').hidden).toBe(true);
 view.update({ ...state, ap: 75, maxAp: 200 });
 expect(root.querySelector('[data-ap-row]').hidden).toBe(false);
 expect(root.querySelector('[data-ap]').value).toBe(75);
 expect(root.querySelector('[data-ap]').max).toBe(200);
 expect(root.querySelector('[data-ap-text]').textContent).toBe('75 / 200');
 view.update({ ...state, ap: 0, maxAp: 0 });
 expect(root.querySelector('[data-ap-row]').hidden).toBe(true);
});

it('uses the same low HP threshold as the character gauge', () => {
 view.update({ ...state, hp: 24, maxHp: 100 });
 expect(root.querySelector('[data-hp]').classList.contains('low-hp')).toBe(true);
 view.update({ ...state, hp: 25, maxHp: 100 });
 expect(root.querySelector('[data-hp]').classList.contains('low-hp')).toBe(false);
});

it('shows status titles beside live descriptions and preserves selection until expiry', () => {
 view.update({...state,statuses:[{id:1,title:'加速术',description:'提升移动速度',seconds:10},{id:2,title:'天使之赐福',description:'提升属性',seconds:20}]});
 click('[data-panel="status"]');
 expect(root.querySelector('.inventory-list').textContent).toBe('加速术10秒天使之赐福20秒');
 click('[data-status="2"]');const node=root.querySelector('[data-status="2"]');
 view.update({...state,statuses:[{id:1,title:'加速术',description:'提升移动速度',seconds:9},{id:2,title:'天使之赐福',description:'提升属性',seconds:19}]});
 expect(root.querySelector('[data-status="2"]')).toBe(node);
 expect(node.getAttribute('aria-pressed')).toBe('true');
 expect(root.querySelector('.inventory-detail').textContent).toBe('提升属性');
 view.update({...state,statuses:[{id:1,title:'加速术',description:'提升移动速度',seconds:8}]});
 expect(root.querySelector('.inventory-detail').textContent).toBe('提升移动速度');
 view.update({...state,statuses:[]});expect(root.querySelector('.inventory-detail').textContent).toBe('当前没有状态效果');
});

it.each([[2000000,'34m'],[1200000,'20m'],[1000000,'17m'],[999000,'999'],[1000,'1'],[1,'1'],[60000000,'999m'],[0,null]])('formats shortcut cooldown %s without overflowing', (cooldown, expected) => {
 view.updateShortcuts({page:0,pages:1,slots:[{index:0,name:'技能',available:false,empty:false,cooldown}]});
 const timer=root.querySelector('.slot-cooldown');
 expect(timer?.textContent ?? null).toBe(expected);
});

it('returns from submenus and keeps shop messages out of menu buttons', () => {
 click('[data-panel="status"]');expect(root.querySelector('[data-back]').hidden).toBe(false);
 click('[data-back]');expect(root.querySelector('.panel').dataset.view).toBe('menu');expect(root.querySelector('[data-back]').hidden).toBe(true);
 actions.showOwnedVending=()=>false;
 const button=[...root.querySelectorAll('button')].find(b=>b.textContent==='我的摊位');button.click();
 expect(button.textContent).toBe('我的摊位');expect(document.querySelector('.ui-toast').textContent).toContain('尚未开店');
});
it('confirms returning to characters with the shared modal', () => {
 click('[data-panel="menu"]');
 const button=[...root.querySelectorAll('button')].find(b=>b.textContent==='返回选角');button.click();
 expect(actions.returnToCharacters).not.toHaveBeenCalled();expect(root.querySelector('dialog.ui-confirm').open).toBe(true);
 root.querySelector('dialog [data-cancel]').click();expect(actions.returnToCharacters).not.toHaveBeenCalled();
 button.click();root.querySelector('dialog [data-confirm]').click();expect(actions.returnToCharacters).toHaveBeenCalledOnce();
});

it('exposes chat preview and counts each private message once until chat is opened', () => {
 expect(root.querySelector('.chat-preview').hidden).toBe(false);
 const messages = [{id:1,text:'你好',channel:'private',incomingPrivate:true,privatePeer:'朋友'}];
 view.setMessages(messages); view.setMessages(messages);
 expect(root.querySelector('[data-chat-unread]').textContent).toBe('1');
 click('[data-panel="chat"]');
 expect(root.querySelector('[data-chat-unread]').hidden).toBe(true);
 expect(root.querySelector('.backdrop').classList.contains('chat-backdrop')).toBe(true);
 expect(root.querySelector('[data-back]').hidden).toBe(true);
 click('[data-close]'); click('[data-panel="menu"]');
 expect(root.querySelector('.backdrop').classList.contains('chat-backdrop')).toBe(false);
});

it('keeps chat open after submission while retaining failed drafts', () => {
 click('[data-panel="chat"]'); click('[data-chat-filter="public"]');
 const input=root.querySelector('[aria-label="聊天内容"]'); input.value='你好';
 actions.sendChat.mockReturnValueOnce('当前不能发送消息');
 root.querySelector('form').requestSubmit();
 expect(root.querySelector('.backdrop').hidden).toBe(false);
 expect(input.value).toBe('你好');
 actions.sendChat.mockReturnValueOnce('');
 root.querySelector('form').requestSubmit();
 expect(root.querySelector('.backdrop').hidden).toBe(false);
 expect(input.value).toBe('');
});

it('remembers collapsed chat previews and retains unread messages until chat opens', () => {
 click('[data-chat-collapse]');
 expect(root.querySelector('.chat-preview-open').hidden).toBe(true);
 expect(root.querySelector('.backdrop').hidden).toBe(true);
 view.setMessages([{id:1,text:'私聊消息',channel:'private',incomingPrivate:true,privatePeer:'朋友'}]);
 expect(root.querySelector('[data-chat-expand] [data-chat-unread]').textContent).toBe('1');
 view.destroy(); view=createGameHUDView(root,actions);
 expect(root.querySelector('[data-chat-expand]').hidden).toBe(false);
 view.setMessages([{id:1,text:'私聊消息',channel:'private',incomingPrivate:true,privatePeer:'朋友'}]);
 click('[data-chat-expand]');
 expect(root.querySelector('.chat-preview-open').hidden).toBe(false);
 expect(root.querySelector('[data-chat-unread]').hidden).toBe(false);
 expect(root.querySelector('[data-chat-preview]').textContent).toContain('私聊消息');
 click('[data-panel="chat"]');
 expect(root.querySelector('[data-chat-unread]').hidden).toBe(true);
 localStorage.removeItem('ChatPreview');
});

it('keeps full chat filtering independent from preview categories and remembers it on reopen', () => {
 const messages = [{id:1,text:'附近消息',channel:'public'}, {id:2,text:'私聊消息',bodyText:'私聊消息',direction:'incoming',channel:'private',privatePeer:'朋友'}];
 view.setMessages(messages);
 click('[data-panel="chat"]');
 const choose = value => root.querySelector(`[data-chat-filter="${value}"]`).click();
 choose('private');
 root.querySelector('.chat-contact-list button').click();
 expect(root.querySelector('[data-chat-preview]').textContent).toContain('附近消息');
 expect(root.querySelector('.chat-log').textContent).toBe('喵：私聊消息');
 click('[data-close]');
 view.setMessages([...messages, {id:3,text:'新附近消息',channel:'public'}, {id:4,text:'新私聊消息',bodyText:'新私聊消息',direction:'incoming',channel:'private',privatePeer:'朋友'}]);
 expect(root.querySelector('[data-chat-preview]').textContent).toContain('附近');
 expect(root.querySelector('[data-chat-preview]').textContent).toContain('新私聊消息');
 click('[data-panel="chat"]');
 expect(root.querySelector('[data-chat-filter="private"]').getAttribute('aria-pressed')).toBe('true');
 choose('guild');
 expect(root.querySelector('.chat-log').textContent).not.toContain('新附近消息');
 choose('all');
 expect(root.querySelector('[data-chat-preview]').textContent).toContain('新附近消息');
});

it('keeps NPC close controls consistent and ignores backdrop dismissal', () => {
 const close=vi.fn();
 view.showInteraction({kind:'npc',mode:'next',token:{},lines:['你好'],respond:vi.fn(),canClose:false,close});
 expect(root.querySelector('[data-close]').disabled).toBe(true);expect(root.querySelector('[data-back]').hidden).toBe(true);
 view.showInteraction({kind:'npc',mode:'close',token:{},lines:['再见'],respond:vi.fn(),canClose:true,close});
 expect(root.querySelector('[data-close]').disabled).toBe(false);
 const backdrop=root.querySelector('.backdrop');
 for(const type of ['pointerdown','pointerup'])backdrop.dispatchEvent(new MouseEvent(type,{bubbles:true}));
 backdrop.click();expect(close).not.toHaveBeenCalled();expect(backdrop.hidden).toBe(false);
 click('[data-close]');expect(close).toHaveBeenCalledOnce();
});

it('rejects a trailing scene click but accepts a fresh press on the NPC close button', () => {
 const close=vi.fn();view.showInteraction({kind:'npc',token:{},mode:'close',canClose:true,lines:['你好'],close});
 const button=root.querySelector('[data-close]');
 button.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1,cancelable:true}));
 expect(close).not.toHaveBeenCalled();expect(root.querySelector('.backdrop').hidden).toBe(false);
 button.dispatchEvent(new Event('pointerdown',{bubbles:true}));
 button.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1,cancelable:true}));
 expect(close).toHaveBeenCalledOnce();
});
it('hides menu navigation for NPC-owned information and selection windows', () => {
 view.showInteraction({kind:'information',token:{},title:'测试 NPC',rows:[]});
 expect(root.querySelector('[data-back]').hidden).toBe(true);
});

it('hides the close button while the server requires a response and restores it afterwards', () => {
 view.showInteraction({kind:'npc',token:{},mode:'next',canClose:false,lines:['继续'],respond:vi.fn()});
 expect(root.querySelector('[data-close]').hidden).toBe(true);
 view.showInteraction({kind:'npc',token:{},mode:'close',canClose:true,lines:['结束'],respond:vi.fn()});
 expect(root.querySelector('[data-close]').hidden).toBe(false);
});

it('preserves server dialogs and local menus across browser suspension', () => {
 const close=vi.fn();view.showInteraction({kind:'npc',token:{},mode:'menu',options:[],canClose:true,lines:['选择'],close});
 view.suspend();expect(close).not.toHaveBeenCalled();expect(root.querySelector('.backdrop').hidden).toBe(false);
 view.showInteraction(null);click('[data-panel="menu"]');view.suspend();expect(root.querySelector('.backdrop').hidden).toBe(false);
});


it('opens standalone camera controls next to status and clears transparent styling on other panels', () => {
 actions.camera=vi.fn();
 expect([...root.querySelectorAll('.profile-actions [data-panel]')].map(node => node.dataset.panel)).toEqual(['menu', 'quests', 'chat', 'camera']);
 click('[data-panel=camera]');
 expect(root.querySelector('h2').textContent).toBe('镜头');
 expect(root.querySelector('.backdrop').classList.contains('camera-backdrop')).toBe(true);
 expect(root.querySelector('[data-back]').hidden).toBe(true);
 const buttons=[...root.querySelectorAll('.camera-section button')];
 for(const button of buttons)button.click();
 expect(actions.camera.mock.calls).toEqual([['reset'],['left'],['right'],['zoomIn'],['zoomOut'],['up'],['down']]);
 expect(actions.setModal).toHaveBeenLastCalledWith(true);
 click('[data-close]');expect(actions.setModal).toHaveBeenLastCalledWith(false);
 click('[data-panel=status]');expect(root.querySelector('.backdrop').classList.contains('camera-backdrop')).toBe(false);
 expect(root.querySelector('.camera-section')).toBeNull();
});

it('returns from the menu map through its supplied back action', () => {
 click('[data-panel="menu"]');
 [...root.querySelectorAll('.menu-grid button')].find(button=>button.textContent==='地图').click();
 const back=actions.openAdventureMap.mock.lastCall[1];
 expect(back).toBeTypeOf('function');back();
 expect(root.querySelector('.panel').dataset.view).toBe('menu');
 expect(root.querySelector('.backdrop').hidden).toBe(false);
});
it('closes a menu bank interaction before returning to the menu', () => {
 const close=vi.fn();
 const service={setOperationGuard:vi.fn(),snapshot:()=>({allowed:true,wallet:10,bank:20,depositMax:10,withdrawMax:20})};
 view.showInteraction({kind:'bank',token:{},service,close,canClose:true});
 expect(root.querySelector('[data-back]').hidden).toBe(false);
 click('[data-back]');expect(close).toHaveBeenCalledOnce();
 expect(root.querySelector('.panel').dataset.view).toBe('menu');
});

it('preserves local drafts and scroll position without releasing the modal on suspension', () => {
 click('[data-panel="chat"]');
 const input=root.querySelector('[aria-label="聊天内容"]');input.value='未发送的草稿';
 const body=root.querySelector('.panel-body');body.scrollTop=75;
 actions.setModal.mockClear();view.suspend();view.suspend();view.update({...state,hp:35});
 expect(root.querySelector('[aria-label="聊天内容"]')).toBe(input);
 expect(input.value).toBe('未发送的草稿');expect(body.scrollTop).toBe(75);
 expect(root.querySelector('.backdrop').hidden).toBe(false);expect(actions.setModal).not.toHaveBeenCalled();
 click('[data-close]');expect(root.querySelector('.backdrop').hidden).toBe(true);
 expect(actions.setModal).toHaveBeenCalledWith(false);
});
it.each(['held','released'])('discards a %s backdrop gesture across suspension', phase => {
 click('[data-panel="menu"]');const backdrop=root.querySelector('.backdrop');
 const pointer=type=>{const event=new Event(type,{bubbles:true});Object.defineProperty(event,'pointerId',{value:7});backdrop.dispatchEvent(event);};
 pointer('pointerdown');if(phase==='released')pointer('pointerup');view.suspend();
 if(phase==='held')pointer('pointerup');backdrop.click();expect(backdrop.hidden).toBe(false);
 pointer('pointerdown');pointer('pointerup');backdrop.click();expect(backdrop.hidden).toBe(true);
});

it('classifies item icons separately and clears the classification when a slot changes', () => {
 const update=binding=>view.updateShortcuts({page:0,pages:1,slots:[{index:0,name:'条目',available:true,empty:!binding,binding,amount:'1'}]});
 const slot=root.querySelector('[data-shortcut="0"]');
 update({isSkill:false,ID:501});expect(slot.dataset.shortcutKind).toBe('item');
 update({isSkill:true,ID:1});expect(slot.dataset.shortcutKind).toBe('skill');
 update(null);expect(slot.dataset.shortcutKind).toBe('empty');
});

it('shows ordered player actions instead of combat status only for player targets',()=>{
 actions.playerAction=vi.fn();view.update({...state,target:{interaction:'交易',player:{id:42,name:'玩家',friend:false}}});
 expect(root.querySelector('[data-target]').hidden).toBe(true);expect(root.querySelector('[data-interact]').hidden).toBe(true);
 expect([...root.querySelectorAll('[data-player-action]')].map(el=>el.textContent)).toEqual(['私聊','装备','好友','交易']);
 click('[data-player-action=private]');expect(actions.playerAction).toHaveBeenCalledWith('private',42);
 actions.playerAction.mockReturnValue('目标已离开');click('[data-player-action=equipment]');expect(document.querySelector('.ui-toast').textContent).toBe('目标已离开');
 view.update({...state,target:{player:{id:42,name:'玩家',friend:true}}});expect(root.querySelector('[data-player-action=friend]').disabled).toBe(true);expect(root.querySelector('[data-player-action=friend]').textContent).toBe('好友');
 view.update({...state,target:{interaction:'进入'}});expect(root.querySelector('[data-player-actions]').hidden).toBe(true);expect(root.querySelector('[data-interact]').hidden).toBe(false);
});

it('confirms a trade once with the captured player identity and acknowledges friend requests',()=>{
 actions.playerAction=vi.fn(()=> '');
 view.update({...state,target:{player:{id:42,name:'玩家'}}});
 click('[data-player-action=friend]');
 expect(document.querySelector('.ui-toast').textContent).toBe('已发好友请求');
 click('[data-player-action=trade]');
 expect(root.querySelectorAll('dialog.ui-confirm')).toHaveLength(1);
 expect(actions.playerAction).not.toHaveBeenCalledWith('trade',42);
 view.update({...state,target:{player:{id:43,name:'另一位'}}});
 click('dialog [data-confirm]');
 expect(actions.playerAction).toHaveBeenCalledWith('trade',42);
 expect(root.querySelector('dialog')).toBeNull();
});

it('replaces auto combat with cancel selection for another player',()=>{
 actions.clearPlayerSelection=vi.fn();actions.toggleAutoCombat=vi.fn();
 view.update({...state,target:{player:{id:42,name:'玩家'}},autoCombat:{active:true}});
 expect(root.querySelector('[data-auto-toggle]').textContent).toBe('取消选择');
 expect(root.querySelector('[data-auto-toggle]').classList.contains('clear-selection')).toBe(true);
 expect(root.querySelector('[data-auto-toggle]').getAttribute('aria-pressed')).toBe('false');
 click('[data-auto-toggle]');expect(actions.clearPlayerSelection).toHaveBeenCalledOnce();expect(actions.toggleAutoCombat).not.toHaveBeenCalled();
 view.update(state);expect(root.querySelector('[data-auto-toggle]').textContent).toBe('自动战斗');
 expect(root.querySelector('[data-auto-toggle]').classList.contains('clear-selection')).toBe(false);
 click('[data-auto-toggle]');expect(actions.toggleAutoCombat).toHaveBeenCalledOnce();
});

it('dismisses the chat modal after sending an emotion command', () => {
 click('[data-panel="chat"]');click('[data-chat-filter="public"]');
 const input = root.querySelector('[aria-label="聊天内容"]');
 input.value = '/lv';
 root.querySelector('.chat-form').dispatchEvent(new Event('submit', {cancelable: true}));
 expect(actions.sendChat).toHaveBeenCalledWith('/lv', 'public', '');
 expect(root.querySelector('.backdrop').hidden).toBe(true);
 expect(actions.setModal).toHaveBeenLastCalledWith(false);
});

it('renders every status and opens the tapped effect while retaining nodes across ticks', () => {
 const statuses = Array.from({length: 13}, (_, i) => ({id: i + 1, title: `状态${i + 1}`, description: `说明${i + 1}`, seconds: 30, icon: state.statuses[0].icon}));
 view.update({...state, statuses});
 expect(root.querySelectorAll('.status-effect')).toHaveLength(13);
 const button = root.querySelector('[data-effect="11"]');
 button.click();
 expect(root.querySelector('.inventory-detail').textContent).toBe('说明11');
 view.update({...state, statuses: statuses.map(s => ({...s, seconds: 29}))});
 expect(root.querySelector('[data-effect="11"]')).toBe(button);
 expect(button.getAttribute('aria-label')).toBe('状态11 · 29秒');
 view.update({...state, statuses: []});
 expect(root.querySelectorAll('.status-effect')).toHaveLength(0);
});
