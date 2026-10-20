import { createGameInventory } from './GameInventory.js';
import { toPlainRagnarokText } from 'Utils/RagnarokText.js';
import { skillTiers } from './SkillTiers.js';
import Guild from 'UI/Components/Guild/Guild.js';
import ShortCut from 'UI/Components/ShortCut/ShortCut.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import SkillWindow from 'UI/Components/SkillList/SkillList.js';
import SkillTargetSelection from 'UI/Components/SkillTargetSelection/SkillTargetSelection.js';
import { canExecuteSkill, SKILL_INF } from 'UI/Components/SkillList/SkillUse.js';
import SkillInfo from 'DB/Skills/SkillInfo.generated.js';
import SkillId from 'DB/Skills/SkillConst.js';
import SkillListMH from 'UI/Components/SkillListMH/SkillListMH.js';
import { equipment, usableItems as usable, itemQuantity } from './InventoryItems.js';
import DB from 'DB/DBManager.js';
import Client from 'Core/Client.js';
import Session from 'Engine/SessionStorage.js';
import EntityManager from 'Renderer/EntityManager.js';
import Camera from 'Renderer/Camera.js';
import Altitude from 'Renderer/Map/Altitude.js';
import Mouse from 'Controls/MouseEventHandler.js';
import { remainingCooldown } from 'Network/SkillCooldowns.js';
import { createShortcutController } from './ShortcutController.js';
import { canTargetSkill } from './SkillTargets.js';

function caster(id) {
	if (id > SkillId.HOMUN_BEGIN && id < SkillId.HOMUN_LAST) return EntityManager.get(Session.homunId);
	if (id > SkillId.MERCENARY_BEGIN && id < SkillId.MERCENARY_LAST) return EntityManager.get(Session.mercId);
	return Session.Entity;
}

export function createGameShortcuts(moving = () => false) {
	const icons = new Map();
	const inventory = createGameInventory(() => true);
	function icon(file) {
		if (!file) return '';
		if (!icons.has(file)) {
			icons.set(file, '');
			Client.loadFile(`${DB.INTERFACE_PATH}item/${file}.bmp`, url => icons.set(file, url));
		}
		return icons.get(file);
	}
	function describe(binding) {
		if (binding.isSkill) {
			const skill = ShortCut.getSkillById(binding.ID),
				info = SkillInfo[binding.ID];
			let reason = !canExecuteSkill(skill)
				? '技能不可用'
				: binding.count < 1 || binding.count > skill.level
					? '技能等级不可用'
					: '';
			if (!reason && binding.ID > 10000 && binding.ID < 10100 && (!Session.hasGuild || !Session.isGuildMaster))
				reason = '没有公会技能使用权限';
			const actor = caster(binding.ID);
			if (!reason && (!actor || actor.action === actor.ACTION.DIE || actor.remove_tick > 0))
				reason = '施法者不可用';
			if (!reason && binding.count === skill.level && skill.spcost > actor.life.sp) reason = 'SP 不足';
			return {
				name: info?.SkillName || `技能 ${binding.ID}`,
				icon: icon(info?.Name),
				amount: `Lv.${binding.count}`,
				reason
			};
		}
		const item = Inventory.getUI().getItemById(binding.ID),
			info = DB.getItemInfo(binding.ID);
		const file = item && !item.IsIdentified ? info.unidentifiedResourceName : info.identifiedResourceName;
		const reason = !itemQuantity(item)
			? '道具已用完'
			: !usable.includes(item.type)
				? '此物品不能快捷使用'
				: equipment.includes(item.type) && (!item.IsIdentified || item.IsDamaged)
					? '装备不可用'
					: '';
		return {
			name: item ? DB.getItemName(item) : info.identifiedDisplayName,
			icon: icon(file),
			amount: itemQuantity(item),
			reason
		};
	}
	return createShortcutController({
		bindings: () => ShortCut.getList(),
		skill: id => ShortCut.getSkillById(id),
		cooldown: remainingCooldown,
		describe,
		canUse: () =>
			Boolean(
				Session.Playing &&
				!Session.FreezeUI &&
				Session.Entity &&
				Session.Entity.action !== Session.Entity.ACTION.DIE
			),
		self: id => caster(id),
		supportPicking: value => EntityManager.setSupportPicking(value),
		canTarget: (target, flag, id) =>
			Boolean(
				target &&
				EntityManager.get(target.GID) === target &&
				(!(flag & SKILL_INF.ENEMY) || target.action !== target.ACTION.DIE) &&
				target.remove_tick <= 0 &&
				canTargetSkill(target, flag, { self: caster(id), canAttack: SkillTargetSelection.checkMapState })
			),
		castId: (id, level, target) => SkillTargetSelection.onUseSkillToId(id, level, target, { allowMove: !moving() }),
		castGround: (...args) => SkillTargetSelection.onUseSkillToPos(...args),
		useItem: id => {
			const item = Inventory.getUI().getItemById(id);
			if (!item) return '道具已用完';
			if (equipment.includes(item.type) && Inventory.getUI().equippedItems.includes(item.index))
				return '该装备已穿戴';
			return inventory.act(item.index, item.ITID, equipment.includes(item.type) ? 'equip' : 'use', undefined, {
				notifySuccess: false
			});
		},
		hasItem: id => {
			const item = Inventory.getUI().getItemById(id);
			return Boolean(itemQuantity(item) && usable.includes(item.type));
		},
		configure: (...args) => ShortCut.configure(...args),
		candidates: () => {
			const tiers = skillTiers(Session.Entity?._job ?? Session.Entity?.job);
			return [
				...[
					...SkillWindow.getUI().getSkills(),
					...(EntityManager.get(Session.homunId) ? SkillListMH.homunculus.getSkills() : []),
					...(EntityManager.get(Session.mercId) ? SkillListMH.mercenary.getSkills() : []),
					...(Session.hasGuild && Session.isGuildMaster ? Guild.getSocialSnapshot().skills : [])
				]
					.filter(canExecuteSkill)
					.map(skill => ({
						isSkill: true,
						ID: skill.SKID,
						tier: tiers.get(skill.SKID) || '其它',
						description: toPlainRagnarokText(DB.getSkillDescription(skill.SKID)),
						skillDetail: {
							name: SkillInfo[skill.SKID]?.SkillName || String(skill.SKID),
							kind: skill.type === 0 ? '被动' : '主动',
							level: skill.level,
							max: Math.max(SkillInfo[skill.SKID]?.MaxLv || skill.level, skill.level),
							requirements: [], reason: '',
							description: toPlainRagnarokText(DB.getSkillDescription(skill.SKID))
						},
						level: skill.level,
						...describe({ isSkill: true, ID: skill.SKID, count: skill.level })
					})),
				...Inventory.getUI()
					.list.filter(item => itemQuantity(item) && usable.includes(item.type))
					.filter((item, i, list) => list.findIndex(other => other.ITID === item.ITID) === i)
					.map(item => ({
						isSkill: false,
						ID: item.ITID,
						type: item.type,
						description: toPlainRagnarokText(DB.getItemInfo(item.ITID)[item.IsIdentified ? 'identifiedDescriptionName' : 'unidentifiedDescriptionName']),
						...describe({ isSkill: false, ID: item.ITID })
					}))
			];
		},
		pick: (x, y) => {
			Mouse.screen.x = x;
			Mouse.screen.y = y;
			const pos = [];
			const ground = Altitude.intersect(Camera.modelView, Camera.projection, pos) ? pos : null;
			return { ground, target: EntityManager.intersect() };
		}
	});
}
