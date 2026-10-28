export function gradeRefineHint(refine) {
	return `当前精炼 +${refine ?? 0} 无法升阶，请检查所需精炼等级与服务器升阶成功率设置。升阶成功后精炼等级会归零。`;
}
