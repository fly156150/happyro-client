import { afterEach, expect, it, vi } from 'vitest';
vi.mock('UI/Components/Navigation/NpcNaviService.js',()=>({isNpcNaviAvailable:vi.fn(),openNpcNaviMap:vi.fn()}));
vi.mock('UI/Components/Toast.js',()=>({showToast:vi.fn()}));
vi.mock('Network/ConnectionLifecycle.js',()=>({onConnectionEnd:vi.fn()}));
import { createNpcNaviPrompt } from '../../src/UI/Game/NpcNaviPrompt.js';
afterEach(()=>vi.useRealTimers());
function setup(){vi.useFakeTimers();let active=true;const open=vi.fn(async()=>true),notify=vi.fn();const service=createNpcNaviPrompt({available:()=>true,open,notify,dialogueActive:()=>active});return {service,open,notify,setActive:value=>{active=value;}};}
it('shows a transient acknowledgement and exposes controls only after normal dialogue end',async()=>{
 const {service,open,notify,setActive}=setup();const changed=vi.fn();service.subscribe(changed);service.show('one',{label:'铁匠铺'});
 expect(notify).toHaveBeenCalledWith('已加入导航，结束对话后可传送。');expect(service.snapshot().ready).toBe(false);
 expect(await service.open()).toBe(false);expect(open).not.toHaveBeenCalled();
 setActive(false);await vi.advanceTimersByTimeAsync(100);expect(changed).toHaveBeenLastCalledWith({ready:true,pending:false});expect(open).not.toHaveBeenCalled();
 expect(await service.open()).toBe(true);expect(open).toHaveBeenCalledWith('one',expect.objectContaining({label:'铁匠铺'}));expect(service.snapshot().ready).toBe(false);service.clear();
});
it('retains only the latest target and cancel removes it without opening',async()=>{
 const {service,open,setActive}=setup();service.show('one');service.show('two');setActive(false);await service.open();expect(open).toHaveBeenCalledWith('two',expect.anything());service.show('three');service.clear();expect(await service.open()).toBe(false);expect(open).toHaveBeenCalledOnce();
});
it('blocks reopening while another dialogue is active and invalidates late loading on cancel',async()=>{
 const {service,open,setActive}=setup();service.show('one');setActive(false);let finish;open.mockImplementation((info,{isCurrent})=>new Promise(resolve=>{finish=()=>resolve(isCurrent());}));const result=service.open();service.clear();finish();expect(await result).toBe(false);
 service.show('two');setActive(true);expect(await service.open()).toBe(false);service.clear();
});
it('unlocks failed requests for explicit retry and never automatically opens',async()=>{
 const {service,open,setActive,notify}=setup();service.show('one');setActive(false);open.mockRejectedValueOnce(new Error('load'));expect(await service.open()).toBe(false);expect(service.snapshot()).toEqual({ready:true,pending:false});expect(notify).toHaveBeenLastCalledWith('地图打开失败，请重试。');expect(await service.open()).toBe(true);service.clear();
});
