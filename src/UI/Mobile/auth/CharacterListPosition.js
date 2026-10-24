/** Preserve the list across creation screens without scrolling the auth page. */
export function preserveCharacterListPosition(component) {
	const append = component.onAppend;
	const remove = component.onRemove;
	const setInfo = component.setInfo;
	let scrollTop = 0;
	let frame;
	function revealSelection() {
		if (!component._host.isConnected) return;
		const list = component.getRoot().querySelector('.char_list');
		const slot = list.querySelector('[aria-pressed="true"]');
		if (!slot || !list.clientHeight) return;
		const bounds = list.getBoundingClientRect();
		const selected = slot.getBoundingClientRect();
		const top = bounds.top + list.clientTop;
		const bottom = top + list.clientHeight;
		if (selected.top < top) list.scrollTop += selected.top - top;
		else if (selected.bottom > bottom) list.scrollTop += selected.bottom - bottom;
	}
	component.onAppend = function () {
		append.call(this);
		this.getRoot().querySelector('.char_list').scrollTop = scrollTop;
		revealSelection();
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(revealSelection);
	};
	component.onRemove = function () {
		cancelAnimationFrame(frame);
		scrollTop = this.getRoot().querySelector('.char_list').scrollTop;
		remove.call(this);
	};
	component.setInfo = function (packet) {
		// A fresh login starts from its selected first slot, not the previous account's position.
		cancelAnimationFrame(frame);
		scrollTop = 0;
		const result = setInfo.call(this, packet);
		this.getRoot().querySelector('.char_list').scrollTop = 0;
		return result;
	};
	return component;
}
