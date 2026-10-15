import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createChatPreview } from '../../src/UI/Mobile/game/ChatPreview.js';
import Interface, { defaultInterfaceSettings } from '../../src/Preferences/Interface.js';
let root, preview, log, resized;
beforeEach(()=>{
 vi.stubGlobal('ResizeObserver',class { constructor(callback){resized=callback;} observe(){} disconnect(){} });
 Object.assign(Interface,defaultInterfaceSettings);
 root=document.body.appendChild(document.createElement('div'));
 root.innerHTML='<div class="chat-preview"><nav data-chat-preview-tabs></nav><span data-chat-preview></span></div>';
 log=root.querySelector('[data-chat-preview]');preview=createChatPreview(root);
});
afterEach(()=>{vi.unstubAllGlobals();preview.destroy();Object.assign(Interface,defaultInterfaceSettings);});
const choose=key=>root.querySelector(`[data-preview-category="${key}"]`).click();
const messages=[{id:1,channel:'public',text:'附近消息'},{id:2,channel:'battle',text:'获得经验'},{id:3,channel:'system',text:'服务器通知'}];
it('switches four categories without mixing system and combat messages',()=>{
 preview.update(messages);expect(log.children.length).toBe(3);
 choose('dialogue');expect(log.textContent).toBe('[附近] 附近消息');
 choose('battle');expect(log.textContent).toBe('[战斗] 获得经验');
 choose('system');expect(log.textContent).toBe('[系统] 服务器通知');
 choose('all');expect(log.children.length).toBe(3);
});
it('shows private unread only outside the dialogue categories and clears it on viewing',()=>{
 choose('battle');preview.update([...messages,{id:4,channel:'private',text:'你好',incomingPrivate:true}]);
 const dot=root.querySelector('[data-preview-category="dialogue"] b');expect(dot.hidden).toBe(false);
 choose('dialogue');expect(dot.hidden).toBe(true);expect(log.textContent).toContain('你好');
 choose('battle');preview.update([...messages,{id:5,channel:'battle',text:'伤害'}]);expect(dot.hidden).toBe(true);
});
it('retains more than three messages and inserts all content as text',()=>{
 preview.update(Array.from({length:20},(_,i)=>({id:i+1,channel:'public',text:'<img src=x>'})));
 expect(log.children.length).toBe(20);expect(log.querySelector('img')).toBeNull();
});
it('keeps history scroll position on arrivals but follows messages at the bottom',()=>{
 Object.defineProperties(log,{scrollHeight:{get:()=>log.children.length*16},clientHeight:{value:32}});resized();
 preview.update(Array.from({length:10},(_,i)=>({id:i+1,channel:'public',text:String(i)})));
 log.scrollTop=32;log.dispatchEvent(new Event('scroll'));preview.update(Array.from({length:11},(_,i)=>({id:i+1,channel:'public',text:String(i)})));expect(log.scrollTop).toBe(32);
 log.scrollTop=144;log.dispatchEvent(new Event('scroll'));preview.update(Array.from({length:12},(_,i)=>({id:i+1,channel:'public',text:String(i)})));expect(log.scrollTop).toBe(192);
});
it('applies device preferences and resets filtering when tabs are disabled',()=>{
 preview.update(messages);choose('battle');preview.configure({chatPreviewCompactLines:3,chatPreviewSpaciousLines:8,chatPreviewTabs:false});
 expect(root.querySelector('.chat-preview').style.getPropertyValue('--chat-preview-spacious-lines')).toBe('8');
 expect(root.querySelector('nav').hidden).toBe(true);expect(log.children.length).toBe(3);
 preview.configure(defaultInterfaceSettings);expect(root.querySelector('.chat-preview').style.getPropertyValue('--chat-preview-spacious-lines')).toBe('5');expect(root.querySelector('nav').hidden).toBe(false);
});

it('keeps following the latest message when resizing changes the visible number of lines',()=>{
 let height=80;Object.defineProperties(log,{scrollHeight:{value:320},clientHeight:{get:()=>height}});resized();
 log.scrollTop=240;log.dispatchEvent(new Event('scroll'));height=48;log.dispatchEvent(new Event('scroll'));resized();expect(log.scrollTop).toBe(320);
});

it('updates tab layout state immediately on each settings event',()=>{
 const container=root.querySelector('.chat-preview');
 for(const enabled of [false,true,false,true]) {
  Interface.chatPreviewTabs=enabled;
  window.dispatchEvent(new Event('interface-settings-change'));
  expect(container.classList.contains('without-tabs')).toBe(!enabled);
  expect(root.querySelector('nav').hidden).toBe(!enabled);
 }
});
