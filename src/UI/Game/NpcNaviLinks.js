import { showNpcNaviPrompt } from './NpcNaviPrompt.js';
import { isNpcNaviAvailable } from 'UI/Components/Navigation/NpcNaviService.js';

/** Keep unavailable NPC destinations readable without exposing an interactive link. */
export function prepareNpcNaviLinks(root) {
	for (const link of root.querySelectorAll('[data-navi-info]')) {
		const available = isNpcNaviAvailable(link.dataset.naviInfo, link.dataset.naviName || link.textContent);
		link.classList.toggle('navi-link', available);
		if (available) {
			link.setAttribute('role', 'button');
			link.tabIndex = 0;
		} else {
			link.removeAttribute('role');
			link.removeAttribute('tabindex');
		}
	}
}

/** Retain the target until the player finishes the conversation. */
export function handleNpcNaviClick(event) {
	const link = event.target?.closest?.('[data-navi-info]');
	if (!link) return false;
	if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return false;
	event.preventDefault();
	event.stopPropagation();
	if (!isNpcNaviAvailable(link.dataset.naviInfo, link.dataset.naviName || link.textContent)) return true;
	showNpcNaviPrompt(link.dataset.naviInfo, {
		label: link.dataset.naviName || link.textContent,
		anchor: link.closest('.panel') || link.closest('.npc-content') || link.getRootNode().host || link.parentElement
	});
	return true;
}
