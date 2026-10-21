import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { registrationError } from '../../src/Engine/Auth/RegistrationValidation.js';
import Background from '../../src/UI/Mobile/Background.js';

afterEach(() => Background.remove());
const root = () => document.querySelector('#MobileBackground').shadowRoot;

describe('mobile loading lifecycle', () => {
	it('shows the Poring image and actual resource progress without a desktop canvas', () => {
		const ready = vi.fn();
		Background.init();
		Background.setImage('bgi_temp.bmp', ready);
		Background.setPercent(42.9);
		expect(ready).toHaveBeenCalledOnce();
		expect(root().querySelector('progress').value).toBe(42);
		expect(root().querySelector('.loading-percent').textContent).toBe('42%');
		expect(root().querySelector('.loading-poring').getAttribute('src')).toBe('./ro-poring-1.webp');
		expect(root().querySelector('canvas')).toBeNull();
		Background.resize(844, 390);
		expect(root().querySelector('progress').value).toBe(42);
	});
	it('clears resource progress for login, resets map progress, and removes itself before entering the map', () => {
		Background.setImage('bgi_temp.bmp');
		Background.setPercent(100);
		Background.setLoginBackground();
		expect(root().querySelector('.loading-card').hidden).toBe(true);
		Background.setLoading(() => {
			expect(root().querySelector('.loading-title').textContent).toBe('正在加载地图');
			expect(root().querySelector('.loading-poring').hidden).toBe(false);
			expect(root().querySelector('progress').value).toBe(0);
		});
		Background.setPercent(73);
		Background.remove(() => expect(document.querySelector('#MobileBackground')).toBeNull());
		Background.setPercent(100);
		expect(document.querySelector('#MobileBackground')).toBeNull();
	});
	it('removes the connecting screen before reporting a failed login connection', () => {
		const source = readFileSync('src/Engine/LoginEngine.js', 'utf8');
		const fn = source.match(/function onConnectionRequest\([^]*?\n\}/)[0];
		let waiting = false;
		const request = vm.runInNewContext(`(${fn})`, {
			authGeneration: 0, sessionTicketLogin: false, keepLogin: false, registrationError,
			Sound: { play() {} }, _server: { address: 'test', port: 6900 }, _loginID: '',
			WinLogin: { getUI: () => ({ remove() {} }) },
			WinLoading: { append: () => { waiting = true; }, remove: () => { waiting = false; } },
			Network: { connect: (_host, _port, callback) => { expect(waiting).toBe(true); callback(false); } },
			DB: { getMessage: () => '服务器连接失败' },
			UIManager: { showMessageBox: () => expect(waiting).toBe(false) }
		});
		request('account', 'password');
	});
});
