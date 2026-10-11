import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';
import { selectAutoWalkWaypoint } from '../../src/UI/Components/Navigation/NavigationAutoWalk.js';

const source = readFileSync(resolve('src/UI/Components/Navigation/Navigation.js'), 'utf8');
const engine = readFileSync(resolve('src/Engine/MapEngine.js'), 'utf8');
const mount = engine.match(/appendGameComponent\(Navigation\);(?:\s*Navigation\.resumeMapTransition\(\);)?/)[0];

function harness(mobile, active = true) {
 vi.useFakeTimers();
 const Navigation = {
  name: 'Navigation', prepare: vi.fn(), renderCanvas: vi.fn(), loadMap: vi.fn(),
  updateTeleportButton: vi.fn(), updateAutoWalkButtons: vi.fn(), setActionStatus: vi.fn(), clear: vi.fn()
 };
 const state = createContext({
  Navigation, _finalTargetData: {map:'prt_in',x:282,y:176}, _targetData: {map:'prt_in',x:282,y:176},
  _autoWalkActive: active, _autoWalkRequested: false, _autoWalkTimer: null, _resumeAutoWalkAfterMapLoad: false,
  _pathUnavailable: false, _pathUpdateLock: false, _path: [], _lastPathUpdate: 0, _dialogueWarp: null,
  _navigationRequestId: 0, _searchRequestId: 0, _unsubscribeAdventureActions: null,
  _npcTeleportTimer: null, _npcAvailabilityTimer: null, _documentClickHandler: null,
  _npcTeleportPending: false, _npcAvailabilityPending: null,
  map: 'prt_in', position: {x:208,y:170},
  initializePathFindingWorker: vi.fn(), terminatePathFindingWorker: vi.fn(), notifyRouteState: vi.fn(),
  Renderer: {render:vi.fn()}, subscribeAdventureActions:()=>()=>{}, notifyGameInput: vi.fn(),
  setInterval, clearInterval, clearTimeout,
  Network: {sendPacket:vi.fn()}, PACKETVER: {value:20211103},
  PACKET: {CZ:{REQUEST_MOVE2:class {dest=[0,0];}}}, selectAutoWalkWaypoint,
  EntityManager:{forEach:vi.fn()}, Entity:{TYPE_NPC:1,TYPE_NPC2:2}
 });
 state.getCurrentMap=()=>state.map;
 state.getPlayerPosition=()=>state.position;
 for(const name of ['onAppend','onRemove','prepareMapTransition','resumeMapTransition','clearPath','startAutoWalk','stopAutoWalk']) {
  const method=source.match(new RegExp(`Navigation\\.${name} = function ${name}\\([^]*?\\n\\};`))?.[0];
  if(method) runInContext(method,state);
 }
 Navigation.navigateTo=vi.fn(options=>{
  state._targetData={map:options.startMap,x:options.endX,y:options.endY};
  state._autoWalkRequested=false;
  if(options.autoWalk) Navigation.startAutoWalk();
 });
 state.appendGameComponent=component=>{if(mobile)component.prepare();else component.onAppend();};
 const transition=(x,y)=>{
  Navigation.prepareMapTransition();
  if(!mobile)Navigation.onRemove();
  expect(state.Network.sendPacket).not.toHaveBeenCalled();
  state.position={x,y};
  runInContext(mount,state);
 };
 return {state,Navigation,transition};
}
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();});

it.each([false,true])('continues after consecutive same-map room warps (mobile=%s)',mobile=>{
 const {state,Navigation,transition}=harness(mobile);
 transition(236,163);
 expect(Navigation.navigateTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({startMap:'prt_in',startX:236,startY:163,endX:282,endY:176,autoWalk:true}));
 expect(state.Network.sendPacket).toHaveBeenCalledOnce();
 expect(state._autoWalkActive).toBe(true);
 state.Network.sendPacket.mockClear();Navigation.navigateTo.mockClear();
 transition(276,163);
 expect(Navigation.navigateTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({startX:276,startY:163,autoWalk:true}));
 expect(state.Network.sendPacket).toHaveBeenCalledOnce();
 expect(state._autoWalkActive).toBe(true);
});

it.each([false,true])('does not start a preview after map loading (mobile=%s)',mobile=>{
 const {state,transition}=harness(mobile,false);
 transition(236,163);
 expect(state.Network.sendPacket).not.toHaveBeenCalled();
 expect(state._autoWalkActive).toBe(false);
});

it.each([false,true])('honours cancellation while the new map is loading (mobile=%s)',mobile=>{
 const {state,Navigation}=harness(mobile);
 Navigation.prepareMapTransition();Navigation.stopAutoWalk();
 state.position={x:236,y:163};runInContext(mount,state);
 expect(state.Network.sendPacket).not.toHaveBeenCalled();
 expect(state._autoWalkActive).toBe(false);
});

it.each([false,true])('resumes from the real Hollgrehenn room exit (mobile=%s)', mobile => {
 const {state,Navigation,transition}=harness(mobile);
 state.position={x:63,y:60};
 state._finalTargetData={map:'prt_in',x:90,y:65};
 state._targetData={map:'prt_in',x:90,y:65};
 transition(84,65);
 expect(Navigation.navigateTo).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({startMap:'prt_in',startX:84,startY:65,endMap:'prt_in',endX:90,endY:65,autoWalk:true}));
 expect(state.Network.sendPacket).toHaveBeenCalledOnce();
 expect(state.Network.sendPacket.mock.calls[0][0].dest).toEqual([90,65]);
});
