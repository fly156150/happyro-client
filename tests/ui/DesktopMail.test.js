import { beforeEach, expect, it, vi } from 'vitest';
const s = vi.hoisted(() => ({ send: vi.fn(), validate: vi.fn(), cancel: vi.fn(), notice: vi.fn() }));
vi.mock('DB/DBManager.js', () => ({ default: { getMessage: id => String(id) } }));
vi.mock('DB/Monsters/MonsterTable.js', () => ({ default: {} }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({ default: { addText: s.notice, TYPE: { ERROR: 1, INFO_MAIL: 2 }, FILTER: { PUBLIC_LOG: 0 } } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: { zeny: 100000, Entity: { display: { name: 'Sender' } } } }));
vi.mock('Core/Preferences.js', () => ({ default: { get: () => ({}) } }));
vi.mock('Renderer/Renderer.js', () => ({ default: { width: 1200, height: 800 } }));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: {} }));
vi.mock('Core/Client.js', () => ({ default: {} }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: value => value } }));
vi.mock('UI/GUIComponent.js', () => ({ default: class { draggable() {} focus() {} } }));
vi.mock('UI/Components/InputBox/InputBox.js', () => ({ default: {} }));
vi.mock('UI/Components/Rodex/Rodex.js', () => ({ default: {} }));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({ default: {} }));
import WriteRodex from '../../src/UI/Components/Rodex/WriteRodex.js';
let root;
const field = name => root.querySelector(name);
function confirm(name) {
 field('.name').value = name; field('.validate-name').click();
 WriteRodex.characterInfo({ name, CharID: 42, Job: 0, level: 10 });
}
beforeEach(() => {
 vi.clearAllMocks(); document.body.innerHTML = WriteRodex.render();
 root = document.querySelector('#WriteRodex'); WriteRodex._host = root; WriteRodex._shadow = null;
 WriteRodex.requestSendRodex = s.send; WriteRodex.validateName = s.validate; WriteRodex.requestCancelWriteRodex = s.cancel;
 WriteRodex.onAppend(); WriteRodex.initData({ receiveName: '' }); confirm('Alice');
 field('.title-text').value = '标题'; field('.content-text').value = '正文';
});
it.each(['', '  \t\n', '中'.repeat(14), 'bad\0title'])('rejects invalid title without sending or cancelling draft: %j', title => {
 field('.title-text').value = title; field('.send').click();
 expect(s.send).not.toHaveBeenCalled(); expect(s.cancel).not.toHaveBeenCalled(); expect(s.notice).toHaveBeenCalled();
});
it('rejects overlong Chinese body and accepts exact UTF-8 boundaries intact', () => {
 field('.content-text').value = '中'.repeat(167); field('.send').click(); expect(s.send).not.toHaveBeenCalled();
 field('.title-text').value = '中'.repeat(13); field('.content-text').value = '中'.repeat(166) + 'a'; field('.send').click();
 expect(s.send).toHaveBeenCalledWith('Alice','Sender',0,40,500,42,'中'.repeat(13)+'\0','中'.repeat(166)+'a\0');
});
it('requires new confirmation after changing recipient and ignores the previous reply', () => {
 field('.name').value = 'Bob'; field('.name').dispatchEvent(new Event('input'));
 expect(field('.validate-name').style.display).toBe(''); expect(WriteRodex.receiver).toBeNull();
 WriteRodex.characterInfo({ name:'Alice', CharID:42 }); field('.send').click(); expect(s.send).not.toHaveBeenCalled();
 confirm('Bob'); field('.send').click(); expect(s.send.mock.calls[0][0]).toBe('Bob');
});
it('checks recipient again at send even if input event was skipped', () => {
 field('.name').value='Bob'; field('.send').click(); expect(s.send).not.toHaveBeenCalled();
});
it('does not accept a stale confirmation after another request or closing', () => {
 field('.name').value='Bob'; field('.validate-name').click(); WriteRodex.characterInfo({name:'Alice',CharID:42});
 expect(WriteRodex.receiver).toBeNull(); field('.right .close').click(); WriteRodex.characterInfo({name:'Bob',CharID:43});
 expect(WriteRodex.receiver).toBeNull();
});
it('preserves punctuation instead of silently stripping content', () => {
 field('.title-text').value='$标题'; field('.content-text').value='%正文\t内容'; field('.send').click();
 expect(s.send.mock.calls[0].slice(6)).toEqual(['$标题\0','%正文\t内容\0']);
});

it('starts with an empty title and explains recipient confirmation in Chinese',()=>{
 WriteRodex.initData({receiveName:'Bob'});
 expect(field('.title-text').value).toBe('');
 expect(field('.title-text').placeholder).toBe('请输入标题');
 expect(field('.validate-name').textContent).toBe('确认收件人');
 field('.send').click();
 expect(s.send).not.toHaveBeenCalled();
 expect(s.notice.mock.calls.at(-1)[0]).toContain('确认收件人');
 expect(s.notice.mock.calls.at(-1)[0]).not.toContain('C代码');
});
