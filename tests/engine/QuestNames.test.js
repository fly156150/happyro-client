import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ hooks: new Map(), setQuestList: vi.fn(), addQuest: vi.fn() }));
vi.mock('Network/NetworkManager.js', () => ({ default: { hookPacket: (id, handler) => state.hooks.set(id, handler) } }));
vi.mock('Network/PacketStructure.js', () => ({ default: { ZC: new Proxy({}, { get: (_, key) => key }) } }));
vi.mock('DB/DBManager.js', () => ({ default: { getQuestInfo: () => ({ Title: '试炼' }) } }));
vi.mock('UI/Components/Quest/Quest.js', () => ({ default: { getUI: () => ({
	setQuestList: state.setQuestList, addQuest: state.addQuest, questExists: () => false
}) } }));
import init from '../../src/Engine/MapEngine/Quest.js';
beforeEach(() => { vi.clearAllMocks(); init(); });
const hunt = () => ({ huntID: 1000, mobGID: 1708, mobName: '达纳托斯之忆', maxCount: 1 });
it('localizes initial lists, newly added quests and update-created quests', () => {
	state.hooks.get('ALL_QUEST_LIST_V4')({ questCount: 1, QuestList: [{ questID: 1, count: 1, hunt: [hunt()] }] });
	expect(state.setQuestList.mock.calls[0][0][1].hunt_list[1000].mobName).toBe('魔剑士 达纳托斯的记忆');
	state.hooks.get('ADD_QUEST3')({ questID: 1, count: 1, hunt: [hunt()] });
	expect(state.addQuest.mock.calls[0][0].hunt_list[1000].mobName).toBe('魔剑士 达纳托斯的记忆');
	state.hooks.get('UPDATE_MISSION_HUNT4')({ questCount: 1, hunt: [{ ...hunt(), questID: 1 }] });
	expect(state.addQuest.mock.calls[1][0].hunt_list[1000].mobName).toBe('魔剑士 达纳托斯的记忆');
});
