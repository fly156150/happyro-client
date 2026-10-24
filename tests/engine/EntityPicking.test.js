import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
 types: { TYPE_PC: 0, TYPE_MOB: 5, TYPE_EFFECT: 99, PickingPriority: { Normal: { 0: 0, 5: 0 }, Support: { 0: 0, 5: 0 } } },
 graphics: { performanceMode: false, viewArea: 10 }, mouse: { screen: { x: 50, y: 50 } }
}));
vi.mock('Engine/SessionStorage.js', () => ({ default: { Entity: { position: [0, 0] } } }));
vi.mock('Renderer/Entity/Entity.js', () => ({ default: state.types }));
vi.mock('Renderer/SpriteRenderer.js', () => ({ default: { bind3DContext: vi.fn(), unbind: vi.fn() } }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: state.mouse }));
vi.mock('Controls/KeyEventHandler.js', () => ({ default: {} }));
vi.mock('Utils/PathFinding.js', () => ({ default: {} }));
vi.mock('Preferences/Graphics.js', () => ({ default: state.graphics }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: {} }));
vi.mock('Renderer/GR2/GR2ModelRenderer.js', () => ({ default: {} }));
import manager from '../../src/Renderer/EntityManager.js';
function mob(id) {
 return { GID: id, constructor: state.types, objecttype: 5, depth: id, action: 0, ACTION: { DIE: 9 },
  remove_tick: 0, position: [0, 0], boundingRect: { x1: 10, x2: 90, y1: 10, y2: 90 },
  clean: vi.fn(), render: vi.fn(), showExamName: true, display: { remove: vi.fn() } };
}
beforeEach(() => { manager.free(); state.graphics.performanceMode = false; });
it('returns all overlapping instances in ordinary pick order and excludes dead and fading monsters', () => {
 const mobs = [1, 2, 3, 4].map(mob); mobs.forEach(entity => manager.add(entity));
 mobs[2].action = 9; mobs[3].remove_tick = 1;
 expect(manager.intersect()).toBe(mobs[0]); expect(manager.intersect(true)).toEqual(mobs.slice(0, 2));
});
it('excludes offscreen and culled entities from the overlap list', () => {
 const mobs = [1, 2, 3].map(mob); mobs.forEach(entity => manager.add(entity));
 mobs[1].boundingRect.x1 = 60; mobs[2].position = [20, 20]; state.graphics.performanceMode = true;
 expect(manager.intersect(true)).toEqual([mobs[0]]);
});
it('removes persistent labels when culling and handles an empty scene', () => {
 expect(manager.intersect(true)).toEqual([]); expect(() => manager.render()).not.toThrow();
 const entity = mob(1); entity.position = [20, 20]; manager.add(entity); state.graphics.performanceMode = true;
 manager.render(null, null, null, null, false);
 expect(entity.display.remove).toHaveBeenCalledOnce(); expect(entity.render).not.toHaveBeenCalled();
});
