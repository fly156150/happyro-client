const CLEAN_COLOR = new Float32Array([1, 1, 1, 1]);

function getSignature(config) {
	return [
		config.GID,
		config.job,
		config.characterAppearance || 0,
		config.body || 0,
		config.effectState || 0,
		config.allRidingState || 0,
		config.sex,
		config.head,
		config.headpalette,
		config.bodypalette,
		config.accessory,
		config.accessory2,
		config.accessory3,
		config.robe,
		config.direction
	].join(':');
}

export function createEquipmentPreviewEntity(getEntityClass) {
	let entity = null;
	let signature = '';

	return function resolveEquipmentPreview(config, animation) {
		const nextSignature = getSignature(config);
		if (entity && signature === nextSignature) {
			return entity;
		}

		const EntityClass = getEntityClass();
		entity?.clean?.();
		entity = new EntityClass();
		entity.set({
			GID: config.GID,
			objecttype: EntityClass.TYPE_PC,
			job: config.job,
			sex: config.sex,
			name: '',
			hideShadow: true,
			head: config.head,
			headpalette: config.headpalette,
			bodypalette: config.bodypalette,
			accessory: config.accessory,
			accessory2: config.accessory2,
			accessory3: config.accessory3,
			Robe: config.robe
		});
		if (config.characterAppearance && config.body >= 0) entity._body = config.body;
		if (config.body !== undefined) entity.body = config.body;
		entity.allRidingState = config.allRidingState || 0;
		entity.effectState = config.effectState || 0;
		entity.characterAppearance = config.characterAppearance || 0;
		entity.effectColor.set(CLEAN_COLOR);
		entity.direction = config.direction;
		entity.headDir = 0;
		entity.action = entity.ACTION.IDLE;
		entity.animation = animation;
		signature = nextSignature;
		return entity;
	};
}
