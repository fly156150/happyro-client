let catalogPromise;
let dropsPromise;

export function loadMonsterCatalog() {
	if (!catalogPromise) {
		catalogPromise = loadMonsterFile('catalog.json', 'Monster catalog').catch(error => {
			catalogPromise = null;
			throw error;
		});
	}
	return catalogPromise;
}

/**
 * Drops are most of the catalog's weight and only matter once a monster is
 * opened, so they live in their own file fetched on first detail render.
 */
export function loadMonsterDrops() {
	if (!dropsPromise) {
		dropsPromise = loadMonsterFile('drops.json', 'Monster drops').catch(error => {
			dropsPromise = null;
			throw error;
		});
	}
	return dropsPromise;
}

function loadMonsterFile(name, label) {
	const url = new URL(`./data/monsters/${name}`, window.location.href);
	return fetch(url).then(response => {
		if (!response.ok) throw new Error(`${label} request failed: ${response.status}`);
		return response.json();
	});
}
