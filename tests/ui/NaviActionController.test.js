import { describe, expect, it, vi } from 'vitest';
import { createNaviActions, naviTargetKey } from '../../src/UI/Components/Navigation/NaviActionController.js';

function setup() {
 const entry = { kind: 'coordinate', mapName: 'prontera', x: 100, y: 200 };
 const dependencies = {
  manifest: { entries: { 'prontera,100,200,0,101,0': entry, 'stapo,0,0,3,-222,1': { kind: 'monster', monsterId: 1784 }, 't_garden,128,122': { kind: 'blocked', message: '当前客户端不支持目标地图', mapName: 't_garden', x: 128, y: 122 } } },
  prepareTeleport: vi.fn(() => ({ allowed: true })),
  getState: vi.fn(() => ({ connectionReady:true,canTeleport: true, allowed: true, supportedMap: true })),
  teleport: vi.fn(() => true), present: vi.fn(), openMonster: vi.fn(), openMap: vi.fn()
 };
 return { ...dependencies, service: createNaviActions(dependencies) };
}
describe('reviewed NAVI actions', () => {
 it('keeps an unknown previous result explicit after switching to another target', () => {
  const s=setup();s.manifest.entries['izlude,122,207']={kind:'coordinate',mapName:'izlude',x:122,y:207};
  s.service.activate('prontera,100,200,0,101,0');const receipt=s.teleport.mock.calls[0][1];
  s.getState.mockReturnValue({connectionReady:true,canTeleport:false,allowed:true,supportedMap:true,mapPending:true});
  s.service.activate('izlude,122,207');
  s.getState.mockReturnValue({connectionReady:true,canTeleport:true,allowed:true,supportedMap:true,mapPending:false});
  receipt({result:-1});
  expect(s.present).toHaveBeenLastCalledWith(expect.objectContaining({message:expect.stringContaining('结果尚未确认'),retry:undefined}));
  expect(s.teleport).toHaveBeenCalledTimes(1);
 });
 it('normalizes only declared identity fields and keeps flags distinct', () => {
  expect(naviTargetKey(' Prontera.GAT,0100,0200,0,101,0, ')).toBe('prontera,100,200,0,101,0');
  expect(naviTargetKey('prontera,100oops,200')).toBe('prontera,100oops,200');
 });
 it('sends the approved destination once without any preflight request', () => {
  const s=setup(); expect(s.service.activate('prontera.gat,100,200,0,101,0')).toBe(true);
  expect(s.teleport).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({mapName:'prontera',x:100,y:200}),expect.any(Function),expect.any(Function));
  s.teleport.mock.calls[0][1]({result:0});expect(s.present).toHaveBeenLastCalledWith(expect.objectContaining({message:'已传送到目标附近。',retry:undefined}));
 });
 it('coalesces duplicate clicks and still presents the original receipt', () => {
  const s=setup();s.service.activate('prontera,100,200,0,101,0');s.service.activate('prontera.gat,0100,200,0,101,0');expect(s.teleport).toHaveBeenCalledTimes(1);s.teleport.mock.calls[0][1]({result:0});expect(s.present).toHaveBeenLastCalledWith(expect.objectContaining({message:'已传送到目标附近。'}));
 });
 it('denies unknown, changed and malformed identities instead of guessing', () => {
  const s=setup();for(const info of ['prontera,101,200,0,101,0','prontera,100 200,0','prontera,100,200,3,-222,1']) expect(s.service.activate(info)).toBe(false);
  expect(s.teleport).not.toHaveBeenCalled();
 });
 it('routes monsters to the catalog and blocked maps to explanation', () => {
  const s=setup();s.service.activate('STAPO,0,0,3,-222,1');expect(s.openMonster).toHaveBeenCalledWith(1784, expect.any(Function));
  s.service.activate('t_garden,128,122');expect(s.present).toHaveBeenLastCalledWith(expect.objectContaining({message:'当前客户端不支持目标地图',retry:undefined}));
  s.present.mock.calls.at(-1)[0].viewMap();expect(s.openMap).toHaveBeenCalledWith(expect.objectContaining({mapName:'t_garden'}), expect.any(Function));expect(s.teleport).not.toHaveBeenCalled();
 });
 it('never closes dialogue or auto-warps; an explicit retry after normal completion is required', () => {
  const s=setup();s.prepareTeleport.mockReturnValue({allowed:false,message:'请先结束当前 NPC 对话'});
  s.service.activate('prontera,100,200,0,101,0');expect(s.teleport).not.toHaveBeenCalled();const retry=s.present.mock.calls.at(-1)[0].retry;
  s.prepareTeleport.mockReturnValue({allowed:true});expect(s.teleport).not.toHaveBeenCalled();retry();expect(s.teleport).toHaveBeenCalledTimes(1);
 });
 it('does not retry unknown results, and discards old actions after disconnect', () => {
  const s=setup();s.service.activate('prontera,100,200,0,101,0');s.teleport.mock.calls[0][1]({result:-1});
  expect(s.present).toHaveBeenLastCalledWith(expect.objectContaining({retry:undefined,message:expect.stringContaining('不会自动重试')}));
  expect(s.teleport).toHaveBeenCalledTimes(1);
  s.prepareTeleport.mockReturnValue({allowed:false});s.service.activate('prontera,100,200,0,101,0');const retry=s.present.mock.calls.at(-1)[0].retry;
  s.service.reset();s.prepareTeleport.mockReturnValue({allowed:true});retry();expect(s.teleport).toHaveBeenCalledTimes(1);
 });
 it('does not reopen a dismissed panel when a late receipt arrives', () => {
  const s=setup();s.service.activate('prontera,100,200,0,101,0');const callback=s.teleport.mock.calls[0][1];s.present.mock.calls.at(-1)[0].onDismiss();s.present.mockClear();callback({result:0});expect(s.present).not.toHaveBeenCalled();
 });
 it('respects pending, cooldown, permissions and final server refusal', () => {
  const s=setup();s.getState.mockReturnValue({connectionReady:true,canTeleport:false,allowed:true,supportedMap:true,mapPending:true});
  s.service.activate('prontera,100,200,0,101,0');expect(s.teleport).not.toHaveBeenCalled();
  expect(s.present).toHaveBeenLastCalledWith(expect.objectContaining({message:expect.stringContaining('尚未确认')}));
  s.getState.mockReturnValue({connectionReady:true,canTeleport:true});s.service.activate('prontera,100,200,0,101,0');s.getState.mockReturnValue({message:'当前地图规则禁止传送'});s.teleport.mock.calls[0][1]({result:5});
  expect(s.present).toHaveBeenLastCalledWith(expect.objectContaining({message:'当前地图规则禁止传送',retry:expect.any(Function)}));
 });
});

it('keeps accepted receipt progress distinct from final arrival and ignores dismissed progress', () => {
 const s=setup();s.service.activate('prontera,100,200,0,101,0');
 const [,complete,progress]=s.teleport.mock.calls[0];
 progress({phase:'arrival',message:'服务器已接受传送，正在等待地图和角色到达。'});
 expect(s.present).toHaveBeenLastCalledWith(expect.objectContaining({message:expect.stringContaining('等待地图'),retry:undefined}));
 s.service.activate('prontera,100,200,0,101,0');expect(s.teleport).toHaveBeenCalledTimes(1);
 complete({result:-2,message:'服务器已接受传送，但尚未确认到达。'});
 expect(s.present).toHaveBeenLastCalledWith(expect.objectContaining({message:expect.stringContaining('尚未确认到达'),retry:undefined}));
 s.present.mock.calls.at(-1)[0].onDismiss();s.present.mockClear();progress({message:'stale'});
 expect(s.present).not.toHaveBeenCalled();
});
it.each([['loading','加载'],['dead','倒下'],['npcPending','尚未确认']])('explains %s without sending', (condition,text) => {
 const s=setup();s.getState.mockReturnValue({connectionReady:true,canTeleport:false,allowed:true,supportedMap:true,[condition]:true});
 s.service.activate('prontera,100,200,0,101,0');expect(s.teleport).not.toHaveBeenCalled();
 expect(s.present).toHaveBeenLastCalledWith(expect.objectContaining({message:expect.stringContaining(text)}));
});

it('reports disconnected state without mislabeling it as cross-map policy', () => {
 const s=setup();s.getState.mockReturnValue({connectionReady:false,canTeleport:false,allowed:true,supportedMap:true});
 s.service.activate('prontera,100,200,0,101,0');expect(s.teleport).not.toHaveBeenCalled();
 const message=s.present.mock.calls.at(-1)[0].message;expect(message).toContain('游戏连接尚未就绪');expect(message).not.toContain('跨地图');
});
