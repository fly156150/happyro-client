import { confirmCompanionAction } from 'UI/Game/CompanionPrompt.js';
import Platform from 'UI/Platform.js';
import { updateGameCompanion } from 'UI/Game/GameCompanions.js';
/**
 * Engine/MapEngine/Mercenary.js
 *
 * Manage mercenary
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

/**
 * Load dependencies
 */
import DB from 'DB/DBManager.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Session from 'Engine/SessionStorage.js';
import EntityManager from 'Renderer/EntityManager.js';
import UIManager from 'UI/UIManager.js';
import MercenaryInformations from 'UI/Components/MercenaryInformations/MercenaryInformations.js';
import SkillListMH from 'UI/Components/SkillListMH/SkillListMH.js';
import Mouse from 'Controls/MouseEventHandler.js';
import StatusProperty from 'DB/Status/StatusProperty.js';

let mercenaryInfo = null;

/**
 * Initialize Mercenary information
 *
 * @param {object} pkt - PACKET.ZC.MER_INIT
 */
function onMercenaryInit(pkt) {
	Session.mercId = pkt.AID;
	mercenaryInfo = { ...pkt, SKPoint: pkt.SKPoint || 0 };
	if (Platform.isMobile) updateGameCompanion('mercenary', pkt, pkt.AID);
	const entity = EntityManager.get(pkt.AID);

	if (entity) {
		entity.attack_range = pkt.ATKRange;
		entity.life.hp = pkt.hp;
		entity.life.hp_max = pkt.maxHP;
		entity.life.sp = pkt.sp;
		entity.life.sp_max = pkt.maxSP;
		entity.life.update();
		EntityManager.storeLife(pkt.AID, {
			hp: pkt.hp,
			hp_max: pkt.maxHP,
			sp: pkt.sp,
			sp_max: pkt.maxSP
		});
	}

	if (entity && entity.life.display) {
		pkt.life = entity.life;
	}

	// Add skill points to the packet
	pkt.SKPoint = pkt.SKPoint || 0;

	if (!Platform.isMobile) MercenaryInformations.append();
	if (!Platform.isMobile) MercenaryInformations.setInformations(mercenaryInfo);
	MercenaryInformations.startAI();
}

/**
 * Update Mercenary information
 *
 * @param {object} pkt - PACKET.ZC.MER_PROPERTY
 */
function onMercenaryProperty(pkt) {
	mercenaryInfo = { ...mercenaryInfo, ...pkt };
	if (Platform.isMobile) updateGameCompanion('mercenary', pkt);
	const entity = EntityManager.get(Session.mercId);

	if (entity) {
		entity.life.hp = pkt.hp;
		entity.life.hp_max = pkt.maxHP;
		entity.life.sp = pkt.sp;
		entity.life.sp_max = pkt.maxSP;
		entity.life.update();
		EntityManager.storeLife(Session.mercId, {
			hp: pkt.hp,
			hp_max: pkt.maxHP,
			sp: pkt.sp,
			sp_max: pkt.maxSP
		});
	}

	if (entity && entity.life.display) {
		pkt.life = entity.life;
	}

	if (!Platform.isMobile) MercenaryInformations.setInformations(mercenaryInfo);
}

/**
 * Update parameter
 *
 * @param {object} pkt - PACKET.ZC.MER_PAR_CHANGE
 */
function onParameterChange(pkt) {
	const key = {
		[StatusProperty.HP]: 'hp',
		[StatusProperty.MAXHP]: 'maxHP',
		[StatusProperty.SP]: 'sp',
		[StatusProperty.MAXSP]: 'maxSP',
		[StatusProperty.ATTPOWER]: 'atk',
		[StatusProperty.MAX_MATTPOWER]: 'Matk',
		[StatusProperty.HITSUCCESSVALUE]: 'hit',
		[StatusProperty.CRITICALSUCCESSVALUE]: 'critical',
		[StatusProperty.ITEMDEFPOWER]: 'def',
		[StatusProperty.MDEFPOWER]: 'Mdef',
		[StatusProperty.BASICAVOIDANCE]: 'flee',
		[StatusProperty.ASPD]: 'aspd',
		[StatusProperty.MER_KILLCOUNT]: 'approval_monster_kill_counter',
		[StatusProperty.MER_FAITH]: 'faith'
	}[pkt.param];
	if (!key) return;
	if (Platform.isMobile) updateGameCompanion('mercenary', { [key]: pkt.value });
	if (mercenaryInfo && mercenaryInfo.AID === Session.mercId) {
		mercenaryInfo[key] = pkt.value;
		if (!Platform.isMobile) MercenaryInformations.setInformations(mercenaryInfo);
	}
	const lifeKey = { hp: 'hp', maxHP: 'hp_max', sp: 'sp', maxSP: 'sp_max' }[key];
	const entity = EntityManager.get(Session.mercId);
	if (entity && lifeKey) {
		entity.life[lifeKey] = pkt.value;
		entity.life.update();
		EntityManager.storeLife(Session.mercId, { [lifeKey]: pkt.value });
	}
}

/**
 * Get mercenary skills
 *
 * @param {object} pkt - PACKET.ZC.MER_SKILLINFO_LIST
 */
function onSkillList(pkt) {
	SkillListMH.mercenary.setSkills(pkt.skillList);
}

/**
 * Update skill
 *
 * @param {object} pkt - PACKET.ZC.MER_SKILLINFO_UPDATE
 */
function onSkillUpdate(pkt) {
	SkillListMH.mercenary.updateSkill(pkt);
}

/**
 * Request to delete mercenary
 */
MercenaryInformations.reqDeleteMercenary = function reqDeleteMercenary() {
	confirmCompanionAction('mercenary', DB.getMessage(356), function () {
		const pkt = new PACKET.CZ.MER_COMMAND();
		pkt.command = 2;
		Network.sendPacket(pkt);
		MercenaryInformations.ui.hide();
		SkillListMH.mercenary.ui.hide();
	});
};

/**
 * Request to move mercenary to owner
 */
MercenaryInformations.reqMoveToOwner = function reqMoveToOwner(gid) {
	const pkt = new PACKET.CZ.REQUEST_MOVETOOWNER();
	pkt.GID = gid;
	Network.sendPacket(pkt);
};

/**
 * Request mercenary to attack target
 */
MercenaryInformations.reqAttack = function reqAttack(GID, targetGID) {
	const pkt = new PACKET.CZ.REQUEST_ACTNPC();
	pkt.GID = GID;
	pkt.targetGID = targetGID;
	pkt.action = 0;
	Network.sendPacket(pkt);
};

/**
 * Request mercenary to move to location
 */
MercenaryInformations.reqMoveTo = function reqMoveTo(GID, x = 0, y = 0) {
	const pkt = new PACKET.CZ.REQUEST_MOVENPC();
	pkt.GID = GID;
	pkt.dest[0] = x > 0 ? x : Mouse.world.x;
	pkt.dest[1] = y > 0 ? y : Mouse.world.y;
	Network.sendPacket(pkt);
};

/**
 * Initialize
 */
export default function MercenaryEngine() {
	mercenaryInfo = null;
	Network.hookPacket(PACKET.ZC.MER_INIT, onMercenaryInit);
	Network.hookPacket(PACKET.ZC.MER_PROPERTY, onMercenaryProperty);
	Network.hookPacket(PACKET.ZC.MER_PAR_CHANGE, onParameterChange);
	Network.hookPacket(PACKET.ZC.MER_SKILLINFO_LIST, onSkillList);
	Network.hookPacket(PACKET.ZC.MER_SKILLINFO_UPDATE, onSkillUpdate);
}
