import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it, vi } from 'vitest';

it('exits with a wall-clock deadline even when map loading stopped the render loop', async () => {
 const source = fs.readFileSync('src/Engine/MapEngine.js', 'utf8').replace(/\r\n/g, '\n');
 const start = source.indexOf('async function onExitRequest()');
 const end = source.indexOf('\n}', start) + 2;
 expect(start).toBeGreaterThan(0);
 const login = { logout: vi.fn(async () => true) };
 const timers = [];
 const scope = {
  loginStub: login, recovery: { cancel: vi.fn() },
  PACKET: { CZ: { REQUEST_QUIT: function () {} } },
  Network: { sendPacket: vi.fn() }, Events: { setTimeout: vi.fn() },
  setTimeout: (callback, delay) => { timers.push({callback, delay}); return 1; },
  onExitSuccess: vi.fn(), exitRequestTimer: null
 };
 vm.createContext(scope);
 vm.runInContext(source.slice(start, end).replace("await import('Engine/LoginEngine.js')", 'await Promise.resolve({ default: loginStub })'), scope);
 await scope.onExitRequest();
 expect(scope.Network.sendPacket).toHaveBeenCalledOnce();
 expect(scope.Events.setTimeout).not.toHaveBeenCalled();
 expect(timers).toHaveLength(1);
 expect(timers[0].delay).toBe(1000);
 timers[0].callback();
 expect(scope.onExitSuccess).toHaveBeenCalledOnce();
});
