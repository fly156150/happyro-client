import Quest from 'UI/Components/Quest/Quest.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Session from 'Engine/SessionStorage.js';
import DB from 'DB/DBManager.js';
import { toPlainRagnarokText } from 'Utils/RagnarokText.js';

function targets(quest) {
	const result = [];
	for (const text of [quest.summary, quest.description])
		for (const match of String(text || '').matchAll(/<NAVI>(.*?)<INFO>(.*?)<\/INFO><\/NAVI>/gi)) {
			const [id, x, y] = match[2].split(',');
			if (id && Number.isFinite(Number(x)) && Number.isFinite(Number(y)))
				result.push({ id, name: toPlainRagnarokText(match[1]), x: Number(x), y: Number(y), naviInfo: match[2], inline: true });
		}
	if (quest.npc_navi && !result.length) {
		const [id, x, y] = String(quest.npc_navi).split(',');
		result.push({ id, name: id, x: Number(x ?? quest.npc_pos_x), y: Number(y ?? quest.npc_pos_y), naviInfo: [id, x ?? quest.npc_pos_x, y ?? quest.npc_pos_y].join(',') });
	}
	return result;
}
export function createGameQuests(canOperate) {
	let pending = null;
	function snapshot() {
		const quests = Quest.getUI()
			.getQuests()
			.map(quest => ({
				...quest,
				targets: targets(quest),
				summaryMarkup: quest.summary,
				descriptionMarkup: quest.description,
				title: toPlainRagnarokText(quest.title) || `任务 ${quest.questID}`,
				summary: toPlainRagnarokText(quest.summary),
				description: toPlainRagnarokText(quest.description),
				objectives: Object.values(quest.hunt_list || {}).map(hunt => ({
					name: hunt.mobName || `目标 ${hunt.mobGID || hunt.huntID}`,
					count: hunt.huntCount,
					total: hunt.maxCount
				})),
				rewards: (quest.reward_item_list || []).map(item => ({
					...item,
					name: DB.getItemInfo(item.ItemID).identifiedDisplayName
				}))
			}));
		if (pending && !quests.some(q => q.questID === pending.id && q.active === pending.active)) pending = null;
		return { quests, allowed: Boolean(canOperate() && Session.Playing), pending: pending?.id };
	}
	return {
		snapshot,
		toggle(id, active) {
			const state = snapshot(),
				quest = state.quests.find(q => q.questID === id);
			if (!state.allowed || pending || !quest || quest.active !== active || active === 2) return false;
			const pkt = new PACKET.CZ.ACTIVE_QUEST();
			pkt.questID = id;
			pkt.active = active === 1 ? 0 : 1;
			pending = { id, active };
			Network.sendPacket(pkt);
			return true;
		}
	};
}
