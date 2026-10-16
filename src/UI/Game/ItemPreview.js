import DB from 'DB/DBManager.js';
import ItemType from 'DB/Items/ItemType.js';
import Client from 'Core/Client.js';

/** Inventory and storage use the same collection image and optional card illustration. */
export function createItemPreviewLoader() {
	const images = new Map();
	function load(path) {
		if (!images.has(path)) images.set(path, new Promise(resolve => Client.loadFile(path, resolve, () => resolve(''))));
		return images.get(path);
	}
	return async item => {
		const info = DB.getItemInfo(item.ITID);
		const resource = item.IsIdentified ? info.identifiedResourceName : info.unidentifiedResourceName;
		const illustration = item.type === ItemType.CARD && item.IsIdentified && info.illustResourcesName;
		const [image, art] = await Promise.all([
			resource ? load(`${DB.INTERFACE_PATH}collection/${resource}.bmp`) : '',
			illustration ? load(`${DB.INTERFACE_PATH}cardbmp/${illustration}.bmp`) : ''
		]);
		return { image, art };
	};
}
