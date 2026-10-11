import { pointResetState, resetCharacterPoints } from './GamePointReset.js';
import SkillWindow from 'UI/Components/SkillList/SkillList.js';
import SkillInfo from 'DB/Skills/SkillInfo.generated.js';
import { skillTiers } from './SkillTiers.js';
import { canExecuteSkill } from 'UI/Components/SkillList/SkillUse.js';
import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Session from 'Engine/SessionStorage.js';
import { toPlainRagnarokText } from 'Utils/RagnarokText.js';

export function createGameSkills(canOperate, shortcuts) {
	const icons = new Map();
	let pending = null,
		owner,
		message = '';

	function snapshot() {
		if (owner !== Session.Entity) {
			owner = Session.Entity;
			pending = null;
			message = '';
		}
		const reset = pointResetState(owner);
		const ui = SkillWindow.getUI();
		const learned = new Map(ui.getSkills().map(skill => [skill.SKID, skill]));
		const ids = new Set(learned.keys());
		const tiers = skillTiers(Session.Entity?._job ?? Session.Entity?.job);
		for (const id of tiers.keys()) ids.add(id);
		if (pending && pending.revision !== ui.getSkillRevision()) pending = null;
		const points = ui.getSkillPoints();
		const allowed = Boolean(
			canOperate() &&
			!reset.pending &&
			Session.Playing &&
			Session.Entity &&
			Session.Entity.action !== Session.Entity.ACTION.DIE
		);
		return {
			points,
			canReset: allowed && !pending,
			message: reset.pending ? reset.message : message,
			allowed,
			skills: [...ids]
				.filter(id => SkillInfo[id])
				.map(id => {
					const info = SkillInfo[id],
						skill = learned.get(id),
						level = skill?.level || 0;
					if (!icons.has(id)) {
						icons.set(id, '');
						Client.loadFile(`${DB.INTERFACE_PATH}item/${info.Name}.bmp`, url => icons.set(id, url));
					}
					const requirements = (info._NeedSkillList || []).map(
						([need, required]) =>
							`${SkillInfo[need]?.SkillName || need} ${learned.get(need)?.level || 0}/${required}`
					);
					const reason = !allowed
						? '当前不能学习技能'
						: pending
							? '等待服务器更新技能'
							: !points
								? '技能点不足'
								: !skill?.upgradable
									? '尚未满足学习条件，或已达到可学习上限'
									: '';
					return {
						id,
						tier: tiers.get(id) || '其它',
						name: info.SkillName,
						icon: icons.get(id),
						description: toPlainRagnarokText(DB.getSkillDescription(id)),
						level,
						max: Math.max(info.MaxLv, level),
						active: canExecuteSkill(skill),
						kind: level ? (skill.type === 0 ? '被动' : '主动') : '未学习',
						requirements,
						reason,
						learnable: !reason
					};
				})
		};
	}
	return {
		snapshot,
		learn(id, expectedLevel) {
			const skill = snapshot().skills.find(entry => entry.id === id);
			if (!skill || !skill.learnable || skill.level + 1 !== expectedLevel) return '技能状态已经变化，请重新确认';
			pending = { revision: SkillWindow.getUI().getSkillRevision() };
			SkillWindow.getUI().onIncreaseSkill(id);
			return '已请求学习一级，等待服务器更新';
		},
		async reset() {
			if (!snapshot().canReset) return '当前不能重置技能点';
			const entity = owner;
			const result = await resetCharacterPoints('skills', entity);
			if (entity === Session.Entity) message = result;
			return result;
		},
		bind(id, level, slot) {
			const state = snapshot();
			const skill = state.skills.find(entry => entry.id === id);
			return Boolean(
				state.allowed &&
				skill?.active &&
				Number.isInteger(level) &&
				level > 0 &&
				level <= skill.level &&
				shortcuts.configure(slot, { isSkill: true, ID: id }, level)
			);
		}
	};
}
