import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createMobileInputEditor } from '../../src/UI/Mobile/game/MobileInputEditor.js';
let dispose;
beforeEach(() => {
 vi.stubGlobal('innerWidth',844); vi.stubGlobal('innerHeight',390);
 // jsdom does not implement the dialog top layer; real browsers are checked separately.
 vi.stubGlobal('HTMLDialogElement', HTMLDialogElement);
 HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
 HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { dispose?.(); document.body.replaceChildren(); vi.unstubAllGlobals(); });
function setup(markup = '<input placeholder="地图名称" value="波利">') {
 const host = document.createElement('div'); const root = host.attachShadow({mode:'open'});
 root.innerHTML = markup; document.body.append(host); dispose = createMobileInputEditor(host);
 const input = root.querySelector('input,textarea'); input.focus();
 const overlay = document.querySelector('[data-mobile-input-editor]');
 return {host, input, overlay, editor: overlay?.shadowRoot, field: overlay?.shadowRoot.querySelector('input,textarea')};
}
it('edits a draft, commits events once and leaves the original page intact', () => {
 const {host,input,editor,field} = setup(); const events=[];
 input.addEventListener('input',()=>events.push('input')); input.addEventListener('change',()=>events.push('change'));
 expect(host.inert).toBe(true); expect(editor.activeElement).toBe(field);
 field.value='普隆德拉'; expect(input.value).toBe('波利');
 editor.querySelector('[data-done]').click();
 expect(input.value).toBe('普隆德拉'); expect(events).toEqual(['input','change']);
 expect(host.inert).not.toBe(true); expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();
 input.focus(); expect(document.querySelector('[data-mobile-input-editor]')).not.toBeNull();
});
it('cancels without changing the source and cleans up on unmount', () => {
 const {host,input,editor,field}=setup(); field.value='discard'; editor.querySelector('[data-cancel]').click();
 expect(input.value).toBe('波利'); input.focus(); dispose();
 expect(host.inert).not.toBe(true); expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();
});
it('retains number validation and does not commit invalid values', () => {
 const {input,editor,field}=setup('<input type="number" min="1" max="10" value="2">');
 field.value='20'; editor.querySelector('[data-done]').click(); expect(input.value).toBe('2');
 expect(document.querySelector('[data-mobile-input-editor]')).not.toBeNull();
 field.value='5'; editor.querySelector('[data-done]').click(); expect(input.value).toBe('5');
});
it('does not submit when confirming Chinese composition and retains multiline Enter', () => {
 const {field}=setup(); field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}));
 expect(document.querySelector('[data-mobile-input-editor]')).not.toBeNull();
 field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();
 dispose(); const second=setup('<textarea>hello</textarea>'); second.field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 expect(document.querySelector('[data-mobile-input-editor]')).not.toBeNull();
});
it('follows the visible viewport and removes viewport listeners on close', () => {
 const visual=new EventTarget(); Object.assign(visual,{height:390,offsetTop:0}); vi.stubGlobal('visualViewport',visual);
 const {editor}=setup(); visual.height=150; visual.offsetTop=20; visual.dispatchEvent(new Event('resize'));
 expect(editor.querySelector('section').style.height).toBe(''); expect(editor.querySelector('section').style.top).toBe(''); expect(document.querySelector('[data-mobile-input-editor]').style.getPropertyValue('--mobile-visual-top')).toBe('20px');
 editor.querySelector('[data-cancel]').click(); visual.height=390; visual.dispatchEvent(new Event('resize')); expect(editor.querySelector('section').style.height).toBe('');
});
it('leaves readonly fields alone', () => { expect(setup('<input readonly value="fixed">').overlay).toBeNull(); });

it('opens on the completed click after a tap so compatibility mouse events cannot steal focus', () => {
 const host=document.createElement('div');const root=host.attachShadow({mode:'open'});
 root.innerHTML='<input>';document.body.append(host);dispose=createMobileInputEditor(host);
 const input=root.querySelector('input');const focused=vi.fn();input.addEventListener('focus',focused);
 const event=new MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0});input.dispatchEvent(event);
 expect(event.defaultPrevented).toBe(false);expect(focused).not.toHaveBeenCalled();
 expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();
 input.dispatchEvent(new MouseEvent('pointerup',{bubbles:true,cancelable:true,button:0}));
 expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();
 input.click();
 const dialog=document.querySelector('[data-mobile-input-editor]').shadowRoot.querySelector('dialog');
 expect(dialog.open).toBe(true);
 const cancel=new Event('cancel',{cancelable:true});dialog.dispatchEvent(cancel);
 expect(cancel.defaultPrevented).toBe(true);expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();
});

it('allows dragging over a field and cancelled touch gestures without opening the editor', () => {
 const host=document.createElement('div');const root=host.attachShadow({mode:'open'});
 root.innerHTML='<input>';document.body.append(host);dispose=createMobileInputEditor(host);
 const input=root.querySelector('input');
 const pointer=(type,y)=>input.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:20,clientY:y}));
 pointer('pointerdown',100);pointer('pointermove',60);pointer('pointerup',60);
 expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();
 pointer('pointerdown',100);pointer('pointercancel',100);pointer('pointerup',100);
 expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();
 pointer('pointerdown',100);input.dispatchEvent(new Event('scroll'));pointer('pointerup',100);
 expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();
 pointer('pointerdown',100);pointer('pointerup',100);input.click();
 expect(document.querySelector('[data-mobile-input-editor]')).not.toBeNull();
});

it('leaves focus on the parent prompt after the browser restores the original input', () => {
 const host=document.createElement('div'),root=host.attachShadow({mode:'open'});
 root.innerHTML='<dialog open><p tabindex="-1">确认丢弃？</p><input type="number" value="1"></dialog>';
 document.body.append(host);dispose=createMobileInputEditor(host);
 const input=root.querySelector('input');input.focus();
 const editor=document.querySelector('[data-mobile-input-editor]').shadowRoot;
 editor.querySelector('dialog').close=function(){this.removeAttribute('open');input.focus();};
 editor.querySelector('input').value='2';editor.querySelector('[data-done]').click();
 expect(input.value).toBe('2');expect(root.activeElement).toBe(root.querySelector('p'));
 expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();
});

it('uses the shared fullscreen editor for chat and closes before submitting unchanged drafts', () => {
 const {host,input,editor,field}=setup('<form class="chat-form"><input data-input-submit aria-label="聊天内容" value="/lv"></form>');
 const submit=vi.fn(event=>{event.preventDefault();expect(host.inert).not.toBe(true);expect(document.querySelector('[data-mobile-input-editor]')).toBeNull();});
 input.form.addEventListener('submit',submit);
 expect(editor.querySelector('[data-done]').textContent).toBe('发送');
 expect(field.getAttribute('enterkeyhint')).toBe('send');
 editor.querySelector('[data-done]').click();
 expect(submit).toHaveBeenCalledTimes(1);
 expect(input.value).toBe('/lv');
 expect(host.shadowRoot.activeElement).not.toBe(input);
});

it('keeps the tablet editor bounded when the keyboard reduces visible space', () => {
 vi.stubGlobal('innerWidth',1024); vi.stubGlobal('innerHeight',768);
 const visual=new EventTarget();Object.assign(visual,{height:768,offsetTop:0});vi.stubGlobal('visualViewport',visual);
 const {overlay,editor}=setup(); expect(overlay.dataset.menuDensity).toBe('spacious');
 visual.height=320;visual.offsetTop=15;visual.dispatchEvent(new Event('resize'));
 expect(overlay.dataset.menuDensity).toBe('spacious');
 expect(overlay.style.getPropertyValue('--mobile-visible-height')).toBe('320px');
 expect(editor.querySelector('dialog').style.height).toBe('');
 editor.querySelector('[data-cancel]').click();
});

it('updates editor density for small split-view width changes across the breakpoint', () => {
 vi.stubGlobal('innerWidth',800);vi.stubGlobal('innerHeight',768);
 const {overlay}=setup();expect(overlay.dataset.menuDensity).toBe('spacious');
 vi.stubGlobal('innerWidth',760);window.dispatchEvent(new Event('resize'));
 expect(overlay.dataset.menuDensity).toBe('compact');
 vi.stubGlobal('innerWidth',800);window.dispatchEvent(new Event('resize'));
 expect(overlay.dataset.menuDensity).toBe('spacious');
});

it('keeps a phone portrait draft in a bounded dialog through keyboard resizing and rotation', () => {
 vi.stubGlobal('innerWidth',390); vi.stubGlobal('innerHeight',844);
 const visual=new EventTarget();Object.assign(visual,{height:844,offsetTop:0});vi.stubGlobal('visualViewport',visual);
 const {overlay,editor,field}=setup();
 expect(overlay.dataset.editorLayout).toBe('dialog');
 field.value='竖屏草稿';
 visual.height=300;visual.offsetTop=12;visual.dispatchEvent(new Event('resize'));
 expect(overlay.dataset.editorLayout).toBe('dialog');
 expect(editor.querySelector('section').style.height).toBe('');
 expect(editor.querySelector('dialog').style.height).toBe('');
 vi.stubGlobal('innerWidth',844);vi.stubGlobal('innerHeight',390);visual.height=170;window.dispatchEvent(new Event('resize'));
 expect(overlay.dataset.editorLayout).toBe('strip');
 expect(editor.querySelector('section').style.height).toBe('');
 expect(field.value).toBe('竖屏草稿');
 vi.stubGlobal('innerWidth',390);vi.stubGlobal('innerHeight',844);visual.height=300;window.dispatchEvent(new Event('resize'));
 expect(overlay.dataset.editorLayout).toBe('dialog');
 expect(editor.querySelector('section').style.height).toBe('');
 expect(field.value).toBe('竖屏草稿');
});

it('keeps the draft and clears portrait placement when returning to a landscape strip', () => {
 const visual=new EventTarget();Object.assign(visual,{height:170,offsetTop:24});vi.stubGlobal('visualViewport',visual);
 const {overlay,editor,field}=setup();field.value='旋转草稿';
 for(const [width,height,visible,offset,mode] of [[390,844,350,40,'dialog'],[844,390,170,0,'strip'],[390,844,350,0,'dialog'],[844,390,170,24,'strip']]) {
  vi.stubGlobal('innerWidth',width);vi.stubGlobal('innerHeight',height);Object.assign(visual,{height:visible,offsetTop:offset});window.dispatchEvent(new Event('resize'));visual.dispatchEvent(new Event('scroll'));
  expect(overlay.dataset.editorLayout).toBe(mode);
  expect(editor.querySelector('section').style.top).toBe('');
  expect(field.value).toBe('旋转草稿');
 }
});
