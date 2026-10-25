import { acquireInputFreeze, releaseInputFreeze } from 'UI/InputFreeze.js';
import { interactionSnapshot, subscribeInteraction } from 'UI/Game/ServerInteraction.js';
import { suspendNavigationSource, abandonNavigationVisit } from 'UI/Game/NavigationVisit.js';
import ItemTable from 'DB/Items/ItemTable.js';
import { toPlainRagnarokText } from 'Utils/RagnarokText.js';
import { prepareNaviLinks, activateNavi } from 'UI/Components/Navigation/NaviActionService.js';
import catalog from 'DB/Help/TipBox.json';
import Platform from 'UI/Platform.js';
import { onConnectionEnd } from 'Network/ConnectionLifecycle.js';
import { createTipBoxReader } from './TipBoxReader.js';

let active = null;
const bound = new WeakSet();
const images = new Map();
function visible(node) {
	if (!node?.isConnected) return false;
	for (let current = node; current; current = current.parentElement || current.getRootNode().host) {
		const style = getComputedStyle(current);
		if (current.hidden || style.display === 'none' || style.visibility === 'hidden') return false;
	}
	return true;
}
async function loadImage(path) {
	if (!images.has(path)) {
		const request = Promise.all([import('Core/Client.js'), import('DB/DBManager.js')]).then(([client, database]) => {
			const relative = path.replaceAll('\\', '/').replace(/^유저인터페이스\//, '');
			return new Promise(resolve => client.default.loadFile(
				database.default.INTERFACE_PATH + relative + '.bmp', resolve, () => resolve(null)
			));
		}).then(url => {
			if (!url && images.get(path) === request) images.delete(path);
			return url;
		}, error => {
			if (images.get(path) === request) images.delete(path);
			throw error;
		});
		images.set(path, request);
	}
	return images.get(path);
}
function desktopInputOwner() {
	if (Platform.isMobile) return null;
	return [...document.querySelectorAll('[data-freeze-input]')].find(visible) || null;
}
function sourceOwner(source) {
	return source?.closest?.('.panel, .game-tools-window') || source?.getRootNode?.().host || null;
}
function navigationSource(record) {
	if (visible(record.source)) return record.source;
	// Returning from the tools map can leave its old item tab connected but hidden.
	// The reader can navigate again independently of a source that is no longer visible.
	if (!record.owner || !visible(record.owner) || !record.sourceRoot?.host?.isConnected) return null;
	// Permission snapshots can redraw a description while its modal remains open.
	// Suspend only a visible current container, never another hidden tab.
	return [...record.sourceRoot.querySelectorAll('.panel-body, .game-tools-window, .content')].find(visible) ||
		[...record.sourceRoot.children].find(node => node.tagName !== 'STYLE' && visible(node)) || null;
}
export function closeTipBox({ restoreFocus = true } = {}) {
	if (!active) return;
	const record = active;
	active = null;
	record.observer?.disconnect();
	record.reader.destroy();
	record.host.remove();
	releaseInputFreeze(record.host);
	if (restoreFocus && visible(record.source)) {
		if (record.keyboard || !Platform.isMobile) record.source.focus({ preventScroll: true });
		else record.source.blur();
	}
}
function resolveItem(id) {
	const item = ItemTable[id];
	if (!item?.identifiedDisplayName) return null;
	const description = item.identifiedDescriptionName;
	return { title: toPlainRagnarokText(item.identifiedDisplayName), pages: [Array.isArray(description) ? description.join('\n') : description || '暂无物品说明'] };
}
function navigationBlock(source) {
	if (desktopInputOwner()) return '请先结束当前对话或操作，再使用导航';
	const interaction = interactionSnapshot();
	if (interaction && !['storage', 'cart', 'equipment'].includes(interaction.kind)) return '请先结束当前对话或操作，再使用导航';
	for (let node = source; node; node = node.parentElement || node.getRootNode?.().host) {
		if (node.dataset?.navigationBlocked) return node.dataset.navigationBlocked;
		if (node.id === 'NpcBox') return '请先结束当前对话，再使用导航';
	}
	return '';
}
export function openTipBox(id, source, { keyboard = false, item = false } = {}) {
	const key = String(id);
	const itemEntry = item ? resolveItem(key) : null;
	if (item ? !itemEntry : !Object.hasOwn(catalog.entries, key)) return false;
	if (active?.suspended) abandonNavigationVisit();
	if (active) return item ? active.reader.openItem(key) : active.reader.open(key);
	const host = document.createElement('div');
	host.id = 'TipBoxReader';
	document.body.append(host);
	const root = host.attachShadow({ mode: 'open' });
	const blocked = navigationBlock(source);
	acquireInputFreeze(host);
	try {
		const reader = createTipBoxReader(root, {
			entries: item ? { ...catalog.entries, [`item:${key}`]: itemEntry } : catalog.entries,
			initialId: item ? `item:${key}` : key, loadImage, mobile: Platform.isMobile,
			resolveItem, activateNavi: (...args) => {
				if (!blocked && !navigationBlock(source)) return activateNavi(...args);
			},
			prepareLinks(article) {
				prepareNaviLinks(article);
				const reason = blocked || navigationBlock(source);
				for (const link of article.querySelectorAll('[data-navi-info]')) {
					link.removeAttribute('title');
					if (!reason) continue;
					link.classList.remove('navi-link');
					link.removeAttribute('role');
					link.removeAttribute('tabindex');
					link.title = reason;
				}
			},
			onClose: () => closeTipBox()
		});
		active = { host, reader, source, keyboard, suspended: false, owner: sourceOwner(source), sourceRoot: source?.getRootNode?.() };
		const record = active;
		if (record.owner) {
			record.observer = new MutationObserver(() => {
				if (active !== record || record.suspended) return;
				if (record.owner && !record.owner.isConnected) {
					closeTipBox({ restoreFocus: false });
					return;
				}
				reader.refreshLinks();
			});
			record.observer.observe(document.body, { childList: true });
			if (record.sourceRoot instanceof ShadowRoot)
				record.observer.observe(record.sourceRoot, { childList: true, subtree: true });
		}
		host.addEventListener('navi-source-suspend', event => {
			event.stopPropagation();
			if (active !== record || record.suspended || blocked || navigationBlock(record.source)) {
				event.detail.blocked = true;
				return;
			}
			event.detail.suspend = () => {
				releaseInputFreeze(record.host);
				record.suspended = true;
				reader.suspend();
				const underlying = suspendNavigationSource(navigationSource(record));
				if (underlying === false) {
					record.suspended = false;
					acquireInputFreeze(record.host);
					reader.resume();
					return false;
				}
				return {
					restore() {
						if (active !== record) return;
						underlying?.restore();
						if (record.owner && !record.owner.isConnected) {
							// Opening a map from the adventure catalog replaces that catalog view.
							record.observer?.disconnect();
							record.owner = null;
						}
						record.suspended = false;
						acquireInputFreeze(record.host);
						reader.resume();
					},
					discard() {
						if (active === record) closeTipBox({ restoreFocus: false });
						underlying?.discard();
					}
				};
			};
		});
		return true;
	} catch (error) {
		host.remove();
		releaseInputFreeze(host);
		throw error;
	}
}
/** Capture across shadow roots before a source window's ordinary click/keyboard handlers. */
export function bindTipBoxLinks(root = document) {
	if (bound.has(root)) return;
	bound.add(root);
	const activate = event => {
		const path = event.composedPath();
		const external = path.find(node => node instanceof Element && node.matches('a.markup-url'));
		if (external && (event.type === 'click' || event.key === 'Enter')) {
			// Keep native new-tab navigation while excluding dialogue/game activation.
			event.stopImmediatePropagation();
			return;
		}
		if (active && path.includes(active.host)) return;
		if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
		const link = path.find(node => node instanceof Element && node.matches('.tipbox-link[data-tipbox-id], .item-link[data-item-id]'));
		if (!link) return;
		const item = Boolean(link.dataset.itemId);
		if (item ? !resolveItem(link.dataset.itemId) : !Object.hasOwn(catalog.entries, link.dataset.tipboxId)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		if (Platform.isMobile && event.type !== 'keydown') link.blur();
		openTipBox(item ? link.dataset.itemId : link.dataset.tipboxId, link, { keyboard: event.type === 'keydown', item });
	};
	root.addEventListener('click', activate, true);
	(root === document ? window : root).addEventListener('keydown', activate, true);
}
subscribeInteraction(() => {
	// Interaction state can change after subscribers finish updating the source window.
	queueMicrotask(() => {
		if (!active || active.suspended) return;
		active.reader.refreshLinks();
	});
});
onConnectionEnd(() => closeTipBox({ restoreFocus: false }));
