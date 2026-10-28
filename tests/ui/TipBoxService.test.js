import { acquireInputFreeze, releaseInputFreeze } from '../../src/UI/InputFreeze.js';
const npcOwner = {};
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('Core/Client.js',()=>({default:{loadFile:vi.fn((_path,_done,fail)=>fail())}}));
vi.mock('DB/DBManager.js',()=>({default:{INTERFACE_PATH:'data/texture/interface/'}}));
import Session from '../../src/Engine/SessionStorage.js';
import {endConnection} from '../../src/Network/ConnectionLifecycle.js';
import {bindTipBoxLinks,closeTipBox,openTipBox} from '../../src/UI/Components/TipBox/TipBoxService.js';
import {formatRagnarokMarkup} from '../../src/Utils/RagnarokText.js';
let source,root;
beforeEach(()=>{
 vi.spyOn(HTMLDialogElement.prototype,'showModal').mockImplementation(function(){this.setAttribute('open','');});
 vi.spyOn(HTMLDialogElement.prototype,'close').mockImplementation(function(){this.removeAttribute('open');});
 Session.FreezeUI=false;bindTipBoxLinks();
 source=document.body.appendChild(document.createElement('div'));root=source.attachShadow({mode:'open'});
 root.innerHTML=formatRagnarokMarkup('<TIPBOX>[Episode13.2]<INFO>6016</INFO></TIPBOX>');
});
afterEach(()=>{releaseInputFreeze(npcOwner);closeTipBox();document.body.replaceChildren();vi.restoreAllMocks();});
const help=()=>document.getElementById('TipBoxReader')?.shadowRoot;
it('opens from shadow content before source click handlers and restores exact source and focus',()=>{
 const clicked=vi.fn();root.addEventListener('click',clicked);const link=root.querySelector('.tipbox-link');source.scrollTop=180;link.click();
 expect(clicked).not.toHaveBeenCalled();expect(Session.FreezeUI).toBe(true);expect(help().querySelector('h2').textContent).toContain('13.2');
 help().querySelector('[data-tipbox-close]').click();expect(help()).toBeUndefined();expect(Session.FreezeUI).toBe(false);expect(root.querySelector('.tipbox-link')).toBe(link);expect(root.activeElement).toBe(link);expect(source.scrollTop).toBe(180);
});
it('allows internal history navigation without resetting the reader and restores previous freeze state',()=>{
 acquireInputFreeze(npcOwner);root.querySelector('.tipbox-link').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));
 const dialog=help().querySelector('dialog');help().querySelector('[data-tipbox-id="6018"]').click();expect(help().querySelector('dialog')).toBe(dialog);
 help().querySelector('[data-tipbox-back]').click();expect(help().querySelector('h2').textContent).toContain('13.2');closeTipBox();expect(Session.FreezeUI).toBe(true);
});
it('rejects missing entries and disconnect closes help without refocusing stale content',()=>{
 expect(openTipBox('999999',source)).toBe(false);expect(help()).toBeUndefined();root.querySelector('.tipbox-link').click();const focus=vi.spyOn(root.querySelector('.tipbox-link'),'focus');endConnection();expect(help()).toBeUndefined();expect(focus).not.toHaveBeenCalled();expect(Session.FreezeUI).toBe(false);
});
it('does not leak close clicks or Escape to underlying game handlers',()=>{
 const windowKey=vi.fn(),windowClick=vi.fn();window.addEventListener('keydown',windowKey);window.addEventListener('click',windowClick);
 try{root.querySelector('.tipbox-link').click();help().querySelector('[data-tipbox-close]').click();expect(windowClick).not.toHaveBeenCalled();root.querySelector('.tipbox-link').click();help().querySelector('h2').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true}));expect(help()).toBeUndefined();expect(windowKey).not.toHaveBeenCalled();}finally{window.removeEventListener('keydown',windowKey);window.removeEventListener('click',windowClick);}
});
