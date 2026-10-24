/**
 * UI/Mobile/WinLogin/WinLogin.js
 *
 * Mobile login window.
 * Exposes the same public API as WinLoginCommon:
 *   onConnectionRequest(user, pass)
 *   onExitRequest()
 */

import Configs from 'Core/Configs.js';
import Preferences from 'Core/Preferences.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import MobileGUIComponent from 'UI/MobileGUIComponent.js';
import { normalizeRememberedAccount } from 'UI/Components/WinLogin/RememberedAccount.js';
import htmlText from './WinLogin.html?raw';
import cssText from './WinLogin.css?raw';
import loginDialogCSS from '../LoginDialog.css?raw';
import shellCSS from '../Shell.css?raw';
import { withMobileShell } from '../Shell.js';

const MobileWinLogin = new MobileGUIComponent('MobileWinLogin', loginDialogCSS + cssText + shellCSS);

MobileWinLogin.render = () => htmlText;

// FREEZE mode: blocks all game touch/mouse input while login screen is active,
// which is required for the soft keyboard to appear on mobile.
MobileWinLogin.mouseMode = GUIComponent.MouseMode.FREEZE;

const _preferences = Preferences.get('WinLogin', { keepLogin: false, ID: '' }, 1.0);

let _inputUser;
let _inputPass;
let _btnSave;
let _signupDialog;
let _registrationURL;

MobileWinLogin.init = function init() {
	const root = this._shadow;

	_inputUser = root.getElementById('m-login-user');
	_inputPass = root.getElementById('m-login-pass');
	_btnSave   = root.querySelector('.m-login__save');

	_btnSave.addEventListener('click', _toggleSave);
	root.querySelector('.m-login__connect').addEventListener('click', _connect);
	root.querySelector('.m-login__signup').addEventListener('click', _signup);
	_signupDialog = root.querySelector('.m-signup');
	root.querySelector('.m-signup__cancel').addEventListener('click', () => _signupDialog.close());
	root.querySelector('.m-signup__confirm').addEventListener('click', () => {
		if (_registrationURL) window.open(_registrationURL, '_blank', 'noopener,noreferrer');
		_signupDialog.close();
	});

	_inputPass.addEventListener('keydown', e => {
		if (e.key === 'Enter' && !e.isComposing) _connect();
	});
};

MobileWinLogin.onAppend = function onAppend() {
	_inputUser.value = normalizeRememberedAccount(_preferences.ID);
	_inputPass.value = '';
	_updateSave();

};

function _toggleSave() {
	_preferences.keepLogin = !_preferences.keepLogin;
	_updateSave();
}

function _updateSave() {
	_btnSave.setAttribute('aria-checked', String(_preferences.keepLogin));
}

MobileWinLogin.onRemove = function onRemove() {
	if (_signupDialog.open) _signupDialog.close();
};

function _connect() {
	if (_signupDialog.open) return;
	const user = _inputUser.value.trim();
	const pass = _inputPass.value;

	_preferences.ID = normalizeRememberedAccount(user);
	_preferences.save();

	_inputUser.blur();
	_inputPass.blur();
	MobileWinLogin.onConnectionRequest(user, pass, !!_preferences.keepLogin);
}

function _signup() {
	const root = MobileWinLogin._shadow;
	_registrationURL = Configs.get('registrationweb');
	root.querySelector('.m-signup__automatic').hidden = !!_registrationURL;
	root.querySelector('.m-signup__external').hidden = !_registrationURL;
	root.querySelector('.m-signup__cancel').hidden = !_registrationURL;
	root.querySelector('.m-signup__confirm').textContent = _registrationURL ? '前往注册' : '知道了';
	_inputUser.blur();
	_inputPass.blur();
	_signupDialog.showModal();
}

MobileWinLogin.onConnectionRequest = function onConnectionRequest() {};
MobileWinLogin.onExitRequest = function onExitRequest() {};

UIManager.addComponent(MobileWinLogin);

export default withMobileShell(MobileWinLogin);
