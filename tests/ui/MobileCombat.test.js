vi.mock('UI/Game/GameVending.js',()=>({showOwnedVending:()=>false}));
import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
	session: { TouchTargeting: false, autoFollow: false, Entity: null },
	send: vi.fn(),
	search: vi.fn(),
	error: vi.fn(),
	keys: { SHIFT: false },
	preferences: { noshift: false },
	cursor: { ACTION: { LOCK: 1, DEFAULT: 0 }, setType: vi.fn() }
}));
vi.mock('Utils/gl-matrix.js', () => ({ default: { mat4: { create: () => [] }, vec2: {} } }));
vi.mock('Utils/PathFinding.js', () => ({ default: { search: state.search } }));
vi.mock('DB/DBManager.js', () => ({ default: { getMessage: () => 'overweight' } }));
vi.mock('Controls/KeyEventHandler.js', () => ({ default: state.keys }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: {} }));
vi.mock('Preferences/Controls.js', () => ({ default: state.preferences }));
vi.mock('Renderer/Camera.js', () => ({ default: { action: { active: false } } }));
vi.mock('Engine/SessionStorage.js', () => ({ default: state.session }));
vi.mock('Engine/MapEngine/Friends.js', () => ({ default: {} }));
vi.mock('Network/PacketVerManager.js', () => ({ default: { value: 20211103 } }));
vi.mock('Network/PacketStructure.js', () => ({
	default: {
		CZ: {
			CHANGE_DIRECTION2: class {},
			REQUEST_ACT2: class {},
			REQUEST_MOVE2: class {
				dest = [];
			},
			CANCEL_LOCKON: class {}
		}
	}
}));
vi.mock('Network/NetworkManager.js', () => ({ default: { sendPacket: state.send } }));
vi.mock('UI/CursorManager.js', () => ({ default: state.cursor }));
vi.mock('UI/Components/InputBox/InputBox.js', () => ({ default: {} }));
vi.mock('UI/Components/ChatRoom/ChatRoom.js', () => ({ default: {} }));
vi.mock('UI/Components/ContextMenu/ContextMenu.js', () => ({ default: {} }));
vi.mock('UI/Components/PetInformations/PetInformations.js', () => ({ default: {} }));
vi.mock('UI/Components/Trade/Trade.js', () => ({ default: {} }));
vi.mock('UI/Components/NpcBox/NpcBox.js', () => ({ default: {} }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: {} }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({
	default: { addText: state.error, TYPE: { ERROR: 1 }, FILTER: { PUBLIC_LOG: 1 } }
}));
vi.mock('UI/Components/Equipment/Equipment.js', () => ({ default: {} }));
vi.mock('UI/Components/Captcha/CaptchaSelector.js', () => ({ default: {} }));
vi.mock('Engine/MapEngine/Guild.js', () => ({ default: {} }));
vi.mock('UI/Components/PartyFriends/PartyFriends.js', () => ({ default: {} }));
vi.mock('Engine/MapEngine/Group.js', () => ({ default: {} }));
vi.mock('UI/Components/HomunInformations/HomunInformations.js', () => ({ default: {} }));
vi.mock('UI/Components/MercenaryInformations/MercenaryInformations.js', () => ({ default: {} }));
import initialize from '../../src/Controls/EntityControl.js';
let target;
beforeEach(() => {
	vi.clearAllMocks();
	state.session.TouchTargeting = false;
	state.session.autoFollow = false;
	state.session.moveAction = null;
	state.session.Entity = { position: [1, 1], attack_range: 1, lookTo: vi.fn(), isOverWeight: false };
	target = { constructor: { TYPE_MOB: 1 }, objecttype: 1, position: [2, 2], GID: 42, attachments: { add: vi.fn() } };
	initialize.call(target);
	state.search.mockImplementation((x, y, tx, ty, range, out) => {
		out.push(1, 1, 2, 2);
		return 1;
	});
});
it('selecting adds a marker without sending combat packets', () => {
	target.onFocus({ attack: false });
	expect(target.attachments.add).toHaveBeenCalled();
	expect(state.send).not.toHaveBeenCalled();
});
it('desktop default still attacks while touch targeting waits for explicit attack', () => {
	target.onFocus();
	expect(state.send.mock.calls.at(-1)[0]).toMatchObject({ action: 7, targetGID: 42 });
	state.send.mockClear();
	state.session.TouchTargeting = true;
	target.onFocus();
	expect(state.send).not.toHaveBeenCalled();
	target.onFocus({ attack: true });
	expect(state.send.mock.calls.at(-1)[0]).toMatchObject({ action: 7, targetGID: 42 });
});
it('does not chase while the joystick owns movement, but can chase when standing', () => {
	state.search.mockImplementation((x, y, tx, ty, range, out) => {
		out.push(1, 1, 2, 2);
		return 2;
	});
	target.onFocus({ attack: true, allowMove: false });
	expect(state.send).not.toHaveBeenCalled();
	expect(state.session.moveAction).toBeNull();
	target.onFocus({ attack: true });
	expect(state.session.moveAction).toMatchObject({ targetGID: 42 });
	expect(state.send.mock.calls.at(-1)[0].dest).toEqual([2, 2]);
});
it('retains path and overweight checks', () => {
	state.search.mockReturnValue(0);
	target.onFocus({ attack: true });
	expect(state.send).not.toHaveBeenCalled();
	state.search.mockReturnValue(1);
	state.session.Entity.isOverWeight = true;
	target.onFocus({ attack: true });
	expect(state.error).toHaveBeenCalled();
	expect(state.send).not.toHaveBeenCalled();
});
