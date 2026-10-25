import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const s=vi.hoisted(()=>({session:{Playing:true,hasParty:false,hasGuild:false,hasClan:false},send:vi.fn()}));
vi.mock('Engine/SessionStorage.js',()=>({default:s.session}));
vi.mock('UI/Components/ChatBox/ChatBox.js',()=>({default:{addText:vi.fn(),TYPE:{PRIVATE:4,SELF:1,ERROR:64},FILTER:{PUBLIC_LOG:0,PUBLIC_CHAT:1,WHISPER:2,PARTY:3,GUILD:4,CLAN:21,ITEM:5,PARTY_ITEM:8,BATTLE:15,PARTY_BATTLE:16,EXP:17,PARTY_EXP:18}}}));
import {createGameChat,chatChannel,isIncomingPrivateMessage} from '../../src/UI/Game/GameChat.js';
import {createChatPanel,createChatComposer} from '../../src/UI/Mobile/game/ChatPanel.js';
import {createMobileInputEditor} from '../../src/UI/Mobile/game/MobileInputEditor.js';
let body, host, dispose;
beforeEach(()=>{vi.clearAllMocks();Object.assign(s.session,{Playing:true,hasParty:false,hasGuild:false,hasClan:false});host=document.body.appendChild(document.createElement('div'));host.dataset.orientation='landscape';body=document.createElement('div');host.attachShadow({mode:'open'}).append(body);dispose=createMobileInputEditor(host);vi.spyOn(HTMLDialogElement.prototype,'showModal').mockImplementation(function(){this.setAttribute('open','');});vi.spyOn(HTMLDialogElement.prototype,'close').mockImplementation(function(){this.removeAttribute('open');});});
afterEach(()=>{dispose?.();document.body.replaceChildren();vi.restoreAllMocks();});
const q=selector=>body.querySelector(selector);
const choose=channel=>q(`[data-chat-filter="${channel}"]`).click();
const type=text=>{q('[aria-label="聊天内容"]').value=text;q('[aria-label="聊天内容"]').dispatchEvent(new Event('input'));};
const submit=()=>q('.chat-form').dispatchEvent(new Event('submit',{cancelable:true}));
const incoming=(id,peer,text=peer)=>({id,privatePeer:peer,text,bodyText:text,direction:'incoming',channel:'private',incomingPrivate:true});
const peer=name=>{const editor=document.querySelector('[data-mobile-input-editor]').shadowRoot;editor.querySelector('input').value=name;editor.querySelector('[data-done]').click();};
it('validates recipient and memberships while preserving literal text',()=>{
 const service=createGameChat(s.send,()=>true);for(const channel of ['private','party','guild','clan'])expect(service.send('hi',channel)).not.toBe('');expect(s.send).not.toHaveBeenCalled();expect(service.send('$你好','private','朋友')).toBe('');expect(s.send).toHaveBeenCalledExactlyOnceWith('$你好','private','朋友');s.session.Playing=false;expect(service.send('hi','public')).not.toBe('');
});
it('classifies conversation, combat and system messages by filter rather than color',()=>{
 for(const [id,channel] of [[1,'public'],[2,'private'],[3,'party'],[4,'guild'],[21,'clan']])expect(chatChannel({filterType:id,colorType:4})).toBe(channel);
 for(const id of [5,8,15,16,17,18])expect(chatChannel({filterType:id})).toBe('battle');expect(chatChannel({filterType:0,colorType:4})).toBe('system');expect(isIncomingPrivateMessage({filterType:2,colorType:4})).toBe(true);for(const colorType of [5,64])expect(isIncomingPrivateMessage({filterType:2,colorType})).toBe(false);
});
it('disables all, system and battle without a send-channel dropdown',()=>{
 createChatPanel(body,s.send);expect(q('select')).toBeNull();for(const channel of ['all','system','battle']){choose(channel);expect(q('[aria-label="聊天内容"]').disabled).toBe(true);expect(q('[data-emotions]').disabled).toBe(true);type('must not send');submit();}expect(s.send).not.toHaveBeenCalled();
});
it('routes writable categories correctly and keeps the panel open after sending',()=>{
 createChatPanel(body,s.send);for(const channel of ['public','party','guild','clan']){choose(channel);type(channel);submit();expect(s.send).toHaveBeenLastCalledWith(channel,channel,'');expect(q('[aria-label="聊天内容"]').value).toBe('');expect(q('.chat-form')).not.toBeNull();}
});
it('isolates private conversations and never retargets on incoming messages',()=>{
 const panel=createChatPanel(body,s.send);choose('private');expect(q('dialog')).toBeNull();q('[data-new-private]').click();expect(document.querySelector('[data-mobile-input-editor]').shadowRoot.querySelector('dialog').open).toBe(true);expect(q('[aria-label="聊天内容"]').disabled).toBe(true);peer('B');panel.update([incoming(1,'B','from B'),incoming(2,'C','from C')]);expect(q('.chat-log').textContent).toContain('from B');expect(q('.chat-log').textContent).not.toContain('from C');type('reply B');submit();expect(s.send).toHaveBeenLastCalledWith('reply B','private','B');expect(q('.chat-contact-list [aria-label="C，1 条未读"]')).not.toBeNull();[...body.querySelectorAll('.chat-contact-select')].find(x=>x.textContent.startsWith('C')).click();type('reply C');submit();expect(s.send).toHaveBeenLastCalledWith('reply C','private','C');expect(q('.chat-log').textContent).not.toContain('from B');
});
it('retains separate drafts across channels, peers and panel reopen',()=>{
 const state=createChatComposer();let filter='all';let panel=createChatPanel(body,s.send,'',undefined,filter,value=>filter=value,state);choose('public');type('nearby draft');choose('private');q('[data-new-private]').click();peer('B');type('B draft');choose('all');panel.update([incoming(1,'C')]);q('[aria-label="私聊 C"]').click();expect(q('[aria-label="聊天内容"]').value).toBe('');type('C draft');panel=createChatPanel(body,s.send,'',undefined,filter,value=>filter=value,state);expect(q('[aria-label="聊天内容"]').value).toBe('C draft');choose('public');expect(q('[aria-label="聊天内容"]').value).toBe('nearby draft');choose('private');[...body.querySelectorAll('.chat-contact-select')].find(x=>x.textContent==='B').click();expect(q('[aria-label="聊天内容"]').value).toBe('B draft');
});
it('replies from all to incoming or outgoing private peer and public channels without immediately sending',()=>{
 const panel=createChatPanel(body,s.send);panel.update([incoming(1,'A'),{...incoming(2,'B'),incomingPrivate:false,direction:'outgoing'},{id:3,channel:'party',text:'team',replyable:true},{id:4,channel:'system',text:'notice'}]);q('[aria-label="私聊 A"]').click();type('reply');submit();expect(s.send).toHaveBeenLastCalledWith('reply','private','A');choose('all');expect(q('[aria-label="私聊 B"]')).toBeNull();expect(q('.chat-log').textContent).toContain('回复 [B]: B');choose('private');[...body.querySelectorAll('.chat-contact-select')].find(x=>x.textContent==='B').click();type('to B');submit();expect(s.send).toHaveBeenLastCalledWith('to B','private','B');choose('all');q('[aria-label="在队伍发言"]').click();expect(s.send).toHaveBeenCalledTimes(2);expect(q('[aria-label="聊天内容"]').placeholder).toContain('队伍');
});
it('keeps text inert and failed drafts intact',()=>{
 const panel=createChatPanel(body,()=> '尚未加入队伍');panel.update([{id:1,text:'<img onerror=alert(1)>',channel:'party'}]);choose('party');expect(q('img')).toBeNull();type('草稿');submit();expect(q('[aria-label="聊天内容"]').value).toBe('草稿');expect(document.querySelector('.ui-toast').textContent).toContain('尚未加入队伍');
});
it('direct requests select private regardless of previous category',()=>{
 const changed=vi.fn();createChatPanel(body,s.send,'B',undefined,'battle',changed);expect(changed).toHaveBeenCalledWith('private');type('hello');submit();expect(s.send).toHaveBeenLastCalledWith('hello','private','B');
});
it('does not send during IME composition',()=>{
 createChatPanel(body,s.send);choose('public');type('你好');q('[aria-label="聊天内容"]').dispatchEvent(new Event('compositionstart'));submit();expect(s.send).not.toHaveBeenCalled();q('[aria-label="聊天内容"]').dispatchEvent(new Event('compositionend'));submit();expect(s.send).toHaveBeenCalledExactlyOnceWith('你好','public','');
});
it('sends an expression without losing the draft',async()=>{
 createChatPanel(body,s.send,'',async()=>({lv:'data:image/png;base64,AA=='}));choose('public');type('draft');q('[data-emotions]').click();await vi.waitFor(()=>expect(q('[aria-label="爱心"]')).not.toBeNull());q('[aria-label="爱心"]').click();expect(s.send).toHaveBeenCalledExactlyOnceWith('/lv','public','');expect(q('[aria-label="聊天内容"]').value).toBe('draft');expect(q('.chat-emotions').hidden).toBe(true);
});
it('reports resource failures and retries',async()=>{
 const load=vi.fn().mockRejectedValueOnce(new Error('missing')).mockResolvedValue({lv:'data:image/png;base64,AA=='});createChatPanel(body,s.send,'',load);choose('public');q('[data-emotions]').click();await vi.waitFor(()=>expect(q('.chat-emotions').textContent).toContain('加载失败'));q('[data-emotions]').click();q('[data-emotions]').click();await vi.waitFor(()=>expect(q('[aria-label="爱心"]')).not.toBeNull());expect(load).toHaveBeenCalledTimes(2);
});
it('validates and throttles native emotions',()=>{
 const emotion=vi.fn(),clock=vi.spyOn(Date,'now').mockReturnValue(1000),service=createGameChat(s.send,()=>true,emotion);expect(service.send('/lv','public')).toBe('');expect(emotion).toHaveBeenCalledExactlyOnceWith(3);expect(service.emote('lv')).toContain('太快');clock.mockReturnValue(2000);expect(service.emote('invalid')).toContain('有效');expect(service.send('hello /lv','public')).toBe('');expect(s.send).toHaveBeenLastCalledWith('hello /lv','public','');
});

it('disables channels without membership and refreshes availability without dropping drafts',()=>{
 let error='尚未加入队伍';const panel=createChatPanel(body,s.send,'',undefined,'party',undefined,undefined,()=>error);
 expect(q('[aria-label="聊天内容"]').disabled).toBe(true);submit();expect(s.send).not.toHaveBeenCalled();
 error='';panel.refresh();type('team draft');error='尚未加入队伍';panel.refresh();expect(q('[aria-label="聊天内容"]').disabled).toBe(true);
 error='';panel.refresh();expect(q('[aria-label="聊天内容"]').value).toBe('team draft');
});

it('uses reply links and omits replies for server notices',()=>{
 const panel=createChatPanel(body,s.send);panel.update([{id:1,channel:'public',text:'欢迎来到 HappyRO！',replyable:false},{id:2,channel:'public',text:'玩家 : 你好',replyable:true}]);
 const rows=q('.chat-log').children;expect(rows[0].querySelector('a')).toBeNull();expect(rows[1].querySelector('.chat-reply').tagName).toBe('A');expect(rows[1].querySelector('button')).toBeNull();
});
it('keeps full recipient names in the heading and omits them from message bodies',()=>{
 const name='角色名称非常非常非常非常长';const panel=createChatPanel(body,s.send,name);panel.update([{...incoming(1,name),text:'[来自 '+name+'] : 你好',bodyText:'你好'},{id:2,channel:'private',privatePeer:name,text:'[To '+name+'] : 回信',bodyText:'回信',direction:'outgoing'}]);
 expect(q('.chat-recipient').textContent).toBe(name);expect(q('.chat-contact-name').textContent).toBe(name);expect(q('.chat-contact-list button').title).toBe(name);expect(q('.chat-log').textContent).toBe('喵：你好我：回信');
 expect(q('.chat-private-message[data-direction="outgoing"]')).not.toBeNull();expect(q('dialog')).toBeNull();q('[data-new-private]').click();expect(document.querySelector('[data-mobile-input-editor]').shadowRoot.querySelector('dialog').open).toBe(true);
});

it.each(['portrait','landscape'])('opens one %s input dialog and validates, selects, deduplicates and cancels contacts', orientation=>{
 host.dataset.orientation=orientation;
 const composer=createChatComposer();
 try {
  createChatPanel(body,s.send,'',undefined,'private',undefined,composer);
  const open=()=>{q('[data-new-private]').click();return document.querySelector('[data-mobile-input-editor]').shadowRoot;};
  let editor=open();expect(q('dialog')).toBeNull();expect(editor.querySelector('#editor-title').textContent).toBe('新私聊');expect(editor.querySelector('[data-done]').textContent).toBe('开始私聊');
  const field=editor.querySelector('input');field.value='   ';editor.querySelector('[data-done]').click();expect(composer.contacts.size).toBe(0);expect(document.querySelector('[data-mobile-input-editor]')).not.toBeNull();
  field.value='不存在的角色测试名';editor.querySelector('[data-done]').click();expect(field.validationMessage).toContain('23');expect(composer.contacts.size).toBe(0);
  field.value=' B ';editor.querySelector('[data-done]').click();expect(composer.receiver).toBe('B');expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();expect(host.inert).not.toBe(true);
  editor=open();editor.querySelector('input').value='B';editor.querySelector('[data-done]').click();expect([...composer.contacts]).toEqual(['B']);
  editor=open();editor.querySelector('input').value='C';editor.querySelector('[data-cancel]').click();expect([...composer.contacts]).toEqual(['B']);expect(composer.receiver).toBe('B');expect(s.send).not.toHaveBeenCalled();
  open();dispose();expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();expect(host.inert).not.toBe(true);
 } finally {dispose();}
});
it('keeps the private channel prefix on both directions in all messages',()=>{
 const panel=createChatPanel(body,s.send);panel.update([incoming(1,'B','你好'),{id:2,channel:'private',privatePeer:'B',bodyText:'回信',direction:'outgoing'}]);
 const rows=q('.chat-log').children;expect(rows[0].textContent).toBe('[私聊] [B]: 你好 回复');expect(rows[1].textContent).toBe('[私聊] 回复 [B]: 回信');expect(rows[1].querySelector('a')).toBeNull();
});
it('keeps private failures in the conversation without a toast',()=>{
 const panel=createChatPanel(body,s.send,'C');panel.update([]);
 panel.update([{id:1,channel:'private',privatePeer:'C',direction:'error',bodyText:'角色名称不存在'}]);
 expect(q('.chat-log').textContent).toBe('提示：角色名称不存在');expect(document.querySelector('.ui-toast')).toBeNull();
});
it('removes contacts without deleting history or switching the send recipient',()=>{
 const state=createChatComposer();let panel=createChatPanel(body,s.send,'B',undefined,'private',undefined,state);
 const history=[incoming(1,'B','old B'),incoming(2,'C','old C')];panel.update(history);type('B draft');
 q('[aria-label="删除私聊对象 C"]').click();expect(state.receiver).toBe('B');expect(q('[aria-label="聊天内容"]').value).toBe('B draft');
 q('[aria-label="删除私聊对象 B"]').click();expect(state.receiver).toBe('');expect(q('[aria-label="聊天内容"]').disabled).toBe(true);expect(state.contacts.size).toBe(0);expect(s.send).not.toHaveBeenCalled();
 panel=createChatPanel(body,s.send,'',undefined,'private',undefined,state);panel.update(history);expect(state.contacts.size).toBe(0);
 choose('all');expect(q('.chat-log').textContent).toContain('old B');q('[aria-label="私聊 B"]').click();expect(state.receiver).toBe('B');expect(q('[aria-label="聊天内容"]').value).toBe('B draft');
 panel.update([...history,incoming(3,'C','new C')]);expect(state.contacts.has('C')).toBe(true);expect(state.receiver).toBe('B');
});

it('validates UTF-8 recipient boundaries before sending any packet',()=>{
 const service=createGameChat(s.send,()=>true);
 for(const name of ['不存在的角色测试名','a'.repeat(24),'A\0B'])expect(service.send('test','private',name)).not.toBe('');
 expect(s.send).not.toHaveBeenCalled();
 for(const name of ['中'.repeat(7)+'ab','a'.repeat(23)])expect(service.send('test','private',name)).toBe('');
 expect(s.send).toHaveBeenCalledTimes(2);
});

it('retains the private draft after a send is rejected without a toast',()=>{
 createChatPanel(body,()=> '上一条私聊尚未收到回执','B');type('retain me');submit();expect(q('[aria-label="聊天内容"]').value).toBe('retain me');expect(document.querySelector('.ui-toast')).toBeNull();
});

it.each(['public','party','guild','clan'])('uses a speaking action only for other players in %s', channel=>{
 const panel=createChatPanel(body,s.send);panel.update([{id:1,channel,text:'self',replyable:false},{id:2,channel,text:'other',replyable:true},{id:3,channel,text:'notice'},{id:4,channel:'private',privatePeer:'B',bodyText:'hello',incomingPrivate:true,direction:'incoming'}]);
 const rows=q('.chat-log').children;expect(rows[0].querySelector('a')).toBeNull();expect(rows[1].querySelector('a').textContent).toBe('发言');expect(rows[2].querySelector('a')).toBeNull();expect(rows[3].querySelector('a').textContent).toBe('回复');
 rows[1].querySelector('a').click();expect(q(`[data-chat-filter="${channel}"]`).getAttribute('aria-pressed')).toBe('true');expect(s.send).not.toHaveBeenCalled();
});

it('closes after an accepted emotion but keeps text messages and rejected emotions open', async () => {
 const close = vi.fn(), send = vi.fn(() => '');
 createChatPanel(body, send, '', async () => ({lv: 'data:image/png;base64,AA=='}), 'public', undefined, undefined, undefined, close);
 type('draft');
 q('[data-emotions]').click();
 await vi.waitFor(() => expect(q('[aria-label="爱心"]')).not.toBeNull());
 send.mockReturnValueOnce('表情发送太快');
 q('[aria-label="爱心"]').click();
 expect(close).not.toHaveBeenCalled();
 expect(q('.chat-emotions').hidden).toBe(false);
 q('[aria-label="爱心"]').click();
 expect(close).toHaveBeenCalledTimes(1);
 expect(q('[aria-label="聊天内容"]').value).toBe('draft');
 type('普通消息');submit();expect(close).toHaveBeenCalledTimes(1);
 type('/lv');submit();expect(close).toHaveBeenCalledTimes(2);
});

it('keeps private contact nodes stable for unrelated messages and preserves scroll on updates',()=>{
 const panel=createChatPanel(body,s.send);choose('private');
 const messages=Array.from({length:40},(_,i)=>incoming(i+1,`对象${i}`));panel.update(messages);
 const contacts=q('.chat-contact-list');const nodes=[...contacts.children];contacts.scrollTop=180;
 panel.update([...messages,{id:41,channel:'public',text:'普通消息'}]);expect([...contacts.children]).toEqual(nodes);expect(contacts.scrollTop).toBe(180);
 panel.update([...messages,incoming(42,'对象0')]);expect(contacts.scrollTop).toBe(180);
});
