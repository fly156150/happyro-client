let host;

/** Nonmodal: the NPC dialogue remains usable until the player ends it normally. */
export function showNaviActionPanel({ title, message, retry, viewMap, onDismiss }) {
	if (!host?.isConnected) {
		host = document.createElement('aside');
		host.className = 'navi-action-panel';
		host.setAttribute('aria-label', '导航目标');
		host.style.cssText =
			'position:fixed;top:calc(env(safe-area-inset-top, 0px) + 12px);right:12px;max-width:min(340px,calc(100vw - 24px));z-index:2147483000;pointer-events:auto;';
		host.attachShadow({ mode: 'open' });
		for (const type of ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown', 'keyup'])
			host.addEventListener(type, event => event.stopPropagation());
		document.body.append(host);
	}
	const root = host.shadowRoot;
	root.innerHTML =
		'<style>:host{font:14px/1.5 sans-serif;color:#eee}.card{padding:12px;background:#242832;border:1px solid #747b8a;border-radius:8px;box-shadow:0 4px 18px #0008}h3{margin:0 28px 6px 0;font-size:15px}p{margin:0 0 10px;white-space:pre-wrap}nav{display:flex;gap:8px;flex-wrap:wrap}button{font:inherit;color:inherit;background:#414958;border:1px solid #8993a4;border-radius:5px;padding:6px 12px;cursor:pointer}.close{position:absolute;right:7px;top:7px;padding:0 7px}</style><section class="card"><button class="close" type="button" aria-label="关闭导航提示">×</button><h3></h3><p role="status" aria-live="polite"></p><nav></nav></section>';
	root.querySelector('h3').textContent = title;
	root.querySelector('p').textContent = message;
	root.querySelector('.close').onclick = () => {
		onDismiss?.();
		clearNaviActionPanel();
	};
	for (const [label, action] of [
		['传送', retry],
		['查看地图', viewMap]
	]) {
		if (!action) continue;
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = label;
		button.onclick = () => {
			void action();
		};
		root.querySelector('nav').append(button);
	}
}
export function clearNaviActionPanel() {
	host?.remove();
	host = null;
}
