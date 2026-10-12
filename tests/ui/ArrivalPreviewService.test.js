import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({end:null}));
vi.mock('Network/NetworkManager.js',()=>({default:{sendPacket:vi.fn(()=>true)}}));
vi.mock('Network/ConnectionLifecycle.js',()=>({onConnectionEnd:fn=>{state.end=fn;}}));
vi.mock('Network/PacketStructure.js',()=>({default:{CZ:{HAPPYRO_ARRIVAL_PREVIEW:function(){}}}}));
import Network from 'Network/NetworkManager.js';
import {requestArrivalPreview,handleArrivalPreview} from '../../src/UI/Components/GameTools/ArrivalPreviewService.js';
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(10000);vi.clearAllMocks();});
afterEach(()=>{state.end();vi.useRealTimers();});
it('debounces switching and rejects stale responses',async()=>{
 const old=requestArrivalPreview('prontera').catch(e=>e.message);
 const next=requestArrivalPreview('prt_fild08');
 await vi.advanceTimersByTimeAsync(200);
 expect(await old).toBe('地图选择已变化');expect(Network.sendPacket).toHaveBeenCalledTimes(1);
 const packet=Network.sendPacket.mock.lastCall[0];expect(packet.mapName).toBe('prt_fild08');
 expect(handleArrivalPreview({requestId:packet.requestId-1,result:0,x:1,y:1})).toBe(false);
 handleArrivalPreview({requestId:packet.requestId,result:0,x:168,y:373});
 expect(await next).toEqual({x:168,y:373});
});
it('cancels on close and spaces requests across reopenings',async()=>{
 const abort=new AbortController();const first=requestArrivalPreview('a',abort.signal).catch(e=>e.message);
 await vi.advanceTimersByTimeAsync(200);abort.abort();expect(await first).toBe('预览已取消');
 const second=requestArrivalPreview('b');await vi.advanceTimersByTimeAsync(599);expect(Network.sendPacket).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1);expect(Network.sendPacket).toHaveBeenCalledTimes(2);
 handleArrivalPreview({...Network.sendPacket.mock.lastCall[0],result:0,x:20,y:30});await second;
});
it('settles timeout and disconnect without accepting late results',async()=>{
 const timeout=requestArrivalPreview('a').catch(e=>e.message);await vi.advanceTimersByTimeAsync(5200);expect(await timeout).toBe('落点预览超时');
 const next=requestArrivalPreview('b').catch(e=>e.message);state.end();expect(await next).toBe('连接已断开');
});
it('reports unavailable preview without fabricating coordinates',async()=>{
 const result=requestArrivalPreview('a').catch(e=>e.message);await vi.advanceTimersByTimeAsync(200);
 handleArrivalPreview({...Network.sendPacket.mock.lastCall[0],result:6});expect(await result).toContain('完整检查');
});
