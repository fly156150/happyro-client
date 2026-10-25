import { combatSkillPriority, isOffensiveSupportSkill } from './CombatSkillAffinity.js';
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
import { canExecuteSkill, SKILL_INF } from 'UI/Components/SkillList/SkillUse.js';
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
				position: [...entity.position]
			});
		});
		return result;
	}
	function skills(target) {
		return SkillWindow.getUI()
			.getSkills()
			.filter(
				skill =>
					canExecuteSkill(skill) &&
					(skill.type & (SKILL_INF.ENEMY | SKILL_INF.PLACE) || isOffensiveSupportSkill(skill.SKID))
			)
			.map(skill => {
				const reason =
					remainingCooldown(skill.SKID) > 0
						? '冷却中'
						: skill.spcost > Session.Entity.life.sp
							? 'SP 不足'
							: '';
				return {
					id: skill.SKID,
					priority: target ? combatSkillPriority({ id: skill.SKID, level: skill.level }, target) : undefined,
					name: SkillInfo[skill.SKID]?.SkillName || `技能 ${skill.SKID}`,
					loadIcon: callback => {
						const name = SkillInfo[skill.SKID]?.Name;
						if (name) Client.loadFile(`${DB.INTERFACE_PATH}item/${name}.bmp`, callback);
					},
					level: skill.level,
					type: skill.type,
					available: !reason,
					reason
				};
			});
	}
	let ownsAction = false,
		ownedMove = null;
	function stop() {
		if (!ownsAction) return;
		ownsAction = false;
		if (Session.moveAction && Session.moveAction !== ownedMove) return;
		ownedMove = null;
		Navigation.stopAutoWalk();
		SkillTargetSelection.remove();
		const chasing = Boolean(Session.moveAction);
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
			chasing: () => Boolean(Session.moveAction),
			busy: () =>
				Boolean(
					Session.moveAction || Session.Entity.cast?.display || Session.Entity.amotionTick > Renderer.tick
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
				if (current.type & SKILL_INF.PLACE)
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
