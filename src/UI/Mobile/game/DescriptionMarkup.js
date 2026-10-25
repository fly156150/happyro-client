import { formatRagnarokMarkup } from 'Utils/RagnarokText.js';
import { prepareNaviLinks, handleNaviClick } from 'UI/Components/Navigation/NaviActionService.js';
import { ensureReadableText } from 'Utils/ReadableText.js';

const rendered = new WeakMap();
const bound = new WeakSet();

/** Stable read-only descriptions; server-owned forms must finish before navigation. */
export function renderDescriptionMarkup(node, value, { navigation = false } = {}) {
	const html = formatRagnarokMarkup(value);
	const key = `${navigation}:${html}`;
	if (rendered.get(node) === key) return;
	rendered.set(node, key);
	node.innerHTML = html;
	if (navigation) delete node.dataset.navigationBlocked;
	else node.dataset.navigationBlocked = '请先结束当前操作，再使用导航';
	if (navigation) {
		prepareNaviLinks(node);
		if (!bound.has(node)) {
			bound.add(node);
			node.addEventListener('click', handleNaviClick);
			node.addEventListener('keydown', handleNaviClick);
		}
	} else {
		for (const link of node.querySelectorAll('[data-navi-info]')) {
			link.classList.remove('navi-link');
			link.removeAttribute('role');
			link.removeAttribute('tabindex');
			link.removeAttribute('data-navi-info');
			link.title = '请先结束当前操作，再使用导航';
		}
	}
	// Most panels build a detached description and append it later in the same turn.
	// Contrast adaptation needs the final themed ancestors, not an unattached node.
	if (node.isConnected) ensureReadableText(node);
	else queueMicrotask(() => ensureReadableText(node));
}
