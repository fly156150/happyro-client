const placeholder =
	'data:image/svg+xml,' +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="4" fill="#253442" stroke="#65717b"/><path d="m6 8 6-3 6 3v8l-6 3-6-3zm0 0 6 3 6-3m-6 3v8" fill="none" stroke="#bac4cd"/></svg>'
	);

/** Each rendered list owns its object URLs and discards late asset responses. */
export function createItemImageLoader(load) {
	const urls = new Set();
	let generation = 0;
	return {
		clear() {
			generation++;
			for (const url of urls) URL.revokeObjectURL(url);
			urls.clear();
		},
		image(id) {
			const image = document.createElement('img');
			image.className = 'pickup-item-icon';
			image.width = image.height = 24;
			image.alt = '';
			image.src = placeholder;
			image.onerror = () => {
				image.onerror = null;
				image.src = placeholder;
			};
			const request = generation;
			Promise.resolve()
				.then(() => load(id))
				.then(url => {
					if (request !== generation || !image.isConnected) {
						URL.revokeObjectURL(url);
						return;
					}
					urls.add(url);
					image.src = url;
				})
				.catch(() => {});
			return image;
		}
	};
}
