/** NAVI never answers or closes an NPC script on the player's behalf. */
export function createNaviDialogueGuard({ interaction, desktopBusy }) {
	return function prepareNaviTeleport() {
		const state = interaction();
		if (state?.kind === 'npc' || state?.kind === 'deal' || desktopBusy()) {
			return { allowed: false, message: '请先正常结束 NPC 对话，再点击传送。目标会保留，不会自动选择对话选项。' };
		}
		return { allowed: true };
	};
}
