import {afterEach,beforeEach,it,expect,vi} from 'vitest';
const s=vi.hoisted(()=>({graphics:{save:vi.fn(),defaults:{}},audio:{save:vi.fn(),BGM:{play:true,volume:.5},Sound:{play:true,volume:.5}},resize:vi.fn(),config:vi.fn(),bgm:{setVolume:vi.fn(),stop:vi.fn(),play:vi.fn(),filename:'test.mp3'},sound:{setVolume:vi.fn(),stop:vi.fn()}}));
vi.mock('Preferences/Graphics.js',()=>({default:s.graphics}));
vi.mock('Preferences/Audio.js',()=>({default:s.audio}));
vi.mock('Core/Configs.js',()=>({default:{set:s.config}}));
vi.mock('Renderer/Renderer.js',()=>({default:{resize:s.resize}}));
vi.mock('Audio/BGM.js',()=>({default:s.bgm}));
vi.mock('Audio/SoundManager.js',()=>({default:s.sound}));
import {graphicsFields,settingsSnapshot,saveGameSettings,saveGameAudio} from '../../src/UI/Game/GameSettings.js';
import Interface, { defaultInterfaceSettings } from '../../src/Preferences/Interface.js';
import {createSettingsPanel} from '../../src/UI/Mobile/game/SettingsPanel.js';
const disposers = [];
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); document.body.replaceChildren(); vi.unstubAllGlobals(); vi.useRealTimers(); });
beforeEach(()=>{vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });Object.assign(Interface,defaultInterfaceSettings);localStorage.clear();HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};Interface.toastDuration=2;vi.clearAllMocks();for(const [key,,range] of graphicsFields)s.graphics[key]=range===undefined?false:Array.isArray(range)?60:range;s.graphics.screensize='1024x768';s.graphics.defaults=Object.fromEntries(graphicsFields.map(([key])=>[key,s.graphics[key]]));s.audio.BGM={play:true,volume:.5};s.audio.Sound={play:true,volume:.5};});
it('rejects the entire invalid draft without applying partial values',()=>{const draft=settingsSnapshot();draft.graphics.quality=100;draft.audio.Sound.volume=2;expect(saveGameSettings(draft)).toContain('未保存');expect(s.graphics.quality).toBe(25);expect(s.graphics.save).not.toHaveBeenCalled();});
it('applies graphics and audio once without restarting BGM or a renderer loop on an unrelated save',()=>{const draft=settingsSnapshot();draft.graphics.quality=100;draft.graphics.fpslimit=30;draft.audio.Sound.play=false;draft.audio.BGM.volume=.8;expect(saveGameSettings(draft)).toContain('已保存');expect(s.resize).toHaveBeenCalledOnce();expect(s.config).toHaveBeenCalledWith('quality',100);expect(s.sound.setVolume).toHaveBeenCalledWith(.5);expect(s.sound.stop).toHaveBeenCalledOnce();expect(s.bgm.setVolume).toHaveBeenCalledWith(.8);expect(s.bgm.play).not.toHaveBeenCalled();expect(s.graphics.screensize).toBe('1024x768');saveGameSettings(draft);expect(s.resize).toHaveBeenCalledOnce();expect(s.bgm.setVolume).toHaveBeenCalledOnce();});

function mount(service = {}) {
 const host = document.body.appendChild(document.createElement('div'));
 host.dataset.menuDensity = 'spacious';
 const body = host.attachShadow({ mode: 'open' }).appendChild(document.createElement('div'));
 disposers.push(createSettingsPanel(body, { fields: graphicsFields, snapshot: settingsSnapshot, save: saveGameSettings, audio: saveGameAudio, ...service }));
 return { host, body, click: text => [...body.querySelectorAll('button')].find(b => b.textContent === text).click() };
}
function input(body, selector, value) {
 const node = body.querySelector(selector);
 if (node.type === 'checkbox') node.checked = value;
 else node.value = value;
 node.dispatchEvent(new Event('input'));
 return node;
}
it('persists valid edits immediately across category changes and reopening', () => {
 const { body, click } = mount();
 input(body, '[data-setting=quality]', 100);
 expect(s.graphics.quality).toBe(100);
 click('声音');
 input(body, '[data-audio=Sound]', false);
 expect(s.audio.Sound.play).toBe(false);
 click('特效'); click('画面');
 expect(body.querySelector('[data-setting=quality]').value).toBe('100');
 expect([...body.querySelectorAll('button')].some(b => b.textContent === '保存')).toBe(false);
 expect(mount().body.querySelector('[data-setting=quality]').value).toBe('100');
});
it('retains incomplete numeric input without saving invalid values', () => {
 const { body } = mount();
 input(body, '[data-setting=quality]', '');
 expect(s.graphics.save).not.toHaveBeenCalled();
 input(body, '[data-setting=quality]', '150');
 expect(s.graphics.save).not.toHaveBeenCalled();
 input(body, '[data-setting=quality]', '75');
 expect(s.graphics.quality).toBe(75);
});
it('requires confirmation before restoring defaults and resumes muted BGM', () => {
 const { body, click } = mount();
 input(body, '[data-audio=BGM]', false);
 click('恢复默认'); click('取消');
 expect(s.audio.BGM.play).toBe(false);
 click('恢复默认'); click('确认');
 expect(s.audio.BGM.play).toBe(true);
 expect(s.bgm.play).toHaveBeenCalledWith('test.mp3');
});
it('saves notification duration immediately and restores its default', () => {
 const { body, click } = mount();
 input(body, '[data-setting=toastDuration]', '4');
 expect(Interface.toastDuration).toBe(4);
 expect(JSON.parse(localStorage.getItem('Interface')).toastDuration).toBe(4);
 click('恢复默认'); click('确认');
 expect(Interface.toastDuration).toBe(2);
 const invalid = settingsSnapshot(); invalid.interface.toastDuration = 0;
 expect(saveGameSettings(invalid)).toContain('1–10');
});
it('keeps compact and spacious chat preferences independent across orientation changes', async () => {
 const { host, body } = mount();
 const lines = input(body, '[data-setting=chatPreviewLines]', '8');
 expect(Interface.chatPreviewSpaciousLines).toBe(8);
 host.dataset.menuDensity = 'compact'; await Promise.resolve();
 expect(lines.value).toBe('3');
 input(body, '[data-setting=chatPreviewLines]', '2');
 host.dataset.menuDensity = 'spacious'; await Promise.resolve();
 expect(lines.value).toBe('8');
 const stored = JSON.parse(localStorage.getItem('Interface'));
 expect(stored.chatPreviewCompactLines).toBe(2);
 expect(stored.chatPreviewSpaciousLines).toBe(8);
 const invalid = settingsSnapshot(); invalid.interface.chatPreviewSpaciousLines = 9;
 expect(saveGameSettings(invalid)).toContain('无效');
});
it('preserves pickup configuration when restoring general defaults', () => {
 const pickup = { enabled: true, range: 12, batchSeconds: 5, categories: [], excluded: [] };
 const save = vi.fn(() => '设置已保存');
 const { click } = mount({ snapshot: () => ({ ...settingsSnapshot(), pickup }), save });
 click('恢复默认'); click('确认');
 expect(save).toHaveBeenCalledWith(expect.objectContaining({ pickup }));
});
it('does not expose the shader parameter that has no implemented effect', () => {
 const { body } = mount();
 expect(body.querySelector('[data-setting=fxaaSubpix]')).toBeNull();
 expect(body.querySelector('[data-setting=fxaaEnabled]')).not.toBeNull();
});

it('accepts the production saturation default and saves it unchanged', () => {
 s.graphics.vibrance = 0.15;
 const { body } = mount();
 const field = body.querySelector('[data-setting=vibrance]');
 expect(field.validity.valid).toBe(true);
 input(body, '[data-setting=vibrance]', '0.15');
 expect(s.graphics.vibrance).toBe(0.15);
 expect(s.graphics.save).toHaveBeenCalledOnce();
});
