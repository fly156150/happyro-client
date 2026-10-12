import { describe, expect, it } from 'vitest';
import defaultLoginHtml from '../../src/UI/Components/WinLogin/WinLogin/WinLogin.html?raw';
import loginV2Html from '../../src/UI/Components/WinLogin/WinLoginV2/WinLoginV2.html?raw';
import loginCommonSource from '../../src/UI/Components/WinLogin/WinLoginCommon.js?raw';
import { normalizeRememberedAccount } from '../../src/UI/Components/WinLogin/RememberedAccount.js';

describe('WinLogin localization', () => {
	it.each([defaultLoginHtml, loginV2Html])('uses a Chinese keep-login control', html => {
		expect(html).toContain('保持登录');
		expect(html).toContain('role="checkbox"');
		expect(html).not.toContain('chk_save');
	});

	it('uses Chinese simplified-registration instructions', () => {
		expect(loginCommonSource).toContain('自动注册：');
		expect(loginCommonSource).toContain('_M（男）');
		expect(loginCommonSource).toContain('_F（女）');
		expect(loginCommonSource).not.toContain('No registration URL was provided');
	});

	it('uses the original login bitmap and a Chinese registration command', () => {
		expect(loginV2Html).toContain('class="server-name">HappyRO</div>');
		expect(loginV2Html).toContain('bt_start_normal.bmp');
		expect(loginV2Html).toContain('bt_start_over.bmp');
		expect(loginV2Html).toContain('bt_start_press.bmp');
		expect(loginV2Html).toContain('data-localized-label="注册"');
		expect(loginV2Html.match(/id="btn_connect"/g)).toHaveLength(1);
		expect(loginV2Html).toContain('id="btn_signup"');
	});

	it('does not clear remembered account text on mousedown', () => {
		expect(loginCommonSource).not.toMatch(/addEventListener\('mousedown'[\s\S]{0,120}this\.value = ''/);
	});

	it.each([
		['happyro_M', 'happyro'],
		['happyro_F', 'happyro'],
		['happyro_m', 'happyro'],
		['happyro_f', 'happyro'],
		['happyro', 'happyro'],
		['happyro_M_test', 'happyro_M_test']
	])('remembers %s as %s', (account, expected) => {
		expect(normalizeRememberedAccount(account)).toBe(expected);
	});

	it('normalizes remembered accounts when loading and saving login preferences', () => {
		expect(loginCommonSource.match(/normalizeRememberedAccount/g)).toHaveLength(3);
	});
});
