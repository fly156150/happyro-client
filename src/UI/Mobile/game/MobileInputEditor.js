import mobileInputCSS from './MobileModalInput.css?raw';
import backdropCSS from './MobileModalBackdrop.css?raw';
import menuLayoutCSS from './MenuLayout.css?raw';
import { updateMenuLayout } from './MenuLayout.js';
import css from './MobileInputEditor.css?raw';

const editable =
	'textarea, input:not([type]), input[type=text], input[type=search], input[type=number], input[type=password], input[type=email], input[type=url], input[type=tel]';

/** Edit a draft outside the menu so keyboard resizing cannot disturb its layout. */
export function createMobileInputEditor(host, { enabled = () => true } = {}) {
	const root = host.shadowRoot;
	let close;
	let gesture;
	let tappedSource;
	function open(focusEvent) {
		const source = focusEvent.target;
		if (!enabled() || close || !source.matches?.(editable) || source.disabled || source.readOnly) return;

		focusEvent.preventDefault();
		focusEvent.stopImmediatePropagation();
		const overlay = document.createElement('div');
		overlay.dataset.mobileInputEditor = '';
		overlay.toggleAttribute('data-phone-screen', Math.min(screen.width, screen.height) < 600);
		const editor = overlay.attachShadow({ mode: 'open' });
		editor.innerHTML = `<style>${css}${menuLayoutCSS}${backdropCSS}${mobileInputCSS}</style><dialog class="mobile-menu-editor" aria-labelledby="editor-title"><section><span id="editor-title"></span><button type="button" data-cancel>取消</button><main></main><button type="button" data-done>完成</button></section></dialog>`;
		const dialog = editor.querySelector('dialog');
		const content = editor.querySelector('section');
		const title =
			source.getAttribute('aria-label') ||
			source.labels?.[0]?.textContent.trim() ||
			source.placeholder ||
			'输入内容';
		editor.querySelector('#editor-title').textContent = title;
		const submitOnDone = source.hasAttribute('data-input-submit');
		if (submitOnDone) editor.querySelector('[data-done]').textContent = '发送';
		const field = source.cloneNode(true);
		field.removeAttribute('id');
		field.removeAttribute('name');
		field.removeAttribute('style');
		field.removeAttribute('class');
		field.setAttribute('autofocus', '');
		field.setAttribute('aria-label', title);
		if (!field.placeholder) field.placeholder = title;
		field.setAttribute('enterkeyhint', submitOnDone ? 'send' : field.tagName === 'TEXTAREA' ? 'enter' : 'done');
		field.value = source.value;
		editor.querySelector('main').append(field);
		const originalInert = host.inert;
		const abort = new AbortController();
		let layoutWidth = window.innerWidth,
			layoutHeight = window.innerHeight;
		updateMenuLayout(overlay, layoutWidth, layoutHeight);
		function resize() {
			const visual = window.visualViewport;
			if (window.innerWidth !== layoutWidth) {
				layoutWidth = window.innerWidth;
				layoutHeight = window.innerHeight;
				updateMenuLayout(overlay, layoutWidth, layoutHeight);
			}
			overlay.style.setProperty('--mobile-visible-height', `${visual?.height || window.innerHeight}px`);
			overlay.style.setProperty('--mobile-visual-top', `${visual?.offsetTop || 0}px`);
			overlay.dataset.editorLayout =
				overlay.dataset.menuDensity === 'spacious' || layoutHeight > layoutWidth ? 'dialog' : 'strip';
			if (overlay.dataset.editorLayout === 'dialog') {
				content.style.removeProperty('top');
				content.style.removeProperty('height');
				dialog.style.removeProperty('height');
				return;
			}
			dialog.style.height = `${Math.max(window.innerHeight, document.documentElement.clientHeight, (visual?.height || 0) + (visual?.offsetTop || 0))}px`;
		}
		close = () => {
			abort.abort();
			field.blur();
			dialog.close();
			overlay.remove();
			host.inert = originalInert;
			// Closing a nested dialog can restore focus to its original input.
			// Move focus back to the parent prompt so the keyboard stays dismissed.
			source.blur();
			source.closest('dialog')?.querySelector('[tabindex="-1"]')?.focus({ preventScroll: true });
			close = null;
		};
		function done() {
			if (!field.reportValidity()) return;
			const value = field.value;
			close();
			if (!source.isConnected) return;
			if (source.value !== value) {
				source.value = value;
				source.dispatchEvent(new Event('input', { bubbles: true }));
				source.dispatchEvent(new Event('change', { bubbles: true }));
			}
			if (submitOnDone) source.form.requestSubmit();
		}
		dialog.addEventListener('cancel', event => {
			event.preventDefault();
			close();
		});
		editor.querySelector('[data-cancel]').addEventListener('click', () => close());
		editor.querySelector('[data-done]').addEventListener('click', done);
		editor.addEventListener('keydown', event => {
			event.stopPropagation();
			if (event.isComposing || event.keyCode === 229) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				close();
			} else if (event.key === 'Enter' && field.tagName !== 'TEXTAREA') {
				event.preventDefault();
				done();
			}
		});
		for (const type of ['keyup', 'keypress', 'pointerdown', 'pointerup', 'click', 'touchstart', 'touchend']) {
			editor.addEventListener(type, event => event.stopPropagation());
		}
		window.visualViewport?.addEventListener('resize', resize, { signal: abort.signal });
		window.visualViewport?.addEventListener('scroll', resize, { signal: abort.signal });
		window.addEventListener('resize', resize, { signal: abort.signal });
		resize();
		document.body.append(overlay);
		dialog.showModal();
		// Focus synchronously within the user's gesture so iOS keeps its keyboard open.
		field.focus({ preventScroll: true });
		host.inert = true;
		if (field.selectionStart !== null) field.setSelectionRange(field.value.length, field.value.length);
	}
	const listeners = new AbortController();
	const options = { capture: true, signal: listeners.signal };
	root.addEventListener(
		'pointerdown',
		event => {
			if (!enabled() || event.button !== 0 || !event.target.matches?.(editable)) return;
			tappedSource = null;
			gesture = { source: event.target, id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
			// Touch keeps its native scrolling; mouse focus waits for release as well.
			if (event.pointerType === 'mouse') event.preventDefault();
		},
		options
	);
	root.addEventListener(
		'pointermove',
		event => {
			if (
				gesture &&
				gesture.id === event.pointerId &&
				Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8
			)
				gesture.moved = true;
		},
		options
	);
	root.addEventListener(
		'scroll',
		() => {
			if (gesture) gesture.moved = true;
		},
		options
	);
	root.addEventListener(
		'pointercancel',
		() => {
			gesture = null;
		},
		options
	);
	root.addEventListener(
		'pointerup',
		event => {
			const tap = gesture;
			gesture = null;
			if (
				!tap ||
				tap.id !== event.pointerId ||
				tap.moved ||
				event.target !== tap.source ||
				Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8
			)
				return;
			tappedSource = tap.source;
		},
		options
	);
	// Open on the completed click: opening on pointerup lets the same touch's
	// compatibility mouse events land on the new dialog and steal input focus.
	root.addEventListener(
		'click',
		event => {
			const source = tappedSource;
			tappedSource = null;
			if (event.target === source) open(event);
		},
		options
	);
	root.addEventListener(
		'focusin',
		event => {
			if (!gesture && !tappedSource) open(event);
		},
		options
	);
	return () => {
		listeners.abort();
		gesture = null;
		close?.();
	};
}
