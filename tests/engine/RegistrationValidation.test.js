import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { registrationError, registrationServerError } from '../../src/Engine/Auth/RegistrationValidation.js';

it('explains the kuga_M failure without treating the suffix as account length', () => {
	expect(registrationError('kuga_M', 'secret')).toContain('账号过短');
	expect(registrationError('kuga01_M', 'secret')).toBeNull();
});
it('validates both boundaries before the fixed-width packet can truncate input', () => {
	for (const suffix of ['_M', '_F', '_m', '_f']) {
		expect(registrationError('a'.repeat(5) + suffix, 'secret')).toContain('账号过短');
		expect(registrationError('a'.repeat(21) + suffix, 'a'.repeat(23))).toBeNull();
		expect(registrationError('a'.repeat(22) + suffix, 'secret')).toContain('账号过长');
	}
	expect(registrationError('kuga01_M', '12345')).toContain('密码过短');
	expect(registrationError('kuga01_M', 'a'.repeat(24))).toContain('密码过长');
});
it('counts UTF-8 bytes like the packet writer and leaves ordinary login alone', () => {
	expect(registrationError('测试_M', '密码')).toBeNull();
	expect(registrationError('测_M', 'secret')).toContain('账号过短');
	expect(registrationError('测'.repeat(8) + '_M', 'secret')).toContain('账号过长');
	expect(registrationError('kuga', '123')).toBeNull();
});
it('shows registration feedback without connecting, removing the form, or starting a spinner', () => {
	const fn = readFileSync('src/Engine/LoginEngine.js', 'utf8').match(/function onConnectionRequest\([^]*?\n\}/)[0];
	const showMessageBox = vi.fn(), connect = vi.fn(), remove = vi.fn(), append = vi.fn();
	const request = vm.runInNewContext(`(${fn})`, {
		registrationError, UIManager: { showMessageBox }, Network: { connect },
		WinLogin: { getUI: () => ({ remove }) }, WinLoading: { append },
	});
	request('kuga_M', 'secret');
	expect(showMessageBox).toHaveBeenCalledWith(expect.stringContaining('账号过短'), 'ok', null, true);
	expect(connect).not.toHaveBeenCalled();expect(remove).not.toHaveBeenCalled();expect(append).not.toHaveBeenCalled();
});

it('maps server registration failures and preserves unknown error codes and ordinary login errors', () => {
 const fn = readFileSync('src/Engine/LoginEngine.js','utf8').match(/function onConnectionRefused\([^]*?\n\}/)[0];
 const showMessageBox=vi.fn(), close=vi.fn(), remove=vi.fn();
 const receive=vm.runInNewContext(`(${fn})`, {
  registrationServerError,retryPendingSession:()=>false,sessionTicketLogin:false,
  WinLoading:{remove},Network:{close},UIManager:{showMessageBox},DB:{getMessage:id=>`message:${id}`},
 });
 for(const code of [200,201,202,203,204,205,206,207]) {
  receive({ErrorCode:code});
  expect(showMessageBox.mock.lastCall[0]).toBe(registrationServerError(code));
  expect(showMessageBox.mock.lastCall[0]).not.toContain('密码错误');
 }
 receive({ErrorCode:1});expect(showMessageBox.mock.lastCall[0]).toBe('message:267');
 receive({ErrorCode:999});expect(showMessageBox.mock.lastCall[0]).toBe('未知错误（错误码：999）');
 expect(close).toHaveBeenCalledTimes(10);expect(remove).toHaveBeenCalledTimes(10);
});

it('uses the same concise wording for local and server errors', () => {
 expect(registrationError('kuga_M','secret')).toBe(registrationServerError(200));
 expect(registrationError('kuga01_M','123')).toBe(registrationServerError(201));
 expect([200,201,202,203,204,205,206,207].map(registrationServerError)).toEqual([
  '账号过短','密码过短','账号已存在','注册过于频繁','账号保存失败','未开放注册','不支持当前密码加密方式','性别后缀无效',
 ]);
});
