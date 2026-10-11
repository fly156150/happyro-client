import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createScreenWakeLock } from '../../src/UI/Mobile/game/ScreenWakeLock.js';
let hidden, request, dispose, locks;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function visibility(value) { hidden=value; document.dispatchEvent(new Event('visibilitychange')); }
beforeEach(()=>{
 hidden=false; locks=[];
 vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);
 request=vi.fn(async()=>{const lock=new EventTarget();lock.released=false;lock.release=vi.fn(async()=>{lock.released=true;lock.dispatchEvent(new Event('release'));});locks.push(lock);return lock;});
 Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request}});
});
afterEach(()=>{dispose?.();dispose=null;delete navigator.wakeLock;vi.restoreAllMocks();});
it('acquires while visible, releases in background, reacquires on return and cleans up',async()=>{
 dispose=createScreenWakeLock();await flush();expect(request).toHaveBeenCalledExactlyOnceWith('screen');
 visibility(false);await flush();expect(request).toHaveBeenCalledTimes(1);
 visibility(true);await flush();expect(locks[0].release).toHaveBeenCalledOnce();
 visibility(false);await flush();expect(request).toHaveBeenCalledTimes(2);
 dispose();await flush();expect(locks[1].release).toHaveBeenCalledOnce();
 visibility(false);await flush();expect(request).toHaveBeenCalledTimes(2);
});
it.each(['dispose','hide'])('releases a late request after %s without leaking a lock',async action=>{
 let resolve;request.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 dispose=createScreenWakeLock();visibility(false);expect(request).toHaveBeenCalledTimes(1);
 if(action==='dispose')dispose();else visibility(true);
 const release=vi.fn(async()=>{});resolve({release});await flush();expect(release).toHaveBeenCalledOnce();
});
it('does not request in background and handles rejection without a retry loop',async()=>{
 hidden=true;dispose=createScreenWakeLock();expect(request).not.toHaveBeenCalled();
 request.mockRejectedValueOnce(new Error('Low battery'));visibility(false);await flush();expect(request).toHaveBeenCalledTimes(1);
 visibility(true);visibility(false);await flush();expect(request).toHaveBeenCalledTimes(2);
});
it('works without wake lock support',()=>{
 delete navigator.wakeLock;dispose=createScreenWakeLock();visibility(true);visibility(false);expect(request).not.toHaveBeenCalled();
});
