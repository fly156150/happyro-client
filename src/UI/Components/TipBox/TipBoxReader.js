import { formatRagnarokMarkup } from 'Utils/RagnarokText.js';
import { ensureReadableText } from 'Utils/ReadableText.js';
import css from './TipBoxReader.css?raw';
import desktopPalette from '../DesktopLightTheme.css?raw';
import desktopHeader from '../DesktopWindowHeader.css?raw';
import desktopButtons from '../GameTools/GameToolsButtons.css?raw';
import desktopSkin from '../GameTools/GameToolsLight.css?raw';
import desktopCSS from './TipBoxReaderDesktop.css?raw';
import menuLayoutCSS from 'UI/Mobile/game/MenuLayout.css?raw';
import menuChromeCSS from 'UI/Mobile/game/MenuChrome.css?raw';
import { updateMenuLayout } from 'UI/Mobile/game/MenuLayout.js';
import mobileCSS from './TipBoxReaderMobile.css?raw';

/** A modal reader owns only its view: the source window and game state belong to its caller. */
export function createTipBoxReader(root, { entries, initialId, onClose, loadImage, resolveItem, prepareLinks, activateNavi, mobile = true }) {
	entries = { ...entries };
	const style = document.createElement('style');
	style.textContent = css + (mobile ? menuLayoutCSS + menuChromeCSS + mobileCSS : desktopPalette + desktopButtons + desktopSkin + desktopHeader + desktopCSS);
	const dialog = document.createElement('dialog');
	dialog.className = 'tipbox-reader';
	if (mobile) dialog.dataset.feedbackTheme = 'mobile';
	dialog.setAttribute('aria-labelledby', 'tipbox-reader-title');
	dialog.innerHTML = '<header class="tipbox-header"><button type="button" data-tipbox-back>返回</button><h2 id="tipbox-reader-title" tabindex="-1"></h2><button type="button" data-tipbox-close>关闭</button></header><div class="tipbox-body" tabindex="0"><article class="tipbox-text"></article><figure class="tipbox-image" hidden><img alt=""></figure></div><footer class="tipbox-pages"><button type="button" data-tipbox-previous>上一页</button><span aria-live="polite"></span><button type="button" data-tipbox-next>下一页</button></footer>';
	root.append(style, dialog);
	const title = dialog.querySelector('h2');
	const body = dialog.querySelector('.tipbox-body');
	const article = dialog.querySelector('.tipbox-text');
	const figure = dialog.querySelector('figure');
	const image = figure.querySelector('img');
	const back = dialog.querySelector('[data-tipbox-back]');
	const previous = dialog.querySelector('[data-tipbox-previous]');
	const next = dialog.querySelector('[data-tipbox-next]');
	const pages = dialog.querySelector('.tipbox-pages');
	if (mobile) {
		const actions = document.createElement('div');
		actions.className = 'tipbox-header-actions';
		actions.append(back, dialog.querySelector('[data-tipbox-close]'));
		dialog.querySelector('header').append(actions);
		dialog.dataset.input = 'pointer';
	}
	if (!mobile) {
		dialog.classList.add('game-tools-window');
		dialog.dataset.feedbackTheme = 'desktop';
		const header = dialog.querySelector('header');
		header.classList.add('desktop-window-header');
		title.classList.add('desktop-window-title');
		const closeButton = dialog.querySelector('[data-tipbox-close]');
		closeButton.classList.add('desktop-window-close');
		closeButton.setAttribute('aria-label', '关闭');
		closeButton.title = '关闭';
		closeButton.textContent = '';
		const toolbar = document.createElement('div');
		toolbar.className = 'tipbox-toolbar catalog-action-panel';
		toolbar.append(back);
		header.after(toolbar);
		pages.classList.add('catalog-action-panel');
	}
	const history = [];
	const abort = new AbortController();
	dialog.addEventListener('pointerdown', () => { dialog.dataset.input = 'pointer'; }, { capture: true, signal: abort.signal });
	dialog.addEventListener('keydown', () => { dialog.dataset.input = 'keyboard'; }, { capture: true, signal: abort.signal });
	if (mobile) {
		const host = root.host || root.getRootNode().host;
		const updateLayout = () => {
			if (host) updateMenuLayout(host, window.innerWidth, window.innerHeight);
		};
		updateLayout();
		window.addEventListener('resize', updateLayout, { signal: abort.signal });
	}
	let current = null;
	let suspendedScroll = null;
	let imageScrollRestore = null;
	let destroyed = false;
	let finished = false;
	let imageRequest = 0;
	const available = id => Object.hasOwn(entries, id) && Array.isArray(entries[id].pages) && entries[id].pages.some(page => typeof page === 'string' && page.trim());
	const snapshot = () => ({ ...current, top: body.scrollTop, left: body.scrollLeft });

	function render() {
		const entry = entries[current.id];
		const request = ++imageRequest;
		imageScrollRestore = current.top || current.left ? { top: current.top, left: current.left } : null;
		title.textContent = entry.title;
		title.title = entry.title;
		article.innerHTML = formatRagnarokMarkup(entry.pages[current.page]);
		for (const link of article.querySelectorAll('[data-tipbox-id]')) {
			const enabled = available(link.dataset.tipboxId);
			link.classList.toggle('tipbox-link', enabled);
			if (enabled) {
				link.setAttribute('role', 'button');
				link.tabIndex = 0;
			} else {
				link.removeAttribute('role');
				link.removeAttribute('tabindex');
			}
		}
		prepareLinks?.(article);
		if (!activateNavi) {
			for (const link of article.querySelectorAll('[data-navi-info]')) {
				link.classList.remove('navi-link');
				link.removeAttribute('role');
				link.removeAttribute('tabindex');
			}
		}
		for (const link of article.querySelectorAll('[data-item-id]')) {
			if (!resolveItem?.(link.dataset.itemId)) {
				link.classList.remove('item-link');
				link.removeAttribute('role');
				link.removeAttribute('tabindex');
			}
		}
		back.disabled = history.length === 0;
		pages.hidden = entry.pages.length <= 1;
		previous.disabled = current.page === 0;
		next.disabled = current.page >= entry.pages.length - 1;
		pages.querySelector('span').textContent = `${current.page + 1} / ${entry.pages.length}`;
		figure.hidden = true;
		image.removeAttribute('src');
		if (entry.image && loadImage) {
			Promise.resolve().then(() => loadImage(entry.image)).then(url => {
				if (destroyed || finished || request !== imageRequest || !url) return;
				image.onload = () => {
					if (!destroyed && !finished && request === imageRequest) {
						figure.hidden = false;
						if (imageScrollRestore) {
							body.scrollTop = imageScrollRestore.top;
							body.scrollLeft = imageScrollRestore.left;
							imageScrollRestore = null;
						}
					}
				};
				image.onerror = () => { if (request === imageRequest) figure.hidden = true; };
				image.src = url;
			}).catch(() => {});
		}
		body.scrollTop = current.top;
		body.scrollLeft = current.left;
		ensureReadableText(article);
	}
	function open(id) {
		const key = String(id);
		if (destroyed || finished || !available(key)) return false;
		if (current?.id === key) return true;
		if (current) history.push(snapshot());
		current = { id: key, page: 0, top: 0, left: 0 };
		render();
		title.focus({ preventScroll: true });
		return true;
	}
	function openItem(id) {
		const entry = resolveItem?.(id);
		if (!entry || destroyed || finished) return false;
		const key = `item:${id}`;
		entries[key] = entry;
		return open(key);
	}
	function close() {
		if (destroyed || finished) return;
		finished = true;
		imageRequest++;
		dialog.close();
		onClose?.();
	}
	back.onclick = () => {
		if (!history.length) return;
		current = history.pop();
		render();
		title.focus({ preventScroll: true });
	};
	function turn(delta) {
		const page = current.page + delta;
		if (page < 0 || page >= entries[current.id].pages.length) return;
		current = { ...current, page, top: 0, left: 0 };
		render();
		body.focus({ preventScroll: true });
	}
	previous.onclick = () => turn(-1);
	next.onclick = () => turn(1);
	dialog.querySelector('[data-tipbox-close]').onclick = event => {
		event.preventDefault();
		event.stopPropagation();
		close();
	};
	dialog.addEventListener('cancel', event => {
		event.preventDefault();
		event.stopPropagation();
		close();
	}, { signal: abort.signal });
	const activateLink = event => {
		const link = event.target.closest?.('[data-tipbox-id], .item-link[data-item-id], .navi-link[data-navi-info]');
		if (!link) return;
		if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
		event.preventDefault();
		event.stopPropagation();
		if (link.dataset.itemId) openItem(link.dataset.itemId);
		else if (link.dataset.naviInfo) activateNavi?.(link.dataset.naviInfo, link.dataset.naviName || link.textContent, link);
		else if (available(link.dataset.tipboxId)) open(link.dataset.tipboxId);
	};
	dialog.addEventListener('click', activateLink, { signal: abort.signal });
	dialog.addEventListener('keydown', event => {
		// Closing may synchronously destroy the reader and abort all remaining listeners.
		event.stopPropagation();
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		} else activateLink(event);
	}, { signal: abort.signal });
	for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
		dialog.addEventListener(type, () => { imageScrollRestore = null; }, { capture: true, signal: abort.signal });
	}
	for (const type of ['keydown', 'keyup', 'keypress', 'click', 'dblclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel']) {
		dialog.addEventListener(type, event => event.stopPropagation(), { signal: abort.signal });
	}
	if (!open(initialId)) {
		title.textContent = '帮助';
		article.textContent = '帮助内容暂不可用';
		back.disabled = true;
		pages.hidden = true;
	}
	dialog.showModal();
	title.focus({ preventScroll: true });
	return {
		open,
		openItem,
		refreshLinks() { if (!destroyed && !finished) prepareLinks?.(article); },
		suspend() {
			if (destroyed || finished || !dialog.open) return;
			suspendedScroll = { top: body.scrollTop, left: body.scrollLeft };
			dialog.close();
		},
		resume() {
			if (destroyed || finished || dialog.open) return;
			dialog.showModal();
			if (suspendedScroll) {
				body.scrollTop = suspendedScroll.top;
				body.scrollLeft = suspendedScroll.left;
			}
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			imageRequest++;
			abort.abort();
			image.onload = null;
			image.onerror = null;
			if (dialog.open) dialog.close();
			dialog.remove();
			style.remove();
		}
	};
}
