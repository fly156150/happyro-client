import SkillTree from 'DB/Skills/SkillTreeView.generated.js';
import JobPropertyTable from 'DB/Jobs/JobPropertyTable.js';

export function skillTiers(jobId) {
	const tiers = new Map();
	let job = jobId;
	while (job !== null && SkillTree[job]) {
		const tree = SkillTree[job];
		const properties = JobPropertyTable[job];
		const tier = properties?.isFourthClass
			? '四转'
			: properties?.isThirdClass
				? '三转'
				: properties?.isSecondClass
					? '二转'
					: properties?.isFirstClass
						? '一转'
						: properties?.isNoviceClass
							? '初心者'
							: '其它';
		for (const key of Object.keys(tree)) {
			if (!/^\d+$/.test(key)) continue;
			tiers.set(Number(key), tier);
		}
		job = tree.beforeJob;
	}
	return tiers;
}
