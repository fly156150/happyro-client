import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTipBoxReader } from '../../src/UI/Components/TipBox/TipBoxReader.js';

let host, root, reader, closed;
const entries = {
 '6016': { title: '与未知相遇', pages: ['介绍\n<TIPBOX>^0000FF下一条^000000<INFO>6057</INFO></TIPBOX>\n<TIPBOX>缺失条目<INFO>999999</INFO></TIPBOX>', '第二页\n<TIPBOX>下一条<INFO>6057</INFO></TIPBOX>'], image: '' },
 '6057': { title: '埃克拉珠', pages: ['帮助内容\n<TIPBOX>返回章节<INFO>6016</INFO></TIPBOX>'], image: '' }
};
beforeEach(() => {
 host=document.body.appendChild(document.createElement('div'));
 root=host.attachShadow({mode:'open'});closed=vi.fn();
 vi.spyOn(HTMLDialogElement.prototype,'showModal').mockImplementation(function(){this.setAttribute('open','');});
 vi.spyOn(HTMLDialogElement.prototype,'close').mockImplementation(function(){this.removeAttribute('open');});
});
afterEach(() => {reader?.destroy();document.body.replaceChildren();vi.restoreAllMocks();});
const mount = (options={}) => reader=createTipBoxReader(root,{entries,initialId:'6016',onClose:closed,...options});
const q = selector => root.querySelector(selector);

it('opens a modal without removing the source and follows nested help links',()=>{
 const source=document.body.appendChild(document.createElement('div'));source.textContent='物品说明';
 mount();expect(q('dialog').open).toBe(true);expect(q('h2').textContent).toBe('与未知相遇');expect(q('[data-tipbox-back]').disabled).toBe(true);
 q('[data-tipbox-id="6057"] span').click();expect(q('h2').textContent).toBe('埃克拉珠');expect(q('[data-tipbox-back]').disabled).toBe(false);expect(source.isConnected).toBe(true);
 q('[data-tipbox-back]').click();expect(q('h2').textContent).toBe('与未知相遇');expect(closed).not.toHaveBeenCalled();
 q('[data-tipbox-close]').click();expect(q('dialog').open).toBe(false);expect(closed).toHaveBeenCalledOnce();expect(source.isConnected).toBe(true);
});
it('restores both page and scroll when returning from a nested article',()=>{
 mount();q('[data-tipbox-next]').click();expect(q('.tipbox-text').textContent).toContain('第二页');expect(q('[data-tipbox-next]').disabled).toBe(true);
 const body=q('.tipbox-body');body.scrollTop=180;body.scrollLeft=12;
 q('[data-tipbox-id="6057"]').click();expect(body.scrollTop).toBe(0);expect(q('.tipbox-pages').hidden).toBe(true);
 q('[data-tipbox-back]').click();expect(q('.tipbox-text').textContent).toContain('第二页');expect(body.scrollTop).toBe(180);expect(body.scrollLeft).toBe(12);expect(q('.tipbox-pages span').textContent).toBe('2 / 2');
 q('[data-tipbox-previous]').click();expect(body.scrollTop).toBe(0);expect(q('[data-tipbox-previous]').disabled).toBe(true);
});
it('keeps missing and invalid targets readable without exposing metadata or offering a dead action',()=>{
 mount();const missing=q('[data-tipbox-id="999999"]');expect(missing.textContent).toBe('缺失条目');expect(missing.classList.contains('tipbox-link')).toBe(false);expect(missing.hasAttribute('tabindex')).toBe(false);expect(missing.hasAttribute('role')).toBe(false);
 missing.click();expect(q('h2').textContent).toBe('与未知相遇');expect(reader.open('not-a-number')).toBe(false);expect(reader.open('999999')).toBe(false);expect(q('.tipbox-text').textContent).not.toContain('<INFO>');
});
it('supports keyboard links and closes once without leaking game input',()=>{
 mount();const gameInput=vi.fn();const events=['keydown','keyup','keypress','click','pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','wheel'];
 for(const type of events)document.addEventListener(type,gameInput);
 try{
  q('[data-tipbox-id="6057"]').dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true,composed:true,cancelable:true}));expect(q('h2').textContent).toBe('埃克拉珠');
  for(const type of events)q('.tipbox-body').dispatchEvent(new Event(type,{bubbles:true,composed:true}));expect(gameInput).not.toHaveBeenCalled();
  q('dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true,cancelable:true}));expect(closed).toHaveBeenCalledOnce();
  q('dialog').dispatchEvent(new Event('cancel',{cancelable:true}));expect(closed).toHaveBeenCalledOnce();expect(gameInput).not.toHaveBeenCalled();
 }finally{for(const type of events)document.removeEventListener(type,gameInput);}
});
it('renders hostile text safely and does not offer unsupported NAVI or item actions inside help',()=>{
 mount({entries:{'6016':{title:'<img onerror=alert(1)>',pages:['<script>alert(1)</script><NAVI>地图<INFO>prontera,1,2</INFO></NAVI><ITEMLINK>物品<INFO>501</INFO></ITEMLINK>'],image:''}}});
 expect(q('.tipbox-text script')).toBeNull();expect(q('h2 img')).toBeNull();expect(q('.tipbox-text').textContent).toContain('<script>alert(1)</script>');expect(q('.navi-link')).toBeNull();expect(q('.item-link')).toBeNull();
});
it('ignores late images after changing articles or destroying the reader',async()=>{
 let first,second;
 const loadImage=vi.fn(path=>new Promise(resolve=>{if(path==='old')first=resolve;else second=resolve;}));
 mount({entries:{'6016':{...entries['6016'],image:'old'},'6057':{...entries['6057'],image:'new'}},loadImage});
 await Promise.resolve();reader.open('6057');await Promise.resolve();
 first('data:image/png;base64,OLD');await Promise.resolve();await Promise.resolve();expect(q('img').hasAttribute('src')).toBe(false);
 second('data:image/png;base64,NEW');await Promise.resolve();await Promise.resolve();expect(q('img').getAttribute('src')).toBe('data:image/png;base64,NEW');
 q('img').dispatchEvent(new Event('load'));expect(q('figure').hidden).toBe(false);reader.destroy();expect(q('dialog')).toBeNull();expect(reader.open('6016')).toBe(false);expect(closed).not.toHaveBeenCalled();
});
it('keeps the reader usable when an image cannot be loaded',async()=>{
 mount({entries:{'6016':{...entries['6016'],image:'missing'}},loadImage:()=>Promise.reject(Error('missing'))});
 await Promise.resolve();await Promise.resolve();expect(q('.tipbox-text').textContent).toContain('介绍');expect(q('figure').hidden).toBe(true);q('[data-tipbox-close]').click();expect(closed).toHaveBeenCalledOnce();
});


it.each(['click','Escape','cancel'])('does not leak %s when onClose destroys the reader synchronously',kind=>{
 const leaked=vi.fn();for(const target of [host,document,window])for(const type of ['click','keydown','cancel'])target.addEventListener(type,leaked);
 try{
  mount({onClose:()=>{closed();reader.destroy();}});
  if(kind==='click')q('[data-tipbox-close]').click();
  else if(kind==='Escape')q('dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true,cancelable:true}));
  else q('dialog').dispatchEvent(new Event('cancel',{bubbles:true,composed:true,cancelable:true}));
  expect(closed).toHaveBeenCalledOnce();expect(q('dialog')).toBeNull();expect(leaked).not.toHaveBeenCalled();
 }finally{for(const target of [host,document,window])for(const type of ['click','keydown','cancel'])target.removeEventListener(type,leaked);}
});

it('activates navigation supplied by the host without leaking the source click',()=>{
 const activateNavi=vi.fn();
 mount({entries:{'6016':{title:'导航帮助',pages:['<NAVI>地图<INFO>prontera,1,2</INFO></NAVI>'],image:''}},activateNavi});
 const link=q('.navi-link');expect(link).not.toBeNull();
 link.click();expect(activateNavi).toHaveBeenLastCalledWith('prontera,1,2','地图',link);
 link.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 expect(activateNavi).toHaveBeenCalledTimes(2);
});
