import { expect, it, vi } from 'vitest';
vi.mock('UI/Platform.js', () => ({ default: { isMobile: false } }));
vi.mock('Network/ConnectionLifecycle.js', () => ({ onConnectionEnd: vi.fn() }));
import { createNpcNaviMapActions } from '../../src/UI/Components/Navigation/NpcNaviService.js';
const safe = { allowed: true, teleportAllowed: true, targetType: 'npc', labels: ['目标'], arrivalX: 11, arrivalY: 21 };
const entries = {
 'prontera,10,20': { kind: 'coordinate', mapName: 'prontera', x: 10, y: 20, dialogueTarget: safe },
 'prontera,30,40': { kind: 'coordinate', mapName: 'prontera', x: 30, y: 40, dialogueTarget: { allowed: false } },
 'prontera,50,60': { kind: 'coordinate', mapName: 'prontera', x: 50, y: 60 },
 'poring,0,0,3,-222,1': { kind: 'monster', monsterId: 1002, dialogueTarget: { allowed: true, targetType: 'monster' } },
 'restricted,10,20': { kind: 'blocked', mapName: 'restricted', x: 10, y: 20, dialogueTarget: { ...safe, teleportAllowed: false } }
};
const info = 'prontera,10,20';
function setup(mobile = false) {
 const tools = { showMap: vi.fn(), openMap: vi.fn() };
 const load = vi.fn(async () => tools);
 const service = createNpcNaviMapActions({ manifest: { entries }, isMobile: () => mobile, loadMobileTools: load, loadDesktopTools: load });
 return { service, tools, load };
}
it('enables teleportable coordinates without NPC identity or landing review', () => {
 const { service } = setup();
 expect(service.available(info, '[目标]')).toBe(true);
 for (const invalid of ['restricted,10,20', 'poring,0,0,3,-222,1', 'unknown']) expect(service.available(invalid)).toBe(false);
 expect(service.available('prontera,30,40', '任意名字')).toBe(true);
 expect(service.available('prontera,50,60')).toBe(true);
});
it.each([false, true])('opens the existing adventure map without teleporting, mobile=%s', async mobile => {
 const { service, tools } = setup(mobile), onClose = vi.fn();
 expect(await service.open(info, { label: '目标', onClose })).toBe(true);
 const target = { id: 'prontera', mapName: 'prontera', x: 10, y: 20, name: '目标' };
 if (mobile) expect(tools.openMap).toHaveBeenCalledWith(target, undefined, expect.any(Function));
 else expect(tools.showMap).toHaveBeenCalledWith(target, expect.any(Function));
 (mobile ? tools.openMap : tools.showMap).mock.calls[0].at(-1)();
 expect(onClose).toHaveBeenCalledOnce();
});
it('does not load a view for an unknown or rejected target', async () => {
 const { service, load } = setup();
 expect(await service.open('unknown')).toBe(false);
 expect(await service.open('restricted,10,20')).toBe(false);
 expect(load).not.toHaveBeenCalled();
});
it('does not reopen an ended/replaced conversation after lazy loading', async () => {
 const { service, load, tools } = setup(); let finish;
 load.mockReturnValue(new Promise(resolve => { finish = resolve; }));
 const opened = service.open(info, { label: '目标' }); service.reset(); finish(tools);
 expect(await opened).toBe(false); expect(tools.showMap).not.toHaveBeenCalled();
});
it('does not restore a stale conversation when closing the map', async () => {
 const { service, tools } = setup(); let active = true; const onClose = vi.fn();
 await service.open(info, { label: '目标', isCurrent: () => active, onClose }); active = false;
 tools.showMap.mock.calls[0][1](); expect(onClose).not.toHaveBeenCalled();
});
it('does not require NPC identity or reviewed arrival for coordinate links', async () => {
 const {service, tools} = setup();
 expect(service.available(info, '不存在的NPC')).toBe(true);
 expect(await service.open('prontera,30,40', {label:'旧名字'})).toBe(true);
 expect(tools.showMap.mock.calls[0][0]).toEqual({ id:'prontera', mapName:'prontera', x:30, y:40, name:'旧名字' });
});
