/** Resize storage grids by whole rows relative to the initial pointer position. */
export function bindStorageResize(handle, { getRows, resize, minimum, maximum }) {
	handle.style.touchAction = 'none';
	handle.addEventListener('pointerdown', event => {
		if (event.button !== 0 || !event.isPrimary) return;
		event.preventDefault();
		event.stopPropagation();
		const startY = event.clientY;
		const startRows = getRows();
		let currentRows = startRows;
		const pointerId = event.pointerId;
		const move = next => {
			if (next.pointerId !== pointerId) return;
			const rows = Math.max(minimum, Math.min(maximum, startRows + Math.trunc((next.clientY - startY) / 32)));
			if (rows === currentRows) return;
			resize(rows);
			currentRows = rows;
		};
		const stop = next => {
			if (next.pointerId !== pointerId) return;
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', stop);
			handle.removeEventListener('pointercancel', stop);
			handle.removeEventListener('lostpointercapture', stop);
			if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
		};
		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', stop);
		handle.addEventListener('pointercancel', stop);
		handle.addEventListener('lostpointercapture', stop);
		handle.setPointerCapture(pointerId);
	});
}
