/** Map loading recovery orchestration. Server tokens and movement stay with the caller. */
export function createMapLoadRecovery({
	view,
	onRecover,
	onRetry,
	onExit,
	setTimer = setTimeout,
	clearTimer = clearTimeout,
	loadTimeoutMs = 30000,
	recoveryTimeoutMs = 10000
}) {
	let attempt = 0;
	let context = null;
	let timer = null;
	let phase = 'idle';
	let recoveryMode = null;

	function clearDeadline() {
		if (timer !== null) clearTimer(timer);
		timer = null;
	}

	function active(id) {
		return id === attempt && context !== null && phase !== 'idle' && phase !== 'loaded';
	}

	function exit() {
		if (!context) return;
		const exiting = context;
		cancel();
		onExit(exiting);
	}

	function show(message, busy = false, allowReturn = true) {
		const id = attempt;
		view.show({
			message,
			busy,
			onRetry: busy ? null : () => active(id) && retry(),
			onReturn: busy || !allowReturn ? null : () => active(id) && recover('prontera'),
			onExit: () => active(id) && exit()
		});
	}

	function failRequest(message, allowReturn = false) {
		clearDeadline();
		phase = 'failed';
		show(message, false, allowReturn && context.recoveryMode !== 'prontera');
	}

	function awaitRequest(callback, mode) {
		clearDeadline();
		const id = attempt;
		phase = 'recovering';
		recoveryMode = mode;
		show(mode === 'previous' ? '地图加载失败，正在返回原位置…' : mode === 'prontera' ? '正在返回普隆德拉…' : '正在重试加载地图…', true);
		timer = setTimer(() => {
			if (active(id) && phase === 'recovering') failRequest('恢复请求超时，请重试加载或退出游戏。');
		}, recoveryTimeoutMs);
		Promise.resolve().then(() => {
			if (active(id) && phase === 'recovering') return callback();
		}).catch(() => {
			if (active(id) && phase === 'recovering') failRequest('无法完成地图恢复，请重试加载或退出游戏。');
		});
	}

	function recover(mode) {
		if (!context || phase === 'recovering') return;
		const current = context;
		awaitRequest(() => onRecover(mode, current), mode);
	}

	function retry() {
		if (!context || phase === 'recovering') return;
		const current = context;
		awaitRequest(() => onRetry(current), null);
	}

	function begin(nextContext) {
		clearDeadline();
		attempt += 1;
		context = { ...nextContext };
		phase = 'loading';
		recoveryMode = null;
		const id = attempt;
		if (context.recoveryMode) {
			show(context.recoveryMode === 'prontera' ? '正在返回普隆德拉…' : '正在返回原位置…', true);
		} else view.hide();
		timer = setTimer(() => {
			if (!active(id) || phase !== 'loading') return;
			phase = 'timed-out';
			show('地图加载超过 30 秒，可重试加载或返回普隆德拉。', false, context.recoveryMode !== 'prontera');
			if (context.recoveryMode === 'prontera') show('普隆德拉加载超时，请重试加载或退出游戏。', false, false);
		}, loadTimeoutMs);
		return id;
	}

	function loaded(id = attempt) {
		if (!active(id)) return;
		clearDeadline();
		phase = 'loaded';
		view.hide();
	}

	function failed(_error, id = attempt) {
		if (!active(id) || (phase !== 'loading' && phase !== 'timed-out')) return;
		clearDeadline();
		if (context.recoveryMode === 'prontera') {
			failRequest('普隆德拉地图也无法加载，请重试加载或退出游戏。');
			return;
		}
		recover(context.recoveryMode === 'previous' ? 'prontera' : 'previous');
	}

	function handleResult({ status, destination }, id = attempt) {
		if (!active(id) || phase !== 'recovering') return;
		if (status === 0) {
			// Acceptance is not completion: keep the request deadline until a new map starts.
			const safe = destination === 'prontera' || destination === 1 || recoveryMode === 'prontera';
			show(safe ? '正在返回普隆德拉…' : '正在返回原位置…', true);
			return;
		}
		const messages = {
			1: '地图恢复请求已过期或已处理，请重试加载或退出游戏。',
			2: '无法返回普隆德拉，请重试加载或退出游戏。',
			3: '地图恢复请求无效，请重试加载或退出游戏。',
			4: '服务器暂时无法恢复地图，请重试加载或退出游戏。'
		};
		failRequest(messages[status] || '地图恢复未完成，请重试加载或退出游戏。', status === 4);
	}

	function cancel() {
		clearDeadline();
		attempt += 1;
		phase = 'idle';
		context = null;
		view.hide();
	}

	function updateContext(nextContext) {
		if (context) context = { ...context, ...nextContext };
	}

	return { begin, loaded, failed, handleResult, updateContext, cancel };
}

/** A resource-independent overlay, including when WebGL or map assets cannot render. */
export function createMapLoadRecoveryView(document) {
	let host = null;
	function hide() {
		host?.remove();
		host = null;
	}
	function show({ message, busy, onRetry, onReturn, onExit }) {
		hide();
		host = document.createElement('section');
		host.id = 'MapLoadRecovery';
		host.setAttribute('role', 'dialog');
		host.setAttribute('aria-label', '地图加载恢复');
		host.setAttribute('aria-modal', 'true');
		Object.assign(host.style, {
			position: 'fixed', inset: '0', zIndex: '2147483647', display: 'flex',
			alignItems: 'center', justifyContent: 'center', padding: '20px',
			background: 'rgba(0,0,0,.7)', color: '#fff', font: '16px/1.6 sans-serif'
		});
		const panel = document.createElement('div');
		Object.assign(panel.style, { maxWidth: '420px', padding: '24px', borderRadius: '12px', background: '#202936', boxShadow: '0 8px 32px #0008' });
		const text = document.createElement('p');
		text.setAttribute('role', busy ? 'status' : 'alert');
		text.setAttribute('aria-live', 'polite');
		text.textContent = message;
		panel.append(text);
		const actions = document.createElement('div');
		Object.assign(actions.style, { display: 'flex', flexWrap: 'wrap', gap: '10px' });
		for (const [label, action] of [['重试加载', onRetry], ['返回普隆德拉', onReturn], ['退出游戏', onExit]]) {
			if (!action) continue;
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = label;
			Object.assign(button.style, { padding: '10px 16px', border: '1px solid #a5b4cc', borderRadius: '6px', background: '#fff', color: '#172335', cursor: 'pointer', font: 'inherit' });
			button.addEventListener('click', action);
			actions.append(button);
		}
		panel.append(actions);
		host.append(panel);
		document.body.append(host);
		host.addEventListener('keydown', event => event.stopPropagation());
		actions.querySelector('button')?.focus();
	}
	return { show, hide };
}
