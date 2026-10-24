import skillNames from 'DB/Skills/SkillNames.zh-CN.json';
import Session from 'Engine/SessionStorage.js';
import { createGameInventory } from './GameInventory.js';
import { showInteraction, clearInteraction, interactionSnapshot } from './ServerInteraction.js';

export function openGameMaterials(type, submit) {
	const token = Symbol('materials'),
		inventory = createGameInventory(() => true),
		order = new Map();
	let guard = () => false,
		done = false;
	const active = () => !done && Session.Playing && interactionSnapshot()?.token === token;
	function finish(action) {
		if (!active()) return false;
		done = true;
		clearInteraction('materials');
		submit({
			Type: type,
			Action: action,
			MaterialList: action ? [...order.values()].map(({ index, count }) => ({ index, count })) : []
		});
		return true;
	}
	const service = {
		setOperationGuard(fn) {
			guard = fn;
		},
		snapshot() {
			return {
				items: inventory.snapshot().filter(item => !item.worn),
				order: [...order.values()],
				allowed: active() && guard() && Session.Entity?.action !== Session.Entity?.ACTION.DIE
			};
		},
		set(index, id, count) {
			const state = service.snapshot(),
				item = state.items.find(entry => entry.index === index && entry.ID === id);
			if (!state.allowed || !item || !Number.isInteger(count) || count < 0 || count > 65535 || count > item.count)
				return '物品或数量已变化';
			if (count) order.set(index, { index, ID: id, count, name: item.name });
			else order.delete(index);
			return '';
		},
		confirm() {
			const state = service.snapshot();
			if (!state.allowed || !order.size) return '请先选择材料';
			if (
				state.order.some(
					row =>
						!state.items.some(
							item => item.index === row.index && item.ID === row.ID && item.count >= row.count
						)
				)
			)
				return '材料已变化，请重新选择';
			finish(1);
			return '';
		},
		clear() {
			order.clear();
		}
	};
	showInteraction({
		kind: 'materials',
		title: type === 0 ? skillNames.GN_CHANGEMATERIAL : type === 1 ? `${skillNames.SO_EL_ANALYSIS}：纯矿转原石` : `${skillNames.SO_EL_ANALYSIS}：原石转纯矿`,
		token,
		service,
		close: () => finish(0)
	});
	return service;
}
