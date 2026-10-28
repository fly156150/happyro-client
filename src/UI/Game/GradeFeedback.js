export function gradeRefineHint(refine) {
	return `当前精炼 +${refine ?? 0} 不满足升阶条件，请先提高精炼等级。升阶成功后精炼等级会归零。`;
}
