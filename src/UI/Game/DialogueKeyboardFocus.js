/** A retained NPC dialog must not consume keys intended for a window above it. */
export function hasHigherFocusedWindow(component, components) {
	if (document.getElementById('TipBoxReader')?.shadowRoot?.querySelector('dialog[open]')) return true;
	const ownZ = Number.parseInt(getComputedStyle(component._host).zIndex, 10) || 0;
	return Object.values(components || {}).some(other => {
		if (other === component || !other.__active || !other.needFocus || !other._host?.isConnected) return false;
		const style = getComputedStyle(other._host);
		if (other._host.hidden || style.display === 'none' || style.visibility === 'hidden') return false;
		return (Number.parseInt(style.zIndex, 10) || 0) > ownZ;
	});
}
