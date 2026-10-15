import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const s = vi.hoisted(() => ({ session: {}, send: vi.fn(), maintain: vi.fn(), allowed: true }));
vi.mock('Engine/SessionStorage.js', () => ({ default: s.session }));
vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: s.send } }));
vi.mock('Network/PacketStructure.js', () => ({ default: { CZ: { STATUS_CHANGE: class {} } } }));
vi.mock('DB/Jobs/JobPropertyTable.js', () => ({ default: { 1: {}, 4258: { isFourthClass: true } } }));
vi.mock('UI/Components/GameTools/AdventureControlService.js', () => ({ maintainCurrentCharacter: s.maintain, loadCharacterAllocationLimits: vi.fn(async () => ({base:{str:32767,agi:32767,vit:32767}, traits:{pow:110}})) }));
import { createGameAttributes } from '../../src/UI/Game/GameAttributes.js';
import { characterStatValues, updateCharacterStat, recordCharacterStatResult } from '../../src/UI/Game/CharacterStats.js';
import { pointResetState, resetCharacterPoints } from '../../src/UI/Game/GamePointReset.js';
import { createAttributesPanel } from '../../src/UI/Mobile/game/AttributesPanel.js';
afterEach(() => document.body.replaceChildren());
beforeEach(() => {
 HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
 HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
 vi.clearAllMocks(); s.allowed = true;
 s.session.Playing = true;
 s.session.Entity = { _job: 4258, action: 0, ACTION: { DIE: 99 }, life: { hp_max: 1000, sp_max: 100 } };
 for (const [key, value] of Object.entries({ str: 10, str2: 3, str3: 3, agi: 130, agi3: 0, vit: 20, vit3: 4, statuspoint: 3, pow: 4, pow3: 1, trait_point: 6, atak: 20, atak2: 5, patk: 2 })) updateCharacterStat(s.session.Entity, key, value);
});
it('spends only server-authorized costs and waits for its own acknowledgement without optimistic changes', () => {
 const service = createGameAttributes(() => s.allowed);
 expect(service.snapshot().base.rows.find(x => x.key === 'str')).toMatchObject({ value: 10, bonus: 3, cost: 3, canAdd: true });
 service.increase('base', 'agi'); service.increase('base', 'vit'); service.increase('related', 'str');
 expect(s.send).not.toHaveBeenCalled();
 service.increase('base', 'str'); service.increase('base', 'str');
 expect(s.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ statusID: 13, changeAmount: 1 }));
 expect(characterStatValues(s.session.Entity).str).toBe(10);
 recordCharacterStatResult(s.session.Entity, 14, true);
 expect(service.snapshot().pending).toBe(true);
 updateCharacterStat(s.session.Entity, 'str', 11); updateCharacterStat(s.session.Entity, 'atak', 21); updateCharacterStat(s.session.Entity, 'statuspoint', 0);
 recordCharacterStatResult(s.session.Entity, 13, true);
 const result = service.snapshot();
 expect(result.pending).toBe(false);
 expect(result.related.base.find(x => x.key === 'atak')).toEqual({ key: 'atak', label: '物理攻击', value: '21 + 5' });
 expect(result.base.rows[0].canAdd).toBe(false);
});
it('handles rejected allocation, connection/death guards and a different character', () => {
 const service = createGameAttributes(() => s.allowed);
 service.increase('traits', 'pow');
 expect(s.send).toHaveBeenCalledWith(expect.objectContaining({ statusID: 219 }));
 recordCharacterStatResult(s.session.Entity, 219, false);
 expect(service.snapshot().message).toContain('未成功');
 s.allowed = false; service.increase('traits', 'pow'); s.allowed = true;
 s.session.Playing = false; service.increase('traits', 'pow'); s.session.Playing = true;
 s.session.Entity.action = 99; service.increase('traits', 'pow');
 expect(s.send).toHaveBeenCalledTimes(1);
 s.session.Entity = { _job: 1, ACTION: { DIE: 99 } };
 expect(service.snapshot()).toMatchObject({ traits: { enabled: false }, message: '', pending: false });
 service.increase('traits', 'pow');
 expect(s.send).toHaveBeenCalledTimes(1);
});
it('resets base and traits separately, prevents overlapping resets and reports API failures', async () => {
 const service = createGameAttributes(() => s.allowed);
 let resolve;
 s.maintain.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
 const first = service.reset('base');
 expect(service.snapshot().pending).toBe(true);
 expect(s.maintain).toHaveBeenCalledExactlyOnceWith('character.stats.reset', {});
 await service.reset('traits'); service.increase('base', 'str');
 expect(s.maintain).toHaveBeenCalledTimes(1); expect(s.send).not.toHaveBeenCalled();
 resolve({}); await first;
 expect(service.snapshot().message).toBe('基础素质点已重置');
 s.maintain.mockRejectedValueOnce(new Error('服务暂时不可用'));
 await service.reset('traits');
 expect(s.maintain).toHaveBeenLastCalledWith('character.traits.reset', {});
 expect(service.snapshot()).toMatchObject({ pending: false, message: '服务暂时不可用' });
 const old = s.session.Entity;
 s.maintain.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
 const pending = resetCharacterPoints('skills', old);
 s.session.Entity = { _job: 1, ACTION: { DIE: 99 } };
 expect(pointResetState(s.session.Entity).pending).toBe(false);
 resolve({}); expect(await pending).toBe('角色会话已变更');
 expect(await resetCharacterPoints('base', old)).toContain('不能');
});
it('switches categories with a footer reset control and ignores updates after leaving', () => {
 const body = document.body.appendChild(document.createElement('div'));
 const panel = createAttributesPanel(body, createGameAttributes(() => s.allowed));
 expect(body.querySelector('.attribute-footer .point-reset-button')).not.toBeNull();
 [...body.querySelectorAll('button')].find(b => b.textContent === '四转素质').click();
 expect(body.querySelector('[data-attribute=pow]')).not.toBeNull();
 body.textContent = '新的菜单'; panel.update(); expect(body.textContent).toBe('新的菜单');
});
it('hides the fourth-job tab for earlier jobs', () => {
 s.session.Entity._job = 1;
 const body = document.body.appendChild(document.createElement('div')); createAttributesPanel(body, createGameAttributes(() => true));
 expect([...body.querySelectorAll('button')].find(b => b.textContent === '四转素质').hidden).toBe(true);
});

it('does not send or notify while previewing base or fourth-job points', async () => {
 const body = document.body.appendChild(document.createElement('div'));
 const service = createGameAttributes(() => s.allowed);
 await service.prepare();
 const panel = createAttributesPanel(body, service);
 body.querySelector('[data-attribute=str] button').click();
 recordCharacterStatResult(s.session.Entity, 13, true);
 panel.update(); expect(document.querySelector('.ui-toast')).toBeNull();
 [...body.querySelectorAll('button')].find(b => b.textContent === '四转素质').click();
 body.querySelector('[data-attribute=pow] button').click();
 panel.update(); expect(document.querySelector('.ui-toast')).toBeNull();
 expect(s.send).not.toHaveBeenCalled();
});

it('previews increasing costs and MAX without spending, and clears the draft', async () => {
 updateCharacterStat(s.session.Entity, 'str', 99); updateCharacterStat(s.session.Entity, 'str3', 11); updateCharacterStat(s.session.Entity, 'statuspoint', 27);
 const service = createGameAttributes(() => true); await service.prepare();
 const body = document.body.appendChild(document.createElement('div'));
 createAttributesPanel(body, service);
 body.querySelector('[data-attribute=str] button:last-child').click();
 expect(body.querySelector('[data-attribute=str] .attribute-value').textContent).toContain('99 → 101');
 expect(body.querySelector('[data-attribute-points]').textContent).toContain('：0');
 expect(characterStatValues(s.session.Entity).str).toBe(99);
 expect(s.send).not.toHaveBeenCalled();
 body.querySelector('[data-clear-plan]').click();
 expect(body.querySelector('[data-attribute=str] .attribute-value').textContent).not.toContain('→');
 expect(body.querySelector('[data-apply-plan]').disabled).toBe(true);
});

it('submits a confirmed plan in protocol-sized chunks after each acknowledgement', async () => {
 updateCharacterStat(s.session.Entity,'statuspoint',1000000);
 const service=createGameAttributes(()=>true);await service.prepare();
 const expected=service.snapshot().base;
 s.send.mockImplementation(packet=>{
  const key=packet.statusID===13?'str':'vit';
  updateCharacterStat(s.session.Entity,key,characterStatValues(s.session.Entity)[key]+packet.changeAmount);
  recordCharacterStatResult(s.session.Entity,packet.statusID,true);
 });
 const request=service.apply('base',{str:300,vit:10},expected);
 expect(s.send).toHaveBeenCalledTimes(1);
 await expect(service.apply('base',{str:1},expected)).rejects.toThrow('当前不能');
 await request;
 expect(s.send.mock.calls.map(([packet])=>[packet.statusID,packet.changeAmount])).toEqual([[13,255],[13,45],[15,10]]);
 expect(service.snapshot().pending).toBe(false);
});

it('rejects stale or unaffordable plans and stops on a failed acknowledgement', async () => {
 const service=createGameAttributes(()=>true);await service.prepare();
 const expected=service.snapshot().base;
 await expect(service.apply('base',{str:10},expected)).rejects.toThrow('不足');
 updateCharacterStat(s.session.Entity,'statuspoint',50);
 await expect(service.apply('base',{str:1},expected)).rejects.toThrow('变化');
 expect(s.send).not.toHaveBeenCalled();
 s.send.mockImplementation(packet=>recordCharacterStatResult(s.session.Entity,packet.statusID,false));
 await expect(service.apply('base',{str:1,vit:1},service.snapshot().base)).rejects.toThrow('未全部完成');
 expect(s.send).toHaveBeenCalledTimes(1);
});

it('limits trait MAX by both the remaining budget and the server maximum', async () => {
 updateCharacterStat(s.session.Entity,'pow',108); updateCharacterStat(s.session.Entity,'trait_point',100);
 const service=createGameAttributes(()=>true);await service.prepare();
 const body=document.body.appendChild(document.createElement('div'));createAttributesPanel(body,service);
 [...body.querySelectorAll('button')].find(button=>button.textContent==='四转素质').click();
 body.querySelector('[data-attribute=pow] button:last-child').click();
 expect(body.querySelector('[data-attribute=pow] .attribute-value').textContent).toBe('108 → 110');
 expect(body.querySelector('[data-attribute-points]').textContent).toContain('：98');
 expect(s.send).not.toHaveBeenCalled();
});

it('confirms a footer reset for the selected category and reports the result', async () => {
 const body=document.body.appendChild(document.createElement('div'));
 const service=createGameAttributes(()=>true);createAttributesPanel(body,service);
 body.querySelector('[data-reset-points]').click();
 expect(s.maintain).not.toHaveBeenCalled();
 expect(body.querySelector('dialog p').textContent).toBe('确认重置基础素质点？');
 body.querySelector('dialog [data-confirm]').click();
 await vi.waitFor(()=>expect(body.querySelector('[data-reset-points]').disabled).toBe(false));
 expect(s.maintain).toHaveBeenCalledExactlyOnceWith('character.stats.reset',{});
 expect(document.querySelector('.ui-toast').textContent).toContain('基础素质点已重置');
 [...body.querySelectorAll('button')].find(button=>button.textContent==='四转素质').click();
 body.querySelector('[data-reset-points]').click();
 expect(body.querySelector('dialog p').textContent).toBe('确认重置四转素质点？');
 body.querySelector('dialog [data-confirm]').click();
 await vi.waitFor(()=>expect(s.maintain).toHaveBeenLastCalledWith('character.traits.reset',{}));
});

it('shows only current related values while drafting and after server updates', async () => {
 const body=document.body.appendChild(document.createElement('div'));
 const service=createGameAttributes(()=>true);await service.prepare();
 const panel=createAttributesPanel(body,service);
 body.querySelector('[data-attribute=str] button').click();
 expect(body.querySelector('[data-result=atak]').textContent).toBe('20 + 5');
 updateCharacterStat(s.session.Entity,'atak',21);panel.update();
 expect(body.querySelector('[data-result=atak]').textContent).toBe('21 + 5');
 body.querySelector('[data-clear-plan]').click();
 expect(body.querySelector('.attribute-results').textContent).not.toContain('→');
});

it('keeps header categories functional and removes them when the panel closes', async () => {
 const header = document.body.appendChild(document.createElement('header'));
 header.innerHTML = '<div class="panel-navigation"><button>关闭</button></div>';
 const body = document.body.appendChild(document.createElement('div'));
 const service = createGameAttributes(() => true);
 let finish;
 service.prepare = () => new Promise(resolve => { finish = resolve; });
 const panel = createAttributesPanel(body, service, header);
 expect(body.querySelector('.attribute-tabs')).toBeNull();
 expect(header.querySelector('.attribute-tabs')).not.toBeNull();
 [...header.querySelectorAll('.attribute-tabs button')].find(b => b.textContent === '四转素质').click();
 expect(body.querySelector('[data-attribute=pow]')).not.toBeNull();
 panel.destroy();
 expect(header.querySelector('.attribute-toolbar')).toBeNull();
 expect(header.classList.contains('has-attribute-tabs')).toBe(false);
 body.textContent = '新的菜单';
 finish(); await Promise.resolve(); panel.update();
 expect(body.textContent).toBe('新的菜单');
 expect(header.querySelector('.panel-navigation')).not.toBeNull();
});

it('allocates beyond 400 using the full server cost and keeps zero cost capped', async () => {
 updateCharacterStat(s.session.Entity, 'str', 400);
 updateCharacterStat(s.session.Entity, 'str3', 256);
 updateCharacterStat(s.session.Entity, 'statuspoint', 1000);
 const service = createGameAttributes(() => true); await service.prepare();
 const body = document.body.appendChild(document.createElement('div'));
 createAttributesPanel(body, service);
 expect(body.querySelector('[data-attribute=str] button').disabled).toBe(false);
 body.querySelector('[data-attribute=str] button').click();
 expect(body.querySelector('[data-attribute=str] .attribute-value').textContent).toContain('400 → 401');
 s.send.mockImplementation(packet => {
  updateCharacterStat(s.session.Entity, 'str', 401);
  updateCharacterStat(s.session.Entity, 'statuspoint', 744);
  recordCharacterStatResult(s.session.Entity, packet.statusID, true);
 });
 await service.apply('base', {str:1}, service.snapshot().base);
 expect(characterStatValues(s.session.Entity)).toMatchObject({str:401, statuspoint:744});
 updateCharacterStat(s.session.Entity, 'str', 32767); updateCharacterStat(s.session.Entity, 'str3', 0);
 expect(service.snapshot().base.rows[0].canAdd).toBe(false);
});

it('rejects an over-cap trait plan before spending any points', async () => {
 updateCharacterStat(s.session.Entity, 'pow', 108); updateCharacterStat(s.session.Entity, 'trait_point', 100);
 const service = createGameAttributes(() => true); await service.prepare();
 await expect(service.apply('traits', {pow:10}, service.snapshot().traits)).rejects.toThrow('超出可用范围');
 expect(s.send).not.toHaveBeenCalled();
 expect(characterStatValues(s.session.Entity)).toMatchObject({pow:108, trait_point:100});
});
