/** In-memory recovery intent. No credentials, packets or game state are retained. */
export function createRecoveryController({
	probe,
	close,
	capture,
	present,
	login,
	restore,
	setTimer = setTimeout,
	clearTimer = clearTimeout,
	visible = () => true
}) {
	let state = 'idle';
	let target = null;
	let presentation = null;
	let timer = null;
	let generation = 0;
	let pinPassed = false;
	let characters = [];
	let enterCharacter = null;
	let listComplete = false;
	const clear = () => {
		generation++;
		clearTimer(timer);
		timer = null;
	};
	const show = (next, message) => {
		state = next;
		present(next, message);
	};
	const armTimeout = (delay, callback) => {
		clear();
		const current = generation;
		timer = setTimer(() => {
			if (generation === current) callback();
		}, delay);
	};
	function cancel() {
		clear();
		target = presentation = null;
		characters = [];
		enterCharacter = null;
		show('idle');
	}
	function disconnected(message) {
		if (!target || state === 'idle' || state === 'disconnected') return false;
		if (state === 'playing' || state === 'checking' || state === 'transition') presentation = capture();
		clear();
		// Change state first: closing may synchronously trigger lifecycle callbacks.
		state = 'disconnected';
		close();
		present(state, message);
		return true;
	}
	function trySelect() {
		if (state !== 'selecting' || !pinPassed) return;
		const character = characters.find(char => char.GID === target.characterId);
		if (!character) {
			if (listComplete) cancel();
			return;
		}
		armTimeout(30000, () => disconnected('恢复角色超时，请重新登录。'));
		show('restoring');
		enterCharacter(character);
	}
	return {
		get state() {
			return state;
		},
		cancel,
		disconnected,
		ready(identity) {
			const recover =
				state === 'restoring' &&
				target?.accountId === identity.accountId &&
				target.characterId === identity.characterId &&
				target.serverKey === identity.serverKey;
			clear();
			if (recover && presentation) restore(presentation);
			target = { ...identity };
			presentation = null;
			show('playing');
		},
		check() {
			if (state !== 'playing' || !visible()) return;
			armTimeout(12000, () => disconnected('服务器暂时没有响应，请重新登录恢复角色。'));
			show('checking');
			if (!probe()) disconnected();
		},
		pong() {
			if (state !== 'checking') return;
			clear();
			show('playing');
		},
		hidden() {
			if (state === 'checking') {
				clear();
				show('playing');
			}
		},
		transition() {
			if (state === 'checking' || state === 'playing') {
				clear();
				show('transition');
			}
		},
		beginLogin(resume = true) {
			if (state !== 'disconnected' && state !== 'restoring') return;
			clear();
			if (!resume) target = presentation = null;
			show(resume ? 'authenticating' : 'idle');
			login();
		},
		loginAccepted(accountId, serverKey, servers) {
			if (state !== 'authenticating') return null;
			if (accountId !== target.accountId || serverKey !== target.serverKey) {
				cancel();
				return null;
			}
			const server = servers.find(
				s =>
					s.ip === target.charServer.ip &&
					s.port === target.charServer.port &&
					s.name === target.charServer.name
			);
			if (!server) {
				cancel();
				return null;
			}
			pinPassed = false;
			characters = [];
			enterCharacter = null;
			listComplete = false;
			show('selecting');
			return server;
		},
		characterList(list, enter) {
			if (state !== 'selecting') return;
			characters.push(...list);
			enterCharacter = enter;
			trySelect();
		},
		charactersComplete() {
			listComplete = true;
			trySelect();
		},
		pin(stateCode) {
			if (state !== 'selecting') return;
			pinPassed = stateCode === 0;
			trySelect();
		}
	};
}
