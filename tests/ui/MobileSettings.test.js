import {afterEach,beforeEach,it,expect,vi} from 'vitest';
const s=vi.hoisted(()=>({graphics:{save:vi.fn(),defaults:{}},audio:{save:vi.fn(),BGM:{play:true,volume:.5},Sound:{play:true,volume:.5}},resize:vi.fn(),config:vi.fn(),bgm:{setVolume:vi.fn(),stop:vi.fn(),play:vi.fn(),filename:'test.mp3'},sound:{setVolume:vi.fn(),stop:vi.fn()}}));
vi.mock('Preferences/Graphics.js',()=>({default:s.graphics}));
vi.mock('Preferences/Audio.js',()=>({default:s.audio}));
vi.mock('Core/Configs.js',()=>({default:{set:s.config}}));
vi.mock('Renderer/Renderer.js',()=>({default:{resize:s.resize}}));
vi.mock('Audio/BGM.js',()=>({default:s.bgm}));
vi.mock('Audio/SoundManager.js',()=>({default:s.sound}));
import {graphicsFields,settingsSnapshot,saveGameSettings} from '../../src/UI/Game/GameSettings.js';
import Interface from '../../src/Preferences/Interface.js';
import {createSettingsPanel} from '../../src/UI/Mobile/game/SettingsPanel.js';
afterEach(() => document.body.replaceChildren());
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};Interface.toastDuration=2;vi.clearAllMocks();for(const [key,,range] of graphicsFields)s.graphics[key]=range===undefined?false:Array.isArray(range)?60:range;s.graphics.screensize='1024x768';s.graphics.defaults=Object.fromEntries(graphicsFields.map(([key])=>[key,s.graphics[key]]));s.audio.BGM={play:true,volume:.5};s.audio.Sound={play:true,volume:.5};});
it('rejects the entire invalid draft without applying partial values',()=>{const draft=settingsSnapshot();draft.graphics.quality=100;draft.audio.Sound.volume=2;expect(saveGameSettings(draft)).toContain('未保存');expect(s.graphics.quality).toBe(25);expect(s.graphics.save).not.toHaveBeenCalled();});
it('applies graphics and audio once without restarting BGM or a renderer loop on an unrelated save',()=>{const draft=settingsSnapshot();draft.graphics.quality=100;draft.graphics.fpslimit=30;draft.audio.Sound.play=false;draft.audio.BGM.volume=.8;expect(saveGameSettings(draft)).toContain('已保存');expect(s.resize).toHaveBeenCalledOnce();expect(s.config).toHaveBeenCalledWith('quality',100);expect(s.sound.setVolume).toHaveBeenCalledWith(.5);expect(s.sound.stop).toHaveBeenCalledOnce();expect(s.bgm.setVolume).toHaveBeenCalledWith(.8);expect(s.bgm.play).not.toHaveBeenCalled();expect(s.graphics.screensize).toBe('1024x768');saveGameSettings(draft);expect(s.resize).toHaveBeenCalledOnce();expect(s.bgm.setVolume).toHaveBeenCalledOnce();});
it('discards unsaved edits on reopen and confirms before immediately saving defaults', () => {
 const body=document.createElement('div'); document.body.append(body);
 const service={fields:graphicsFields,snapshot:settingsSnapshot,save:saveGameSettings};
 createSettingsPanel(body,service);
 const input=body.querySelector('[data-setting=quality]'); input.value=100; input.dispatchEvent(new Event('input'));
 expect(body.textContent).not.toContain('取消修改');
 createSettingsPanel(body,service);
 expect(body.querySelector('[data-setting=quality]').value).toBe('25');
 const click=text=>[...body.querySelectorAll('button')].find(x=>x.textContent===text).click();
 const check=body.querySelector('[data-audio=BGM]');check.checked=false;check.dispatchEvent(new Event('input'));click('保存');
 click('恢复默认'); expect(s.audio.BGM.play).toBe(false);
 click('取消'); expect(s.audio.BGM.play).toBe(false);
 click('恢复默认');click('确认');expect(s.audio.BGM.play).toBe(true);
 expect(s.bgm.play).toHaveBeenCalledWith('test.mp3');
 createSettingsPanel(body,service);expect(body.querySelector('[data-audio=BGM]').checked).toBe(true);
});

it('keeps changes across setting categories and applies them together only on save', () => {
	const body = document.createElement('div');
	createSettingsPanel(body, { fields: graphicsFields, snapshot: settingsSnapshot, save: saveGameSettings });
	const click = text => [...body.querySelectorAll('button')].find(button => button.textContent === text).click();
	const quality = body.querySelector('[data-setting=quality]');
	quality.value = '100';
	quality.dispatchEvent(new Event('input'));
	click('声音');
	expect(body.querySelector('section[aria-label="画面"]').hidden).toBe(true);
	expect(body.querySelector('section[aria-label="声音"]').hidden).toBe(false);
	const sound = body.querySelector('[data-audio=Sound]');
	sound.checked = false;
	sound.dispatchEvent(new Event('input'));
	click('特效');
	click('画面');
	expect(body.querySelector('[data-setting=quality]')).toBe(quality);
	expect(quality.value).toBe('100');
	expect(s.graphics.save).not.toHaveBeenCalled();
	expect(s.audio.Sound.play).toBe(true);
	click('保存');
	expect(s.graphics.quality).toBe(100);
	expect(s.audio.Sound.play).toBe(false);
});

it('removes the camera tab while retaining graphics drafts across settings tabs', () => {
 const body=document.createElement('div');
 createSettingsPanel(body,{fields:graphicsFields,snapshot:settingsSnapshot,save:saveGameSettings});
 const click=text=>[...body.querySelectorAll('button')].find(b=>b.textContent===text).click();
 expect([...body.querySelectorAll('.settings-tabs button')].map(b=>b.textContent)).toEqual(['画面','特效','声音']);
 expect(body.querySelector('.camera-section')).toBeNull();
 const input=body.querySelector('[data-setting=quality]');input.value=100;input.dispatchEvent(new Event('input'));
 click('声音');click('画面');expect(input.value).toBe('100');
 expect(s.graphics.save).not.toHaveBeenCalled();click('保存');expect(s.graphics.quality).toBe(100);
});

it('replaces feedback with temporary toasts and removes static hints', () => {
 vi.useFakeTimers();
 try {
  const body = document.createElement('div'); document.body.append(body);
  createSettingsPanel(body, {fields:graphicsFields, snapshot:settingsSnapshot, save:saveGameSettings, camera:vi.fn()});
  const click = label => [...body.querySelectorAll('button')].find(button => button.textContent === label).click();
  expect(body.querySelector('.settings-status')).toBeNull();
  expect(body.querySelector('.camera-section p')).toBeNull();
  click('保存'); expect(document.querySelector('.ui-toast').textContent).toContain('已保存');
  click('恢复默认'); click('确认'); expect(document.querySelector('.ui-toast').textContent).toContain('已保存');
  vi.advanceTimersByTime(2000); expect(document.querySelector('.ui-toast')).toBeNull();
 } finally { vi.useRealTimers(); }
});

it('persists notification duration only on save and restores the two-second default', () => {
 const body = document.createElement('div'); document.body.append(body);
 createSettingsPanel(body, {fields:graphicsFields, snapshot:settingsSnapshot, save:saveGameSettings, camera:vi.fn()});
 const duration = body.querySelector('[data-setting=toastDuration]');
 expect(duration.closest('section').getAttribute('aria-label')).toBe('画面');
 expect(duration.value).toBe('2');
 duration.value = '4'; duration.dispatchEvent(new Event('input'));
 expect(Interface.toastDuration).toBe(2);
 const click = label => [...body.querySelectorAll('button')].find(button => button.textContent === label).click();
 click('保存'); expect(Interface.toastDuration).toBe(4);
 expect(JSON.parse(localStorage.getItem('Interface')).toastDuration).toBe(4);
 click('恢复默认'); expect(Interface.toastDuration).toBe(4);
 click('确认'); expect(body.querySelector('[data-setting=toastDuration]').value).toBe('2');
 expect(Interface.toastDuration).toBe(2);
 const draft = settingsSnapshot(); draft.interface.toastDuration = 0;
 expect(saveGameSettings(draft)).toContain('1–10'); expect(Interface.toastDuration).toBe(2);
});

it('previews chat layout drafts and restores saved preferences when the panel closes',()=>{
 const body=document.body.appendChild(document.createElement('div')),preview=vi.fn();
 const saved=settingsSnapshot();const dispose=createSettingsPanel(body,{fields:graphicsFields,snapshot:settingsSnapshot,save:saveGameSettings,preview});
 const input=body.querySelector('[data-setting=chatPreviewLines]');input.value='8';input.dispatchEvent(new Event('input'));
 expect(preview.mock.calls.at(-1)[0].chatPreviewSpaciousLines).toBe(8);expect(Interface.chatPreviewSpaciousLines).toBe(saved.interface.chatPreviewSpaciousLines);
 dispose();expect(preview.mock.calls.at(-1)[0].chatPreviewSpaciousLines).toBe(saved.interface.chatPreviewSpaciousLines);
 const invalid=settingsSnapshot();invalid.interface.chatPreviewSpaciousLines=9;expect(saveGameSettings(invalid)).toContain('无效');invalid.interface.chatPreviewSpaciousLines=0;expect(saveGameSettings(invalid)).toContain('无效');
});


it('keeps layout drafts independent and follows the host scene while settings are open', async () => {
 const host=document.body.appendChild(document.createElement('div'));
 host.dataset.menuDensity='spacious';
 const root=host.attachShadow({mode:'open'}),body=root.appendChild(document.createElement('div'));
 const dispose=createSettingsPanel(body,{fields:graphicsFields,snapshot:settingsSnapshot,save:saveGameSettings});
 const input=body.querySelector('[data-setting=chatPreviewLines]');
 input.value='8'; input.dispatchEvent(new Event('input'));
 host.dataset.menuDensity='compact'; await Promise.resolve();
 expect(input.value).toBe('3');expect(body.querySelector('[data-chat-scene]')).toBeNull();expect(input.closest('label').textContent).toContain('聊天行数');expect([...input.options].some(option=>option.textContent.includes('自动'))).toBe(false);
 input.value='2'; input.dispatchEvent(new Event('input'));
 host.dataset.menuDensity='spacious'; await Promise.resolve(); expect(input.value).toBe('8');
 [...body.querySelectorAll('button')].find(button=>button.textContent==='保存').click();
 const stored=JSON.parse(localStorage.getItem('Interface'));
 expect(stored.chatPreviewCompactLines).toBe(2);expect(stored.chatPreviewSpaciousLines).toBe(8);
 dispose();
});

it('keeps pickup configuration when restoring general settings defaults', () => {
 const body=document.body.appendChild(document.createElement('div'));
 const snapshot=()=>({...settingsSnapshot(),pickup:{enabled:true,range:12,batchSeconds:5,categories:[],excluded:[]}});
 const save=vi.fn(()=> '已保存');
 const dispose=createSettingsPanel(body,{fields:graphicsFields,snapshot,save});
 expect(body.querySelector('[data-pickup]')).toBeNull();
 [...body.querySelectorAll('button')].find(b=>b.textContent==='恢复默认').click();
 body.querySelector('[data-confirm]').click();
 expect(save).toHaveBeenCalledWith(expect.objectContaining({pickup:expect.objectContaining({enabled:true,range:12})}));
 dispose();
});
