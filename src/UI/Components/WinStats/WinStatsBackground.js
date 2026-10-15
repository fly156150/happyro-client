/** Expand the desktop stat skin without scaling its full-row point labels. */
export function expandStatsBackground(image) {
	const canvas = document.createElement('canvas');
	canvas.width = 427;
	canvas.height = image.naturalHeight;
	const context = canvas.getContext('2d');
	const original = [0, 37, 75, 85, 105, 140, 195, 230, 280];
	const expanded = [0, 37, 77, 107, 177, 212, 302, 337, 427];
	for (let i = 0; i < original.length - 1; i++) {
		context.drawImage(image, original[i], 0, original[i + 1] - original[i], canvas.height,
			expanded[i], 0, expanded[i + 1] - expanded[i], canvas.height);
	}
	// Status Point and T.Status Point span both result columns in the source.
	// Copy their complete label at 1:1 scale, extending only the empty value area.
	for (const top of [64, 188]) {
		if (top + 20 > image.naturalHeight) continue;
		context.drawImage(image, 105, top, 90, 20, 177, top, 90, 20);
		context.drawImage(image, 195, top, 84, 20, 267, top, 159, 20);
		context.drawImage(image, 279, top, 1, 20, 426, top, 1, 20);
	}
	return canvas;
}
