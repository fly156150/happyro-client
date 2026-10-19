import { afterEach, expect, it, vi } from 'vitest';
import { createContainerPanel } from '../../src/UI/Mobile/game/ContainerPanel.js';
afterEach(() => document.body.replaceChildren());
function setup() {
 const body=document.body.appendChild(document.createElement('div'));
 const state={containers:['inventory','storage','cart'],allowed:true,pending:false,items:[{index:2,ID:501,identity:'a',name:'药水',description:'',count:5,category:'usable'}]};
 const actions={snapshot:vi.fn(()=>state),setCapacity:vi.fn(),preview:vi.fn(async()=>null),transfer:vi.fn(()=> '已请求转移，等待服务器更新')};
 const panel=createContainerPanel(body,actions,'storage');
 const peer=body.querySelector('[aria-label="背包或手推车"]'),operation=body.querySelector('[aria-label="存取操作"]');
 const change=(node,value)=>{node.value=value;node.dispatchEvent(new Event('change'));};
 return {body,state,actions,panel,peer,operation,change};
}
it.each(['inventory','cart'])('uses the selected %s for both withdrawal and deposit', peerName=>{
 const {body,actions,peer,operation,change}=setup();
 change(peer,peerName);
 body.querySelector('.inventory-item').click();
 body.querySelector('.container-amount').value='2';
 body.querySelector('.container-transfer-submit').click();
 expect(actions.transfer).toHaveBeenLastCalledWith('storage',peerName,2,501,2,'a');
 change(operation,'deposit');
 expect(actions.snapshot).toHaveBeenLastCalledWith(peerName);
 expect(body.querySelector('.container-amount')).toBeNull();
 body.querySelector('.inventory-item').click();
 body.querySelector('.container-transfer-submit').click();
 expect(actions.transfer).toHaveBeenLastCalledWith(peerName,'storage',2,501,1,'a');
 expect(body.querySelector('.container-transfer-target').hidden).toBe(true);
});
it('disables unavailable carts and falls back to inventory when the cart is removed',()=>{
 const {state,actions,panel,peer,operation,change}=setup();
 change(peer,'cart');change(operation,'deposit');
 state.containers=['inventory','storage'];panel.update();
 expect(peer.value).toBe('inventory');
 expect(peer.querySelector('option[value=cart]').disabled).toBe(true);
 expect(actions.snapshot).toHaveBeenLastCalledWith('inventory');
 state.pending=true;panel.update();expect(peer.disabled).toBe(true);expect(operation.disabled).toBe(true);
});
it('places the peer before the operation and preserves quantity on refresh',()=>{
 const {body,panel,peer,operation}=setup();
 expect(peer.compareDocumentPosition(operation)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(body.querySelectorAll('.storage-modes button')).toHaveLength(0);
 body.querySelector('.inventory-item').click();
 const amount=body.querySelector('.container-amount');amount.value='3';panel.update();
 expect(amount.value).toBe('3');
});
