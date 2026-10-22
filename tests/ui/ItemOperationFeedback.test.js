import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('UI/Components/Toast.js', () => ({ showToast: vi.fn() }));
import { showToast } from '../../src/UI/Components/Toast.js';
import { beginItemOperation, finishItemOperation, receiveItemOperationResult } from '../../src/UI/Game/ItemOperationFeedback.js';
import { endConnection } from '../../src/Network/ConnectionLifecycle.js';
beforeEach(() => { endConnection(); vi.clearAllMocks(); });
it.each(['use','equip','unequip','drop','card'])('waits for a matching %s result and reports it exactly once', action => {
 const entity={};beginItemOperation(entity,action,2);
 expect(showToast).not.toHaveBeenCalled();
 finishItemOperation({},action,2,true);finishItemOperation(entity,action,3,true);
 expect(showToast).not.toHaveBeenCalled();
 finishItemOperation(entity,action,2,true);finishItemOperation(entity,action,2,true);
 expect(showToast).toHaveBeenCalledOnce();expect(showToast).toHaveBeenCalledWith(document.body,expect.stringContaining('成功'),'success');
});
it('reports rejection as failure, never as a successful request', () => {
 const entity={};beginItemOperation(entity,'drop',2);finishItemOperation(entity,'drop',2,false);
 expect(showToast).toHaveBeenCalledExactlyOnceWith(document.body,'丢弃失败','error');
});
it('discards cancelled and disconnected requests', () => {
 const entity={};beginItemOperation(entity,'card',2);finishItemOperation(entity,'card',2,null);finishItemOperation(entity,'card',2,true);
 beginItemOperation(entity,'use',2);endConnection();finishItemOperation(entity,'use',2,true);
 expect(showToast).not.toHaveBeenCalled();
});
it('matches separate replies for repeated requests', () => {
 const entity={};beginItemOperation(entity,'use',2);beginItemOperation(entity,'use',2);
 finishItemOperation(entity,'use',2,true);finishItemOperation(entity,'use',2,false);
 expect(showToast).toHaveBeenCalledTimes(2);
});

it.each([
 ['drop', {Index:2,count:3}, '丢弃成功'],
 ['drop', {Index:2,count:0}, '丢弃失败'],
 ['equip', {index:2,result:true}, '穿戴成功'],
 ['equip', {index:2,result:false}, '穿戴失败'],
 ['unequip', {index:2,result:true}, '卸下成功'],
 ['use', {index:2,result:0}, '使用失败，请检查物品的等级、职业及其它使用条件'],
 ['card', {cardIndex:2,result:0}, '镶嵌成功'],
 ['card', {cardIndex:2,result:1}, '镶嵌失败']
])('uses the actual %s acknowledgement fields', (action,packet,message) => {
 const entity={};beginItemOperation(entity,action,2);receiveItemOperationResult(entity,action,packet);
 expect(showToast).toHaveBeenCalledExactlyOnceWith(document.body,message,message.endsWith('成功')?'success':'error');
});
