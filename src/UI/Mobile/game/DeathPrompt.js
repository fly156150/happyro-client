import confirmationCSS from 'UI/Components/Confirmation.css?raw';
import backdropCSS from './MobileModalBackdrop.css?raw';
import css from './DeathPrompt.css?raw';

/** Map-scoped death UI. Inventory and life state remain server-owned. */
export function createDeathPrompt(parent, actions, reopenParent) {
	const host = document.createElement('div');
	host.className = 'mobile-death-host';
	const root = host.attachShadow({ mode: 'open' });
	root.innerHTML = `<style>${confirmationCSS}${backdropCSS}${css}</style>
		<div>
			<dialog class="ui-confirm death-prompt" aria-labelledby="death-title" aria-describedby="death-description">
				<div class="ui-confirm-body">
					<h2 id="death-title" tabindex="-1" autofocus>角色已倒下</h2>
					<p id="death-description"></p>
					<p class="death-message" role="status" hidden></p>
				</div>
				<div class="ui-confirm-actions">
					<button type="button" data-revive hidden></button>
					<button type="button" data-return>返回保存点</button>
					<button type="button" data-wait>等待救援</button>
					<button type="button" data-confirm hidden>确认使用</button>
					<button type="button" data-cancel hidden>取消</button>
				</div>
			</dialog>
		</div>`;
	parent.append(host);
	const $ = selector => root.querySelector(selector);
	const dialog = $('dialog');
	const heading = $('h2');
	const reopen = document.createElement('button');
	reopen.type = 'button';
	reopen.className = 'death-reopen';
	reopen.textContent = '返回 / 复活';
	reopen.hidden = true;
	reopenParent.append(reopen);
	const abort = new AbortController();
	let state = { dead: false, tokenCount: 0 };
	let confirming = false;
	let pending = false;
	let requestTimer;
	let message = '';
	let press = null;
	let destroyed = false;

	function render() {
		const hasToken = state.tokenCount > 0;
		heading.textContent = confirming ? '使用复活道具' : '角色已倒下';
		$('#death-description').textContent = confirming
			? '消耗 1 个齐格弗里德的证明？' : '';
		$('#death-description').hidden = !confirming;
		$('[data-revive]').textContent = `使用齐格弗里德的证明 ×${state.tokenCount}`;
		$('[data-revive]').hidden = confirming || !hasToken;
		$('[data-return]').hidden = confirming;
		$('[data-wait]').hidden = confirming;
		$('[data-confirm]').hidden = !confirming;
		$('[data-cancel]').hidden = !confirming;
		$('[data-revive]').classList.toggle('primary', hasToken);
		$('[data-return]').classList.toggle('primary', !hasToken);
		$('[data-confirm]').classList.add('primary');
		for (const button of root.querySelectorAll('[data-return], [data-revive], [data-confirm]')) button.disabled = pending;
		$('.death-message').textContent = pending ? '请稍候…' : message;
		$('.death-message').hidden = !pending && !message;
		reopen.hidden = !state.dead || dialog.open;
	}
	function show() {
		if (!state.dead || dialog.open || destroyed) return;
		press = null;
		dialog.showModal();
		render();
		// Mark the dialog open before cancellation, which can synchronously refresh the HUD.
		actions.open();
		heading.focus({ preventScroll: true });
	}
	function hide() {
		press = null;
		confirming = false;
		if (dialog.open) {
			dialog.close();
			actions.close();
		}
		render();
	}
	function update(next = { dead: false, tokenCount: 0 }) {
		if (destroyed) return;
		const wasDead = state.dead;
		state = next;
		if (!state.dead) {
			clearTimeout(requestTimer);
			pending = false;
			message = '';
			hide();
			return;
		}
		if (confirming && !state.tokenCount) {
			confirming = false;
			message = '复活道具不足。';
		}
		render();
		if (!wasDead) show();
	}
	function request(kind) {
		update(actions.snapshot());
		if (!state.dead || pending || (kind === 'revive' && !state.tokenCount)) return;
		pending = true;
		confirming = false;
		message = '';
		render();
		if (actions[kind]() === false) {
			pending = false;
			update(actions.snapshot());
			return;
		}
		// A rejected resurrection has no dedicated acknowledgement. Never auto-resend it.
		requestTimer = setTimeout(() => {
			pending = false;
			message = '请查看系统提示，稍后重试。';
			update(actions.snapshot());
		}, 5000);
	}
	const handlers = {
		'data-revive': () => {
			update(actions.snapshot());
			if (!state.dead || !state.tokenCount || pending) return;
			confirming = true;
			render();
			heading.focus({ preventScroll: true });
		},
		'data-return': () => request('returnToSavePoint'),
		'data-confirm': () => request('revive'),
		'data-cancel': () => { confirming = false; render(); heading.focus({ preventScroll: true }); },
		'data-wait': hide
	};
	root.addEventListener('pointerdown', event => {
		press = { target: event.target, id: event.pointerId };
	}, { signal: abort.signal });
	root.addEventListener('pointercancel', () => { press = null; }, { signal: abort.signal });
	root.addEventListener('click', event => {
		const freshPress = event.detail === 0 || press?.target === event.target;
		press = null;
		if (!freshPress) return;
		for (const [attribute, handler] of Object.entries(handlers)) {
			if (event.target.hasAttribute(attribute) && !event.target.disabled) { handler(); return; }
		}
	}, { signal: abort.signal });
	reopen.addEventListener('click', event => {
		event.stopPropagation();
		update(actions.snapshot());
		show();
	}, { signal: abort.signal });
	dialog.addEventListener('cancel', event => {
		event.preventDefault();
		if (confirming) handlers['data-cancel']();
		else hide();
	}, { signal: abort.signal });
	for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown', 'keyup']) {
		root.addEventListener(type, event => event.stopPropagation(), { signal: abort.signal });
	}
	return {
		update,
		destroy() {
			destroyed = true;
			clearTimeout(requestTimer);
			hide();
			abort.abort();
			reopen.remove();
			host.remove();
		}
	};
}
