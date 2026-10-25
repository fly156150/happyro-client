import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ mouse: { intersect: true, state: 0, MOUSE_STATE: { USESKILL: 1 }, screen: { x: 0, y: 0 } }, session: {}, over: null, focus: null, clear: vi.fn() }));
vi.mock('Controls/AttackIntent.js', () => ({ clearAttackIntent: state.clear }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: state.mouse }));
vi.mock('Engine/SessionStorage.js', () => ({ default: state.session }));
vi.mock('Renderer/EntityManager.js', () => ({ default: { getOverEntity: () => state.over, getFocusEntity: () => state.focus, setFocusEntity: value => { state.focus = value; } } }));
vi.mock('Renderer/Entity/Entity.js', () => ({ default: { TYPE_MOB: 1 } }));
vi.mock('Renderer/Renderer.js', () => ({ default: { canvas: document.createElement('canvas') } }));
vi.mock('Core/Mobile.js', () => ({ default: { init: vi.fn() } }));
vi.mock('Controls/KeyEventHandler.js', () => ({ default: { SHIFT: false, ALT: false, CTRL: false } }));
vi.mock('Preferences/Controls.js', () => ({ default: { noctrl: false } }));
vi.mock('UI/UIManager.js', () => ({ default: {} }));
vi.mock('UI/CursorManager.js', () => ({ default: { setType: vi.fn(), ACTION: { ROTATE: 1, DEFAULT: 0 } } }));
vi.mock('Renderer/Camera.js', () => ({ default: { rotate: vi.fn() } }));
vi.mock('DB/DBManager.js', () => ({ default: {} }));
vi.mock('UI/Components/InputBox/InputBox.js', () => ({ default: {} }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({ default: {} }));
vi.mock('UI/Components/Equipment/Equipment.js', () => ({ default: {} }));
vi.mock('UI/Components/Inventory/Inventory.js', () => ({ default: {} }));
vi.mock('UI/Components/SkillTargetSelection/SkillTargetSelection.js', () => ({ default: {} }));
vi.mock('Core/AIDriver.js', () => ({ default: {} }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: {} }));
vi.mock('Network/PacketVerManager.js', () => ({ default: {} }));
vi.mock('Network/PacketStructure.js', () => ({ default: {} }));
vi.mock('Network/NetworkManager.js', () => ({ default: {} }));
vi.mock('Core/Events.js', () => ({ default: {} }));
vi.mock('UI/Components/Captcha/CaptchaSelector.js', () => ({ default: {} }));
vi.mock('Controls/ScreenShot.js', () => ({}));
import MapControl from '../../src/Controls/MapControl.js';
import { subscribeGameInput } from '../../src/Controls/GameInputIntent.js';
let input, unsubscribe;
beforeAll(() => MapControl.init());
beforeEach(() => {
	vi.clearAllMocks(); state.over = state.focus = null; state.mouse.intersect = true; state.mouse.state = 0;
	state.session.Entity = {}; state.session.TouchTargeting = false;
	MapControl.onRequestWalk = vi.fn(); MapControl.onRequestStopWalk = vi.fn();
	input = vi.fn(() => false); unsubscribe = subscribeGameInput(input);
});
afterEach(() => unsubscribe());
function mouse(type, which = 1) { window.dispatchEvent(new MouseEvent(type, { which, button: which === 3 ? 2 : 0 })); }
function monster() { return { GID: 42, objecttype: 1, constructor: { TYPE_MOB: 1 }, onMouseDown: vi.fn(() => true), onFocus: vi.fn(), onMouseUp: vi.fn(), onFocusEnd: vi.fn() }; }
it('pauses before walking and releases manual movement even if the pointer ends over a UI', () => {
	mouse('mousedown'); expect(input).toHaveBeenCalledWith('move-start', undefined);
	expect(input.mock.invocationCallOrder[0]).toBeLessThan(MapControl.onRequestWalk.mock.invocationCallOrder[0]);
	state.mouse.intersect = false; mouse('mouseup'); expect(input).toHaveBeenLastCalledWith('move-end', undefined);
});
it('routes an automated target click once and does not cancel its attack on mouseup', () => {
	state.over = monster(); input.mockImplementation(kind => kind === 'attack-target');
	mouse('mousedown'); mouse('mouseup');
	expect(input).toHaveBeenCalledWith('attack-target', 42);
	expect(state.over.onMouseDown).not.toHaveBeenCalled(); expect(state.over.onFocusEnd).not.toHaveBeenCalled();
	expect(state.clear).not.toHaveBeenCalled(); expect(MapControl.onRequestWalk).not.toHaveBeenCalled();
});
it('keeps ordinary desktop monster clicks when automation does not own the target', () => {
	state.over = monster(); mouse('mousedown');
	expect(state.over.onMouseDown).toHaveBeenCalledOnce(); expect(state.clear).toHaveBeenCalledOnce();
});
it('never intercepts a pending manual skill as automatic retargeting', () => {
	state.mouse.state = 1; state.over = monster(); mouse('mousedown');
	expect(input).not.toHaveBeenCalledWith('attack-target', 42); expect(input).toHaveBeenCalledWith('action', undefined);
});

it('ignores ordinary self clicks without selecting actions or walking', () => {
 const self = { ...monster(), objecttype: 0 };
 state.session.Entity = state.over = self;
 mouse('mousedown'); mouse('mouseup');
 expect(state.focus).toBeNull(); expect(input).not.toHaveBeenCalledWith('action', undefined); expect(MapControl.onRequestWalk).not.toHaveBeenCalled();
 state.over = null; mouse('mousedown');
 expect(state.focus).toBeNull(); expect(MapControl.onRequestWalk).toHaveBeenCalledOnce();
});
it('also clears self selection on touch ground clicks', () => {
 state.session.TouchTargeting = true;
 state.session.Entity = state.focus = monster();
 mouse('mousedown'); expect(state.focus).toBeNull();
});
