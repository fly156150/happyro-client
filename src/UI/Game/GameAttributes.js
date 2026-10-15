import { allocationCost } from './AttributeAllocation.js';
import { loadCharacterAllocationLimits } from 'UI/Components/GameTools/AdventureControlService.js';
import Session from 'Engine/SessionStorage.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import JobPropertyTable from 'DB/Jobs/JobPropertyTable.js';
import { characterStats, characterStatValues, characterStatResult } from './CharacterStats.js';
import { pointResetState, resetCharacterPoints } from './GamePointReset.js';

const baseFields = [
	['str', '力量 STR', 13],
	['agi', '敏捷 AGI', 14],
	['vit', '体力 VIT', 15],
	['int', '智力 INT', 16],
	['dex', '灵巧 DEX', 17],
	['luk', '幸运 LUK', 18]
];
const traitFields = [
	['pow', '力量 POW', 219],
	['sta', '耐力 STA', 220],
	['wis', '智慧 WIS', 221],
	['spl', '法力 SPL', 222],
	['con', '专注 CON', 223],
	['crt', '创造 CRT', 224]
];

export function createGameAttributes(canOperate) {
	let limits = null,
		limitsJob,
		applying = false;
	let owner,
		pending = null,
		message = '';
	function snapshot() {
		const entity = Session.Entity;
		if (owner !== entity) {
			owner = entity;
			pending = null;
			message = '';
			limits = null;
		}
		if (pending) {
			const result = characterStatResult(entity, pending.id);
			if (result !== pending.result) {
				message = result.success
					? `${pending.label}已增加 ${pending.amount} 点`
					: '加点未成功，请检查剩余点数和素质上限';
				pending = null;
			} else if (performance.now() - pending.at >= 8000) {
				message = '暂未收到服务器确认，请核对当前数值后重试';
				pending = null;
			}
		}
		const values = characterStatValues(entity);
		const reset = pointResetState(entity);
		if (limitsJob !== (entity?._job ?? entity?.job)) limits = null;
		const allowed = Boolean(canOperate() && Session.Playing && entity && entity.action !== entity.ACTION.DIE);
		const traits = Boolean(JobPropertyTable[entity?._job ?? entity?.job]?.isFourthClass);
		const section = (fields, points, enabled) => ({
			points: values[points] ?? null,
			enabled,
			rows: fields.map(([key, label, id]) => {
				const value = values[key],
					bonus = values[key + '2'] || 0,
					cost = values[key + '3'];
				return {
					key,
					label,
					id,
					value: value ?? null,
					bonus,
					cost: cost ?? null,
					maximum: enabled
						? ((fields === baseFields ? limits?.base?.[key] : limits?.traits?.[key]) ?? null)
						: null,
					canAdd: Boolean(
						allowed &&
						enabled &&
						!pending &&
						!applying &&
						!reset.pending &&
						value !== undefined &&
						cost > 0 &&
						values[points] >= cost
					)
				};
			})
		});
		const related = {
			base: [
				{ key: 'maxHp', label: '最大 HP', value: entity?.life?.hp_max ?? '—' },
				{ key: 'maxSp', label: '最大 SP', value: entity?.life?.sp_max ?? '—' },
				...characterStats(entity).filter(stat => !baseFields.some(([key]) => key === stat.key))
			],
			traits: [
				['patk', '物理攻击倍率 P.ATK'],
				['smatk', '魔法攻击倍率 S.MATK'],
				['res', '物理抗性 RES'],
				['mres', '魔法抗性 MRES'],
				['hplus', '治疗加成 H.PLUS'],
				['crate', '暴击伤害 C.RATE']
			].map(([key, label]) => ({ key, label, value: values[key] ?? '—' }))
		};
		return {
			base: section(baseFields, 'statuspoint', true),
			traits: section(traitFields, 'trait_point', traits),
			allowed: allowed && !pending && !applying && !reset.pending,
			pending: Boolean(pending || applying || reset.pending),
			message: reset.pending ? reset.message : message,
			resetMessage: reset.message,
			related
		};
	}
	function sendIncrease(row, amount) {
		pending = {
			id: row.id,
			label: row.label,
			amount,
			result: characterStatResult(owner, row.id),
			at: performance.now()
		};
		message = '正在加点…';
		const packet = new PACKET.CZ.STATUS_CHANGE();
		packet.statusID = row.id;
		packet.changeAmount = amount;
		Network.sendPacket(packet);
	}
	return {
		snapshot,
		async prepare() {
			snapshot();
			const entity = owner,
				job = entity?._job ?? entity?.job;
			const data = await loadCharacterAllocationLimits();
			if (Session.Entity === entity && (entity?._job ?? entity?.job) === job) {
				limits = data;
				limitsJob = job;
			}
		},
		async apply(kind, additions, expected) {
			const initial = snapshot();
			if (!initial.allowed || !['base', 'traits'].includes(kind) || !initial[kind].enabled)
				throw new Error('当前不能加点');
			const section = initial[kind];
			if (
				section.points !== expected.points ||
				section.rows.some(row => row.value !== expected.rows.find(entry => entry.key === row.key)?.value)
			)
				throw new Error('素质已变化，请重新预加点');
			let total = 0;
			const plan = Object.entries(additions)
				.filter(([, amount]) => amount > 0)
				.map(([key, amount]) => {
					const row = section.rows.find(entry => entry.key === key);
					if (
						!row?.canAdd ||
						!Number.isInteger(amount) ||
						row.maximum === null ||
						row.value + amount > row.maximum
					)
						throw new Error('预加点超出可用范围');
					total += allocationCost(kind, row.value, amount);
					return { row, amount };
				});
			if (!plan.length || total > section.points) throw new Error('剩余素质点不足');
			const entity = owner;
			applying = true;
			try {
				for (const { row, amount } of plan) {
					let remaining = amount;
					while (remaining > 0) {
						if (
							Session.Entity !== entity ||
							!Session.Playing ||
							!canOperate() ||
							entity.action === entity.ACTION.DIE ||
							pointResetState(entity).pending
						)
							throw new Error('角色状态已变化，加点已停止');
						const count = Math.min(remaining, kind === 'base' ? 255 : 65535);
						const before = characterStatValues(entity)[row.key];
						const resultBefore = characterStatResult(entity, row.id);
						sendIncrease(row, count);
						while (pending && Session.Entity === entity) {
							await new Promise(resolve => setTimeout(resolve, 50));
							snapshot();
						}
						const result = characterStatResult(entity, row.id);
						if (
							Session.Entity !== entity ||
							result === resultBefore ||
							!result?.success ||
							characterStatValues(entity)[row.key] !== before + count
						)
							throw new Error('加点未全部完成，请核对当前数值');
						remaining -= count;
					}
				}
			} finally {
				applying = false;
			}
		},
		increase(kind, key) {
			const state = snapshot();
			const row = state[kind]?.rows?.find(entry => entry.key === key);
			if (!row?.canAdd) return '当前不能增加这项素质';
			sendIncrease(row, 1);
			return message;
		},
		async reset(kind) {
			const state = snapshot();
			if (!state.allowed || !['base', 'traits'].includes(kind) || !state[kind].enabled)
				return '当前不能重置素质点';
			const entity = owner;
			const result = await resetCharacterPoints(kind, entity);
			if (entity === Session.Entity) message = result;
			return result;
		}
	};
}
