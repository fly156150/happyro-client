import { expect, it, vi } from 'vitest';
import { createItemUseExecution } from '../../src/Network/ItemUseExecution.js';
it('serializes manual and automatic requests and verifies actor, index and identity', () => {
 let now = 0; const lane = createItemUseExecution(() => now), actor = {}, send = vi.fn(), done = vi.fn();
 expect(lane.request(actor, 2, 501, send, done)).toBe(true);
 expect(lane.request(actor, 2, 501, send)).toBe(false);
 lane.receive({}, {index:2,id:501,result:1}); lane.receive(actor, {index:3,id:501,result:1}); lane.receive(actor, {index:2,id:505,result:1});
 expect(done).not.toHaveBeenCalled(); lane.receive(actor,{index:2,id:501,result:1}); expect(done).toHaveBeenCalledWith('success');
 expect(lane.busy(true)).toBe(true); expect(lane.busy()).toBe(false); now = 800; expect(lane.busy()).toBe(false);
});
it('quarantines ambiguous stacks but releases the lane for other items', () => {
 let now = 0; const lane = createItemUseExecution(() => now), actor = {}, done = vi.fn(), second = vi.fn();
 lane.request(actor,2,501,vi.fn(),done); now = 3000;
 expect(lane.busy()).toBe(false); expect(done).toHaveBeenCalledExactlyOnceWith('timeout');
 expect(lane.canUse(2)).toBe(false); expect(lane.request(actor,2,501,vi.fn())).toBe(false);
 expect(lane.request(actor,3,505,vi.fn(),second)).toBe(true);
 lane.receive(actor,{index:2,id:501,result:1}); expect(second).not.toHaveBeenCalled(); expect(lane.canUse(2)).toBe(true);
 lane.receive(actor,{index:3,id:505,result:0}); expect(second).toHaveBeenCalledWith('failed');
});
it('discards connection state and never completes a stale request', () => {
 const lane = createItemUseExecution(), done = vi.fn(), actor = {};
 lane.request(actor,2,501,vi.fn(),done); lane.reset(); lane.receive(actor,{index:2,result:1}); expect(done).not.toHaveBeenCalled(); expect(lane.busy()).toBe(false);
});

it('shares known item cooldowns between manual and automatic use without slowing manual requests', () => {
 let now = 0; const lane = createItemUseExecution(() => now), actor = {};
 const options = {cooldownGroup:'reuse-f',cooldownMs:5000};
 lane.request(actor,2,607,vi.fn(),vi.fn(),options); lane.receive(actor,{index:2,id:607,result:1});
 expect(lane.busy()).toBe(false); expect(lane.busy(true)).toBe(true);
 expect(lane.canUse(3,'reuse-f')).toBe(false);
 expect(lane.request(actor,4,501,vi.fn())).toBe(true); lane.receive(actor,{index:4,id:501,result:1});
 now = 1000; expect(lane.request(actor,3,607,vi.fn(),vi.fn(),{...options,automatic:true})).toBe(false);
 now = 5000; expect(lane.canUse(3,'reuse-f')).toBe(true);
});

it('releases the lane when sending fails before a packet is accepted', () => {
 const lane=createItemUseExecution();
 expect(lane.request({},2,501,()=>{throw new Error('closed socket');})).toBe(false);
 expect(lane.busy()).toBe(false);
 expect(lane.request({},3,505,vi.fn())).toBe(true);
});
