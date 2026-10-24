import officialStateIconTranslations from './stateiconinfo.zh-CN.json';
import statusSkillNames from './StatusSkillNames.json';
import skillNames from '../Skills/SkillLocalizationTable.generated.js';

export function applyOfficialStateIconTranslations(statusInfo, overlay = officialStateIconTranslations) {
	for (const [id, entry] of Object.entries(overlay)) {
		const statusId = Number(id);
		if (!statusInfo[statusId]) statusInfo[statusId] = {};
		if (Object.hasOwn(entry, 'haveTimeLimit')) statusInfo[statusId].haveTimeLimit = entry.haveTimeLimit;
		if (Object.hasOwn(entry, 'posTimeLimitStr')) statusInfo[statusId].posTimeLimitStr = entry.posTimeLimitStr;
		statusInfo[statusId].descript = entry.descript.map(line => [...line]);
	}
	// Only reviewed skill effects share names. Generic ailments and shared icons retain their own titles.
	if (overlay === officialStateIconTranslations) {
		for (const [id, entry] of Object.entries(statusSkillNames)) {
			const title = statusInfo[id]?.descript?.[0];
			const skill = skillNames[entry.skillId];
			if (title && skill) title[0] = `${entry.prefix || ''}${skill.name}${entry.suffix || ''}`;
		}
	}
	return statusInfo;
}

export function snapshotLocalizedStatusDescriptions(statusInfo, overlay = officialStateIconTranslations) {
	applyOfficialStateIconTranslations(statusInfo, overlay);
	const descriptions = new Map();

	for (const [id, info] of Object.entries(statusInfo)) {
		if (Array.isArray(info.descript) && info.descript.length > 0) {
			descriptions.set(
				Number(id),
				info.descript.map(line => [...line])
			);
		}
	}

	return descriptions;
}

export function restoreLocalizedStatusDescription(statusInfo, descriptions, id) {
	const localized = descriptions.get(Number(id));
	statusInfo[id].descript = localized ? localized.map(line => [...line]) : [];
	return Boolean(localized);
}
