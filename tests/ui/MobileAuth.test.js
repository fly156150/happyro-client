import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	globalThis.ResizeObserver = class { observe() {} disconnect() {} };
	HTMLElement.prototype.scrollIntoView = () => {};
});

// Exercise real templates, factories and shell. Only rendering/network-adjacent
// services and the general GUI host are replaced at their boundaries.
vi.mock('UI/GUIComponent.js', () => ({ default: class {
	static MouseMode = { FREEZE: 2 };
	constructor(name, css) { this.name = name; this.css = css; }
	prepare() {
		this._host = document.createElement('div');
		this._shadow = this._host.attachShadow({ mode: 'open' });
		this._shadow.innerHTML = `<style>${this.css}</style>${this.render()}`;
		this.init();
	}
	getRoot() { return this._shadow; }
	append() { if (!this._host) this.prepare(); document.body.append(this._host); this.onAppend?.(); }
	remove() { this.onRemove?.(); this._host?.remove(); }
	draggable() { this.isDraggable = true; }
	placeOnTop() {}
	on() {}
	off() {}
} }));
vi.mock('UI/Elements/Elements.js', () => ({}));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: c => c, showPromptBox: vi.fn(), showMessageBox: vi.fn() } }));
vi.mock('DB/DBManager.js', () => ({ default: { INTERFACE_PATH: '', getMessage: id => `消息 ${id}`, getMapName: s => s } }));
vi.mock('DB/Jobs/JobDisplayNameTable.js', () => ({ getJobDisplayName: () => '初心者' }));
vi.mock('Core/Client.js', () => ({ default: { loadFile: vi.fn((path, callback) => callback('data:,')) } }));
vi.mock('Core/Configs.js', () => ({ default: { get: key => key === 'renewal' } }));
vi.mock('Core/Preferences.js', () => ({ default: { get: (name, defaults) => ({ ...defaults, save: vi.fn() }) } }));
vi.mock('Controls/KeyEventHandler.js', () => ({ default: { ENTER: 13, ESCAPE: 27, TAB: 9, LEFT: 37, RIGHT: 39 } }));
vi.mock('Renderer/Renderer.js', () => ({ default: { render: vi.fn(), stop: vi.fn(), resize: vi.fn() } }));
vi.mock('Renderer/SpriteRenderer.js', () => ({ default: { bind2DContext: vi.fn() } }));
vi.mock('Renderer/Camera.js', () => ({ default: {} }));
vi.mock('Renderer/Entity/Entity.js', () => ({ default: class {
	set(data) { Object.assign(this, data); }
	renderEntity() {}
} }));
vi.mock('Network/PacketVerManager.js', () => ({ default: { value: 20211103 } }));

import { createCharSelect } from '../../src/UI/Components/CharSelect/CharSelectCommon.js';
import Login from '../../src/UI/Mobile/WinLogin/WinLogin.js';
import Select from '../../src/UI/Mobile/auth/CharSelect.js';
import Create from '../../src/UI/Mobile/auth/CharCreate.js';
import Renderer from 'Renderer/Renderer.js';
import Client from 'Core/Client.js';


// Exercise the desktop deletion capability with the same shared grid factory.
function createDeletionSelect() {
	return createCharSelect({
		name: 'DeletionSelect', cssText: '', gridLayout: true, deleteReservation: true,
		bitmapSkin: false, activationEvent: 'click',
		htmlText: Select.render() + '<button class="delete"></button><button class="canceldelete"></button><button class="finaldelete"></button>',
		onSelectionChange(root, { index, character }) {
			root.querySelectorAll('.char_canvas').forEach((slot, i) => slot.setAttribute('aria-pressed', String(i === index)));
			root.querySelector('.make').hidden = !!character;
		}
	});
}

const mounted = new Set();
function mount(component) { mounted.add(component); component.append(); return component.getRoot(); }
function unmount(component) { component.remove(); mounted.delete(component); }
const character = () => ({ CharNum: 0, GID: 123, name: '初心者', job: 0, level: 1, lastMap: 'prontera',
	hp: 40, sp: 10, exp: 0, Str: 1, Agi: 1, Vit: 1, Int: 1, Dex: 1, Luk: 1, DeleteDate: 0 });

beforeEach(() => {
	vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
		return { canvas: this, clearRect: vi.fn() };
	});
	vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
});
afterEach(async () => {
	for (const component of mounted) unmount(component);
	await Promise.resolve();
	document.head.querySelectorAll('meta[name=viewport]').forEach(el => el.remove());
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('mobile authentication', () => {
	it('resets the selection on a new login after an empty slot was selected', () => {
		const root = mount(Select);
		const packet = { TotalSlotNum: 3, PremiumStartSlot: 0, sex: 1, charInfo: [character()] };
		Select.setInfo(packet);
		root.querySelector('#slot1').click();
		expect(root.querySelector('#slot1').getAttribute('aria-pressed')).toBe('true');
		Select.setInfo(packet);
		expect(root.querySelector('#slot0').getAttribute('aria-pressed')).toBe('true');
		expect(root.querySelector('.make').hidden).toBe(true);
	});
	it('omits all deletion controls for normal and reserved mobile characters', () => {
		const root = mount(Select);
		Select.setInfo({ TotalSlotNum: 3, PremiumStartSlot: 0, sex: 1, charInfo: [character()] });
		for (const DeleteDate of [0, 60]) {
			Select.addCharacter({ ...character(), DeleteDate });
			root.querySelector('#slot0').click();
			expect(root.querySelector('.delete, .canceldelete, .finaldelete')).toBeNull();
			root.querySelector('#slot1').click();
			expect(root.querySelector('.make').hidden).toBe(false);
		}
	});
	it('does not request desktop bitmap decorations for phone selection or creation', () => {
		Client.loadFile.mockClear();
		mount(Select);
		Select.setInfo({ TotalSlotNum: 3, PremiumStartSlot: 0, sex: 1, charInfo: [character()] });
		unmount(Select);
		const root = mount(Create);
		root.querySelector('#doram_race').click();
		root.querySelector('.female_button').click();
		Renderer.render.mock.calls.at(-1)[0](1000);
		expect(Client.loadFile.mock.calls.every(([path]) => /make_character_ver2\/color0[1-9]_off\.bmp$/.test(path))).toBe(true);
	});
	it('keeps the deletion target fixed until the server answers, then unlocks selection', () => {
		const Select = createDeletionSelect();
		const root = mount(Select);
		Select.setInfo({ TotalSlotNum: 3, PremiumStartSlot: 0, sex: 1, charInfo: [character()] });
		root.querySelector('#slot0').click();
		Select.onDeleteReqDelay = vi.fn();
		root.querySelector('.delete').click();
		root.querySelector('#slot1').click();
		expect(root.querySelector('#slot0').getAttribute('aria-pressed')).toBe('true');
		expect(() => Select.reqdeleteAnswer({ Result: 1, DeleteReservedDate: 60 })).not.toThrow();
		root.querySelector('#slot1').click();
		expect(root.querySelector('#slot1').getAttribute('aria-pressed')).toBe('true');
		root.querySelector('#slot0').click();
		Select.onDeleteRequest = vi.fn();
		root.querySelector('.finaldelete').click();
		root.querySelector('#slot1').click();
		expect(root.querySelector('#slot0').getAttribute('aria-pressed')).toBe('true');
		Select.deleteAnswer(1);
		expect(root.querySelector('#slot0 .name').textContent).toBe('');
		root.querySelector('#slot1').click();
		expect(root.querySelector('#slot1').getAttribute('aria-pressed')).toBe('true');
	});
	it('refreshes selected actions when a character list chunk arrives and treats names as text', () => {
		const root = mount(Select);
		Select.setInfo({ TotalSlotNum: 3, PremiumStartSlot: 0, sex: 1, charInfo: [] });
		root.querySelector('#slot0').click();
		expect(root.querySelector('.make').hidden).toBe(false);
		Select.addCharacter({ ...character(), name: '<b>角色</b>' });
		expect(root.querySelector('.make').hidden).toBe(true);
		expect(root.querySelector('.ok').style.display).not.toBe('none');
		expect(root.querySelector('#slot0 .name').textContent).toBe('<b>角色</b>');
		expect(root.querySelector('#slot0 .name b')).toBeNull();
		expect(root.querySelector('#slot0 .empty-placeholder').hidden).toBe(true);
		expect(root.querySelector('#slot1 .empty-placeholder').hidden).toBe(false);
		Select.addCharacter({ ...character(), CharNum: 1, GID: 456, name: '新到达角色' });
		expect(root.querySelector('#slot1 .empty-placeholder').hidden).toBe(true);
		expect(root.querySelector('#slot1').dataset.empty).toBe('false');
		Select.onCreateRequest = vi.fn();
		root.querySelector('.make').click();
		expect(Select.onCreateRequest).not.toHaveBeenCalled();
	});
	it('releases failed deletion waits without releasing an external UI lock', () => {
		const Select = createDeletionSelect();
		const root = mount(Select);
		Select.setInfo({ TotalSlotNum: 3, PremiumStartSlot: 0, sex: 1, charInfo: [character()] });
		root.querySelector('#slot0').click();
		Select.onDeleteReqDelay = vi.fn();
		root.querySelector('.delete').click();
		Select.setUIEnabled(false);
		Select.reqdeleteAnswer({ Result: 3 });
		root.querySelector('#slot1').click();
		expect(root.querySelector('#slot0').getAttribute('aria-pressed')).toBe('true');
		Select.setUIEnabled(true);
		root.querySelector('#slot1').click();
		expect(root.querySelector('#slot1').getAttribute('aria-pressed')).toBe('true');
		root.querySelector('#slot0').click();
		Select.onDeleteRequest = vi.fn();
		root.querySelector('.finaldelete').click();
		Select.deleteAnswer(-2);
		root.querySelector('#slot1').click();
		expect(root.querySelector('#slot1').getAttribute('aria-pressed')).toBe('true');
		expect(root.querySelector('#slot0 .name').textContent).toBe('初心者');
	});
	it('navigates empty slots by keyboard without leaving the available slot range', () => {
		const root = mount(Select);
		Select.setInfo({ TotalSlotNum: 3, PremiumStartSlot: 0, sex: 1, charInfo: [] });
		root.querySelector('#slot0').click();
		for (let i = 0; i < 5; i++) Select.onKeyDown({ which: 39, stopImmediatePropagation() {} });
		expect(root.querySelector('#slot2').getAttribute('aria-pressed')).toBe('true');
		Select.onCreateRequest = vi.fn();
		root.querySelector('.make').click();
		expect(Select.onCreateRequest).toHaveBeenCalledExactlyOnceWith(2);
	});
	it('does not move a locked selection or cancel its deletion reservation', () => {
		const Select = createDeletionSelect();
		const root = mount(Select);
		Select.setInfo({ TotalSlotNum: 3, PremiumStartSlot: 0, sex: 1, charInfo: [character()] });
		root.querySelector('#slot0').click();
		Select.onCancelDeleteRequest = vi.fn();
		Select.setUIEnabled(false);
		try {
			root.querySelector('#slot1').click();
			Select.onKeyDown({ which: 39, stopImmediatePropagation() {} });
			expect(root.querySelector('#slot0').getAttribute('aria-pressed')).toBe('true');
			root.querySelector('.canceldelete').click();
			expect(Select.onCancelDeleteRequest).not.toHaveBeenCalled();
		} finally { Select.setUIEnabled(true); }
	});
	it('leaves native button activation and external text editing to the browser', () => {
		const root = mount(Select);
		Select.setInfo({ TotalSlotNum: 3, PremiumStartSlot: 0, sex: 1, charInfo: [] });
		Select.onCreateRequest = vi.fn();
		const cancel = root.querySelector('.cancel');
		cancel.focus();
		expect(Select.onKeyDown({ which: 13, composedPath: () => [cancel], stopImmediatePropagation() {} })).toBe(true);
		expect(Select.onCreateRequest).not.toHaveBeenCalled();
		const external = document.createElement('textarea');
		expect(Select.onKeyDown({ which: 13, composedPath: () => [external], stopImmediatePropagation() {} })).toBe(true);
		expect(Select.onCreateRequest).not.toHaveBeenCalled();
	});
	it('resets both the model and visible hairstyle list after reopening creation', () => {
		const root = mount(Create);
		root.querySelector('#doram_race').click();
		unmount(Create);
		mount(Create);
		expect(root.querySelector('#human_race').checked).toBe(true);
		expect(root.querySelector('#human_male').style.display).not.toBe('none');
		expect(root.querySelector('#doram_male').style.display).toBe('none');
	});
	it('submits native radio changes from keyboard or assistive controls', () => {
		const root = mount(Create);
		for (const id of ['doram_race', 'female', '6_doram_female', '2_color']) {
			const radio = root.getElementById(id);
			radio.checked = true;
			radio.dispatchEvent(new Event('change', { bubbles: true }));
		}
		root.querySelector('#char_name').value = '原生操作';
		expect(root.querySelector('#doram_female').style.display).not.toBe('none');
		expect(root.querySelector('#doram_male').style.display).toBe('none');
		expect(root.getElementById('6_doram_female').checked).toBe(true);
		Create.onCharCreationRequest = vi.fn();
		root.querySelector('.make').click();
		expect(Create.onCharCreationRequest).toHaveBeenCalledExactlyOnceWith('原生操作', 1, 1, 1, 1, 1, 1, 6, 2, 4218, 0);
	});
	it('submits unchanged credentials, remembers the normalized ID, and never drags or auto-focuses', () => {
		const root = mount(Login);
		expect(Login.isDraggable).not.toBe(true);
		expect(root.activeElement).toBeNull();
		root.querySelector('#m-login-user').value = 'test_M';
		root.querySelector('#m-login-pass').value = 'secret';
		Login.onConnectionRequest = vi.fn();
		root.querySelector('#m-login-user').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(root.activeElement).toBe(root.querySelector('#m-login-pass'));
		expect(Login.onConnectionRequest).not.toHaveBeenCalled();
		Login.onKeyDown({ which: 13, isComposing: true });
		expect(Login.onConnectionRequest).not.toHaveBeenCalled();
		root.querySelector('.m-login__connect').click();
		expect(Login.onConnectionRequest).toHaveBeenCalledExactlyOnceWith('test_M', 'secret', false);
		unmount(Login);
		mount(Login);
		expect(root.querySelector('#m-login-user').value).toBe('test');
		expect(root.querySelector('#m-login-pass').value).toBe('');
	});
	it('isolates touches from game handlers without cancelling native controls', () => {
		const root = mount(Login);
		const touch = vi.fn();
		window.addEventListener('touchstart', touch);
		const event = new Event('touchstart', { bubbles: true, cancelable: true, composed: true });
		root.querySelector('#m-login-user').dispatchEvent(event);
		expect(touch).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
		window.removeEventListener('touchstart', touch);
	});
	it('selects, connects, creates in the selected empty slot, and preserves UI locking', () => {
		const root = mount(Select);
		Select.setInfo({ TotalSlotNum: 3, PremiumStartSlot: 0, sex: 1, charInfo: [character()] });
		Select.onConnectRequest = vi.fn();
		Select.onCreateRequest = vi.fn();
		root.querySelector('#slot0').click();
		root.querySelector('.ok').click();
		expect(Select.onConnectRequest).toHaveBeenCalledWith(expect.objectContaining({ GID: 123 }));
		root.querySelector('#slot1').click();
		expect(root.querySelector('.make').hidden).toBe(false);
		expect(root.querySelector('#slot3').hidden).toBe(true);
		root.querySelector('.make').click();
		expect(Select.onCreateRequest).toHaveBeenCalledExactlyOnceWith(1);
		Select.setUIEnabled(false);
		root.querySelector('.make').click();
		expect(Select.onCreateRequest).toHaveBeenCalledTimes(1);
		Select.setUIEnabled(true);
	});
	it('keeps reservation, cancellation and successful deletion in the shared flow', () => {
		const Select = createDeletionSelect();
		const root = mount(Select);
		Select.setInfo({ TotalSlotNum: 3, PremiumStartSlot: 0, sex: 1, charInfo: [character()] });
		root.querySelector('#slot0').click();
		Select.onDeleteReqDelay = vi.fn();
		root.querySelector('.delete').click();
		expect(Select.onDeleteReqDelay).toHaveBeenCalledExactlyOnceWith(123);
		Select.reqdeleteAnswer({ Result: 1, DeleteReservedDate: 60 });
		expect(root.querySelector('.canceldelete').style.display).toBe('block');
		Select.onCancelDeleteRequest = vi.fn();
		root.querySelector('.canceldelete').click();
		expect(Select.onCancelDeleteRequest).toHaveBeenCalledExactlyOnceWith(123);
		Select.deleteAnswer(1);
		expect(root.querySelector('.make').hidden).toBe(false);
		expect(root.querySelector('#slot0 .name').textContent).toBe('');
	});
	it('submits selected race, gender, hair and color without render stealing focus', () => {
		const root = mount(Create);
		expect(Create.isDraggable).not.toBe(true);
		expect(root.activeElement).toBeNull();
		root.querySelector('#char_name').value = '新角色';
		root.querySelector('#doram_race').click();
		root.querySelector('.female_button').click();
		root.querySelector('[for="6_doram_female"]').click();
		root.querySelector('[for="2_color"]').click();
		root.querySelector('.rot_right').focus();
		const render = Renderer.render.mock.calls.at(-1)[0];
		render(1000);
		expect(root.activeElement).toBe(root.querySelector('.rot_right'));
		Create.onCharCreationRequest = vi.fn();
		root.querySelector('.make').click();
		expect(Create.onCharCreationRequest).toHaveBeenCalledExactlyOnceWith('新角色', 1, 1, 1, 1, 1, 1, 6, 2, 4218, 0);
	});
	it('keeps the viewport stable between panels and restores it when leaving authentication', async () => {
		const meta = document.createElement('meta');
		meta.name = 'viewport'; meta.content = 'width=980'; document.head.append(meta);
		mount(Login);
		expect(meta.content).toContain('width=device-width');
		unmount(Login);
		mount(Select);
		await Promise.resolve();
		expect(meta.content).toContain('width=device-width');
		unmount(Select);
		await Promise.resolve();
		expect(meta.content).toBe('width=980');
	});
});
