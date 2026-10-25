import { playerStatuses } from 'Network/PlayerStatuses.js';
import { buffRule } from './CombatBuffRules.js';
import { combatCapability, specialSkillReason } from './CombatSkillCapabilities.js';
import { skillRequirementReason } from './CombatSkillRequirements.js';
import { cellDistance, trapPosition } from './CombatSkillPlacement.js';
import catalog from '../../../applications/pwa/data/combat/affinities.json';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import Equipment from 'UI/Components/Equipment/Equipment.js';
import { itemQuantity } from './InventoryItems.js';
import { combatSkillPriority } from './CombatSkillAffinity.js';
import { loadAutoCombatMapSpecies } from './AutoCombatMapSpecies.js';
import { getCurrentAdventureMap } from 'UI/Components/GameTools/AdventureActionService.js';
import { takeAutomationPickupTurn, cancelAutomationPickup } from './GameAutomation.js';
import { requestAutoCombatTeleport, isAutoCombatTeleportPending } from './AutoCombatTeleport.js';
import Navigation from 'UI/Components/Navigation/Navigation.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Session from 'Engine/SessionStorage.js';
import EntityManager from 'Renderer/EntityManager.js';
import Renderer from 'Renderer/Renderer.js';
import MapControl from 'Controls/MapControl.js';
import PathFinding from 'Utils/PathFinding.js';
import Altitude from 'Renderer/Map/Altitude.js';
import SkillWindow from 'UI/Components/SkillList/SkillList.js';
import SkillTargetSelection from 'UI/Components/SkillTargetSelection/SkillTargetSelection.js';
import { canExecuteSkill } from 'UI/Components/SkillList/SkillUse.js';
import Client from 'Core/Client.js';
import DB from 'DB/DBManager.js';
import SkillInfo from 'DB/Skills/SkillInfo.generated.js';
import { remainingCooldown } from 'Network/SkillCooldowns.js';
import * as Commands from './GameCommands.js';
import { createAutoCombatController } from './AutoCombatController.js';
import { loadAutoCombatSettings, saveAutoCombatSettings } from './AutoCombatSettings.js';

export function createGameAutoCombat(enabled) {
	const settingsKey = `HappyRO.AutoCombat:${JSON.stringify([Session.ServerName, Session.AID, Session.GID])}`;
	function targets() {
		const result = [];
		EntityManager.forEach(entity => {
			if (
				entity.objecttype !== entity.constructor.TYPE_MOB ||
				entity.action === entity.ACTION.DIE ||
				entity.remove_tick > 0
			)
				return;
			result.push({
				id: entity.GID,
				species: entity.job,
				name: entity.display.name,
				position: [...entity.position],
				healthState: entity._healthState,
				casting: Boolean(entity.cast?.display)
			});
		});
		return result;
	}
	function actorContext() {
		const entity = Session.Entity;
		const equipment = Equipment.getUI().getItems();
		const inventory = [...Inventory.getUI().list, ...equipment];
		const weapon = equipment.find(item => item.type === 4 && item.equipped & 2);
		const ammo = equipment.find(item => item.type === 10);
		return {
			hp: entity.life.hp,
			hpMax: entity.life.hp_max,
			ap: entity.life.ap,
			effects: entity._effectState || 0,
			spiritCount: entity.spiritCount || 0,
			zeny: Session.zeny,
			weapon: weapon ? catalog.weapons[weapon.ITID] : 'Fist',
			shield: equipment.some(item => item.type === 5 && item.location & 32),
			ammoType: catalog.ammunition[ammo?.ITID],
			ammoCount: itemQuantity(ammo),
			hasSkill: id =>
				SkillWindow.getUI()
					.getSkills()
					.some(skill => skill.SKID === id && skill.level > 0),
			equippedItem: id => equipment.some(item => item.ITID === id),
			itemCount: id =>
				inventory.filter(item => item.ITID === id).reduce((sum, item) => sum + itemQuantity(item), 0),
			hasStatus: id => playerStatuses.has(id),
			statusValue: (id, index) => playerStatuses.values(id)?.[index],
			spheres: [1, 2, 3, 4, 5].filter(index => entity[`Summon${index}`]).length
		};
	}
	function skills(target) {
		const actor = actorContext();
		return SkillWindow.getUI()
			.getSkills()
			.filter(canExecuteSkill)
			.flatMap(skill => {
				const capability = combatCapability(skill.SKID, skill.level);
				if (!capability) return [];
				const rule = buffRule(skill.SKID);
				const reason =
					remainingCooldown(skill.SKID) > 0
						? '冷却中'
						: skill.spcost > Session.Entity.life.sp
							? 'SP 不足'
							: rule?.hpCost && Session.Entity.life.hp <= rule.hpCost
								? 'HP 不足'
								: rule?.blockedBy?.some(actor.hasStatus)
									? '当前状态无法使用'
									: skillRequirementReason(capability.entry.requires, skill.level, actor) ||
										specialSkillReason(capability.entry, actor, target);
				return [
					{
						id: skill.SKID,
						kind: capability.kind,
						aim: capability.aim,
						radius: capability.radius,
						priority:
							target && !rule
								? combatSkillPriority({ id: skill.SKID, level: skill.level }, target)
								: undefined,
						name: SkillInfo[skill.SKID]?.SkillName || `技能 ${skill.SKID}`,
						loadIcon: callback => {
							const name = SkillInfo[skill.SKID]?.Name;
							if (name) Client.loadFile(`${DB.INTERFACE_PATH}item/${name}.bmp`, callback);
						},
						level: skill.level,
						type: skill.type,
						available: !reason,
						reason
					}
				];
			});
	}
	let ownsAction = false,
		ownedMove = null,
		approachPosition = null;
	function stop() {
		if (!ownsAction) return;
		ownsAction = false;
		const approaching = Boolean(approachPosition);
		approachPosition = null;
		if (Session.moveAction && Session.moveAction !== ownedMove) return;
		ownedMove = null;
		Navigation.stopAutoWalk();
		SkillTargetSelection.remove();
		const chasing = Boolean(Session.moveAction || approaching);
		Commands.stopAttack();
		if (chasing && Session.Playing && Session.Entity && Session.Entity.action !== Session.Entity.ACTION.DIE) {
			Network.sendPacket(new PACKET.CZ.HAPPYRO_STOP_MOVE());
		}
		MapControl.onRequestStopWalk();
		Session.autoFollow = false;
	}
	const controller = createAutoCombatController(
		{
			saveSettings: settings => saveAutoCombatSettings(settingsKey, settings),
			enabled: () =>
				enabled() && !Session.Entity?.isOverWeight && Session.Entity?.action !== Session.Entity?.ACTION.SIT,
			now: () => performance.now(),
			random: Math.random,
			position: () => Session.Entity.position,
			targets,
			skills,
			selfId: () => Session.Entity.GID,
			hasStatus: id => playerStatuses.has(id),
			buff: skill => {
				const current = skills().find(
					entry => entry.id === skill.id && entry.kind === 'buff' && entry.available
				);
				if (!current || playerStatuses.has(buffRule(current.id).status)) return false;
				stop();
				Commands.stopAttack();
				const result = SkillTargetSelection.onUseSkillToId(current.id, current.level, Session.Entity.GID);
				ownsAction = result !== false;
				ownedMove = Session.moveAction;
				return result;
			},
			stop,
			pickupTurn: takeAutomationPickupTurn,
			cancelPickup: cancelAutomationPickup,
			teleport: requestAutoCombatTeleport,
			teleportPending: isAutoCombatTeleportPending,
			teleportBusy: () =>
				Boolean(
					Session.autoFollow ||
					Session.Entity.action === Session.Entity.ACTION.WALK ||
					Session.Entity.action === Session.Entity.ACTION.ATTACK ||
					document.querySelector('#PickupSettings') ||
					document.querySelector('#MobileGameHUD')?.shadowRoot?.querySelector('.backdrop:not([hidden])') ||
					document.activeElement?.matches('input, textarea')
				),
			clearExpiredCast: () => {
				const cast = Session.Entity?.cast;
				if (cast?.display && Date.now() > cast.tick + cast.delay + 1000) cast.remove();
			},
			chasing: () => Boolean(Session.moveAction || approachPosition),
			prepare: (target, skill) => {
				if (skill.aim === 'trap') {
					const occupied = [Session.Entity.position];
					EntityManager.forEach(other => {
						if (other.position && other.action !== other.ACTION?.DIE) occupied.push(other.position);
					});
					skill.position = trapPosition(
						catalog.skills[skill.id],
						skill.level,
						target.position,
						Session.Entity.position,
						occupied,
						cell =>
							cell[0] >= 0 &&
							cell[1] >= 0 &&
							cell[0] < Altitude.width &&
							cell[1] < Altitude.height &&
							Boolean(Altitude.getCellType(cell[0], cell[1]) & Altitude.TYPE.WALKABLE)
					);
					return Boolean(skill.position);
				}
				if (skill.aim !== 'self' || cellDistance(Session.Entity.position, target.position) <= skill.radius) {
					approachPosition = null;
					return true;
				}
				const path = [];
				const count = PathFinding.search(
					Session.Entity.position[0] | 0,
					Session.Entity.position[1] | 0,
					target.position[0] | 0,
					target.position[1] | 0,
					skill.radius,
					path
				);
				if (count < 2) return false;
				const packet = new PACKET.CZ.REQUEST_MOVE2();
				packet.dest[0] = path[(count - 1) * 2];
				packet.dest[1] = path[(count - 1) * 2 + 1];
				Commands.stopAttack();
				Network.sendPacket(packet);
				approachPosition = packet.dest;
				ownsAction = true;
				ownedMove = Session.moveAction;
				return 'approaching';
			},
			busy: () =>
				Boolean(
					Session.moveAction ||
					(approachPosition && Session.Entity.action === Session.Entity.ACTION.WALK) ||
					Session.Entity.cast?.display ||
					Session.Entity.amotionTick > Renderer.tick
				),
			reachable: target =>
				PathFinding.search(
					Session.Entity.position[0] | 0,
					Session.Entity.position[1] | 0,
					target.position[0] | 0,
					target.position[1] | 0,
					1,
					[],
					Altitude.TYPE.WALKABLE
				) > 0,
			select: target => {
				const entity = EntityManager.get(target.id),
					previous = EntityManager.getFocusEntity();
				if (previous && previous !== entity) previous.onFocusEnd();
				EntityManager.setFocusEntity(entity);
				EntityManager.setOverEntity(entity);
				entity.onFocus({ attack: false });
			},
			act: (target, skill) => {
				const entity = EntityManager.get(target.id);
				if (!entity || entity.action === entity.ACTION.DIE || entity.remove_tick > 0) return false;
				if (!skill) {
					Commands.attackSelected(false, () => {
						ownsAction = true;
						ownedMove = Session.moveAction;
					});
					return true;
				}
				const current = skills(target).find(
					entry => entry.id === skill.id && entry.available && entry.priority !== null
				);
				if (!current) return false;
				Commands.stopAttack();
				let result;
				if (current.aim === 'self') {
					if (cellDistance(Session.Entity.position, entity.position) > current.radius) return false;
					result = SkillTargetSelection.onUseSkillToId(current.id, current.level, Session.Entity.GID);
				} else if (current.aim === 'trap') {
					if (!skill.position) return false;
					result = SkillTargetSelection.onUseSkillToPos(current.id, current.level, ...skill.position);
				} else if (current.aim === 'ground')
					result = SkillTargetSelection.onUseSkillToPos(
						current.id,
						current.level,
						entity.position[0],
						entity.position[1]
					);
				else result = SkillTargetSelection.onUseSkillToId(current.id, current.level, target.id);
				ownsAction = result !== false;
				ownedMove = Session.moveAction;
				return result;
			}
		},
		loadAutoCombatSettings(settingsKey)
	);
	return { ...controller, mapSpecies: () => loadAutoCombatMapSpecies(getCurrentAdventureMap()) };
}
