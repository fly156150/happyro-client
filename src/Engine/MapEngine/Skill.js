import { openMonsterInformation } from 'UI/Game/GameMonsterInformation.js';
import Platform from 'UI/Platform.js';
import { openGameSelection, selectionEntries } from 'UI/Game/GameSelection.js';
/**
 * Engine/MapEngine/Skill.js
 *
 * Manage skills
 *
 * @author Vincent Thibault
 */

/**
 * Load dependencies
 */
import { isServantWeaponJob, servantWeaponEffectIds } from 'DB/Skills/ServantWeaponEffects.js';
import DB from 'DB/DBManager.js';
import UIManager from 'UI/UIManager.js';
import SkillId from 'DB/Skills/SkillConst.js';
import SkillInfo from 'DB/Skills/SkillInfo.generated.js';
import EffectConst from 'DB/Effects/EffectConst.js';
import PathFinding from 'Utils/PathFinding.js';
import Session from 'Engine/SessionStorage.js';
import Network from 'Network/NetworkManager.js';
import PACKETVER from 'Network/PacketVerManager.js';
import PACKET from 'Network/PacketStructure.js';
import EntityManager from 'Renderer/EntityManager.js';
import EffectManager from 'Renderer/EffectManager.js';
import Altitude from 'Renderer/Map/Altitude.js';
import ShortCut from 'UI/Components/ShortCut/ShortCut.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';
import SkillTargetSelection from 'UI/Components/SkillTargetSelection/SkillTargetSelection.js';
import Guild from 'UI/Components/Guild/Guild.js';
import SkillListMH from 'UI/Components/SkillListMH/SkillListMH.js';
import ItemSelection from 'UI/Components/ItemSelection/ItemSelection.js';
import MakeArrowSelection from 'UI/Components/MakeArrowSelection/MakeArrowSelection.js';
import RefineWeaponSelection from 'UI/Components/RefineWeaponSelection/RefineWeaponSelection.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import NpcMenu from 'UI/Components/NpcMenu/NpcMenu.js';
import Sense from 'UI/Components/Sense/Sense.js';
import Announce from 'UI/Components/Announce/Announce.js';
import Renderer from 'Renderer/Renderer.js';
import SkillWindow from 'UI/Components/SkillList/SkillList.js';
import CartDecoration from 'UI/Components/CartDecoration/CartDecoration.js';
import { showToast } from 'UI/Components/Toast.js';
import { isEmotionFailure, skillFailMessage } from './SkillFail.js';
import { cancelCompanionSkill, queueCompanionSkill } from './CompanionSkillAction.js';

import SnowWeatherEffect from 'Renderer/Effects/SnowWeather.js';
import RainWeatherEffect from 'Renderer/Effects/RainWeather.js';
import PokJukWeatherEffect from 'Renderer/Effects/PokJukWeatherEffect.js';
import SakuraWeatherEffect from 'Renderer/Effects/SakuraWeatherEffect.js';
import CloudWeatherEffect from 'Renderer/Effects/CloudWeatherEffect.js';

/**
 * Spam an effect
 *
 * 0 = base level up
 * 1 = job level up
 * 2 = refine failure
 * 3 = refine success
 * 4 = game over
 * 5 = pharmacy success
 * 6 = pharmacy failure
 * 7 = base level up (super novice)
 * 8 = job level up (super novice)
 * 9 = base level up (taekwon)
 *
 * @param {object} pkt - PACKET.ZC.NOTIFY_EFFECT
 */
function onSpecialEffect(pkt) {
	const EnumEffect = [
		EffectConst.EF_ANGEL,
		EffectConst.EF_JOBLVUP,
		EffectConst.EF_REFINEFAIL,
		EffectConst.EF_REFINEOK,
		EffectConst.NONE, // game over
		EffectConst.EF_PHARMACY_OK,
		EffectConst.EF_PHARMACY_FAIL,
		EffectConst.EF_ANGEL2,
		EffectConst.EF_JOBLVUP2,
		EffectConst.EF_ANGEL3
	];

	if (EnumEffect[pkt.effectID] > -1) {
		const EF_Init_Par = {
			effectId: EnumEffect[pkt.effectID],
			ownerAID: pkt.AID
		};

		EffectManager.spam(EF_Init_Par);
	}
}

/**
 * Spam an effect
 *
 * @param {object} pkt - PACKET.ZC.NOTIFY_EFFECT2
 */
function onEffect(pkt) {
	// Weather toggles: some servers use NOTIFY_EFFECT3 with numdata=0 to stop. rAthena don't send it as default.
	if (typeof pkt.numdata !== 'undefined') {
		if (pkt.effectID === EffectConst.EF_SNOW) {
			if (pkt.numdata <= 0) {
				SnowWeatherEffect.stop(pkt.AID, Renderer.tick);
				return;
			}
		} else if (pkt.effectID === EffectConst.EF_RAIN) {
			if (pkt.numdata <= 0) {
				RainWeatherEffect.stop(pkt.AID, Renderer.tick);
				return;
			}
		} else if (pkt.effectID === EffectConst.EF_POKJUK) {
			if (pkt.numdata <= 0) {
				PokJukWeatherEffect.stop(pkt.AID, Renderer.tick);
				return;
			}
		} else if (pkt.effectID === EffectConst.EF_MAPLE || pkt.effectID === EffectConst.EF_SAKURA) {
			if (pkt.numdata <= 0) {
				SakuraWeatherEffect.stop(pkt.AID, Renderer.tick);
				return;
			}
		} else if (pkt.effectID === EffectConst.EF_CLOUD || pkt.effectID === EffectConst.EF_CLOUD2) {
			if (pkt.numdata <= 0) {
				CloudWeatherEffect.stop(pkt.AID, Renderer.tick);
				return;
			}
		}
	}

	const EF_Init_Par = {
		effectId: pkt.effectID,
		ownerAID: pkt.AID
	};

	EffectManager.spam(EF_Init_Par);
}

/**
 * Display an effect to the scene
 *
 * @param {object} pkt - PACKET.ZC.NOTIFY_GROUNDSKILL
 */
function onSkillToGround(pkt) {
	const position = new Array(3);
	position[0] = pkt.xPos;
	position[1] = pkt.yPos;
	position[2] = Altitude.getCellHeight(pkt.xPos, pkt.yPos);

	EffectManager.spamSkill(pkt.SKID, pkt.AID, position, null, pkt.AID);
}

/**
 * Failed to cast a skill
 *
 * @param {object} pkt - PACKET.ZC.ACK_TOUSESKILL
 */
function onSkillResult(pkt) {
	// Yeah success !
	if (pkt.result) {
		return;
	}

	const text = skillFailMessage(pkt, {
		skillName: id => SkillInfo[id]?.SkillName,
		itemName: id => DB.getItemInfo(id)?.identifiedDisplayName
	});
	ChatBox.addText(text, ChatBox.TYPE.ERROR, ChatBox.FILTER.SKILL_FAIL);
	if (isEmotionFailure(pkt)) showToast(document.body, text, 'error');
}

/**
 * List of skills
 *
 * @param {object} pkt - PACKET_ZC_SKILLINFO_LIST
 */
function onSkillList(pkt) {
	SkillWindow.getUI().setSkills(pkt.skillList);
}

/**
 * Update a specified skill
 *
 * @param {object} pkt - PACKET.ZC.SKILLINFO_UPDATE
 */
function onSkillUpdate(pkt) {
	SkillWindow.getUI().updateSkill(pkt);
}

/**
 * List of skills/items in hotkey
 *
 * @param {object} pkt - PACKET_ZC_SHORTCUT_KEY_LIST_V2
 */
function onShortCutList(pkt) {
	if (pkt.tab && pkt.tab > 0) {
		return;
	} // not available yet
	ShortCut.setList(pkt.ShortCutKey);
}

/**
 * Add new skill to the list
 *
 * @param {object} pkt - PACKET.ZC.ADD_SKILL
 */
function onSkillAdded(pkt) {
	SkillWindow.getUI().addSkill(pkt.data);
}

/**
 * Server notify use that we need to cast a skill
 *
 * @param {object} pkt - PACKET.ZC.AUTORUN_SKILL
 */
function onAutoCastSkill(pkt) {
	SkillWindow.getUI().useSkill(pkt.data);
}

/**
 * Get a list of item to identify
 *
 * @param {object} pkt - PACKET.ZC.ITEMIDENTIFY_LIST
 */
function onIdentifyList(pkt) {
	if (!pkt.ITIDList.length) {
		showToast(document.body, '没有需要鉴定的物品', 'info');
		return;
	}

	ItemSelection.onIndexSelected = function (index) {
		if (index >= -1) {
			const _pkt = new PACKET.CZ.REQ_ITEMIDENTIFY();
			_pkt.index = index;
			Network.sendPacket(_pkt);
		}
	};

	if (Platform.isMobile) {
		openGameSelection('鉴定物品', selectionEntries(pkt.ITIDList, 'inventory'), ItemSelection.onIndexSelected, () =>
			ItemSelection.onIndexSelected(-1)
		);
		return;
	}
	ItemSelection.append();
	ItemSelection.setList(pkt.ITIDList);
	ItemSelection.setTitle(DB.getMessage(521));
}

/**
 * Get the result once item identified
 *
 * @param {object} pkt - PACKET.ZC.ACK_ITEMIDENTIFY
 */
function onIdentifyResult(pkt) {
	// Self closed, no message.
	if (pkt.index < 0) {
		return;
	}

	switch (pkt.result) {
		case 0: {
			// success
			ChatBox.addText(DB.getMessage(491), ChatBox.TYPE.BLUE, ChatBox.FILTER.ITEM);

			// Remove old item
			const item = Inventory.getUI().removeItem(pkt.index, 1);

			// Add new item updated
			if (item) {
				item.IsIdentified = true;
				Inventory.getUI().addItem(item);
			}
			break;
		}
		case 1: // Fail
			ChatBox.addText(DB.getMessage(492), ChatBox.TYPE.ERROR, ChatBox.FILTER.ITEM);
			break;
	}
}

/**
 * Get a list of skills to use for auto-spell
 *
 * @param {object} pkt - PACKET.ZC.AUTOSPELLLIST
 */
function onAutoSpellList(pkt) {
	if (!pkt.SKID.length) {
		showToast(document.body, '没有可选择的技能', 'info');
		return;
	}

	ItemSelection.onIndexSelected = function (index) {
		if (index >= -1) {
			const _pkt = new PACKET.CZ.SELECTAUTOSPELL();
			_pkt.SKID = index;
			Network.sendPacket(_pkt);
		}
	};

	if (Platform.isMobile) {
		openGameSelection('自动技能', selectionEntries(pkt.SKID, 'skill'), ItemSelection.onIndexSelected, () =>
			ItemSelection.onIndexSelected(-1)
		);
		return;
	}
	ItemSelection.append();
	ItemSelection.setList(pkt.SKID, true);
	ItemSelection.setTitle(DB.getMessage(697));
}

/**
 * Get a list of players under the effect of devotion
 *
 * @param {object} pkt - PACKET.ZC.DEVOTIONLIST
 */
function onDevotionList(pkt) {
	EffectManager.remove(null, pkt.myAID, EffectConst.EF_LINELINK);

	pkt.AID.forEach(tgtAID => {
		if (tgtAID > 0) {
			const EF_Init_Par = {
				effectId: EffectConst.EF_LINELINK,
				ownerAID: pkt.myAID,
				otherAID: tgtAID,
				persistent: true
			};

			EffectManager.spam(EF_Init_Par);
		}
	});
}

/**
 * Get a list of skills to use for auto-spell
 *
 * @param {object} pkt - PACKET.ZC.SKILL_SELECT_REQUEST
 */
function onSelectSkillList(pkt) {
	if (!pkt.SKID.length) {
		showToast(document.body, '没有可选择的技能', 'info');
		return;
	}

	ItemSelection.onIndexSelected = index => {
		if (index >= -1) {
			const _pkt = new PACKET.CZ.SKILL_SELECT_RESPONSE();
			_pkt.SKID = index;
			_pkt.why = 0; // Currently unused on server side (clif_parse_SkillSelectMenu)
			Network.sendPacket(_pkt);
		}
	};

	if (Platform.isMobile) {
		openGameSelection('选择技能', selectionEntries(pkt.SKID, 'skill'), ItemSelection.onIndexSelected, () =>
			ItemSelection.onIndexSelected(-1)
		);
		return;
	}
	ItemSelection.append();
	ItemSelection.setList(pkt.SKID, true);
	ItemSelection.setTitle(DB.getMessage(697));
}

/**
 * Manage menu to select zone to warp on
 *
 * @param {object} pkt - PACKET.ZC.WARPLIST
 */
function onTeleportList(pkt) {
	if (Platform.isMobile) {
		const send = mapName => {
			const response = new PACKET.CZ.SELECT_WARPPOINT();
			response.SKID = pkt.SKID;
			response.mapName = mapName;
			Network.sendPacket(response);
		};
		const entries = pkt.mapName
			.map((name, index) => ({ id: index, name: DB.getMapName(name, name) }))
			.filter(entry => pkt.mapName[entry.id]);
		openGameSelection(
			'选择传送地点',
			entries,
			index => send(pkt.mapName[index]),
			() => send('cancel')
		);
		return;
	}

	// Once selected
	NpcMenu.onSelectMenu = (skillid, index) => {
		NpcMenu.remove();

		const _pkt = new PACKET.CZ.SELECT_WARPPOINT();
		_pkt.SKID = skillid;
		_pkt.mapName = pkt.mapName[index - 1] || 'cancel';
		Network.sendPacket(_pkt);
	};

	NpcMenu.onAppend = () => {
		const mapNames = [];

		for (let i = 0, count = pkt.mapName.length; i < count; ++i) {
			mapNames[i] = DB.getMapName(pkt.mapName[i], pkt.mapName[i]);
		}

		NpcMenu.setMenu(mapNames.join(':') + ':Cancel', pkt.SKID);
		NpcMenu.ui.find('.title').text(DB.getMessage(213));
	};

	NpcMenu.append();
}

/**
 * Get error message from teleportation skill
 *
 * @param {object} pkt - PACKET.ZC.NOTIFY_MAPINFO
 */
function onTeleportResult(pkt) {
	switch (pkt.type) {
		case 0: //Unable to Teleport in this area
			ChatBox.addText(DB.getMessage(500), ChatBox.TYPE.ERROR, ChatBox.FILTER.SKILL_FAIL);
			break;

		case 1: //Saved point cannot be memorized.
			ChatBox.addText(DB.getMessage(501), ChatBox.TYPE.ERROR, ChatBox.FILTER.SKILL_FAIL);
			break;
	}
}

/**
 * Result of /memo command
 *
 * @param {object} pkt - PACKET.ZC.ACK_REMEMBER_WARPPOINT
 */
function onMemoResult(pkt) {
	switch (pkt.errorCode) {
		case 0: // Saved location as a Memo Point for Warp skill.
			ChatBox.addText(DB.getMessage(217), ChatBox.TYPE.BLUE, ChatBox.FILTER.PUBLIC_LOG);
			break;

		case 1: // Skill Level is not high enough.
			ChatBox.addText(DB.getMessage(214), ChatBox.TYPE.ERROR, ChatBox.FILTER.SKILL_FAIL);
			break;

		case 2: // You haven't learned Warp.
			ChatBox.addText(DB.getMessage(216), ChatBox.TYPE.ERROR, ChatBox.FILTER.SKILL_FAIL);
			break;
	}
}

/**
 * Get a list of arrows to create
 *
 * @param {object} pkt - PACKET.ZC.MAKINGARROW_LIST
 */
function onMakingarrowList(pkt) {
	if (!pkt.arrowList.length) {
		showToast(document.body, '没有可制作的箭矢', 'info');
		return;
	}

	MakeArrowSelection.onIndexSelected = function (index) {
		if (index >= -1) {
			const _pkt = new PACKET.CZ.REQ_MAKINGARROW();
			_pkt.id = index;
			Network.sendPacket(_pkt);
		}
	};

	if (Platform.isMobile) {
		openGameSelection(
			'制作箭矢',
			selectionEntries(
				pkt.arrowList.map(item => item.index),
				'item'
			),
			MakeArrowSelection.onIndexSelected,
			() => MakeArrowSelection.onIndexSelected(-1)
		);
		return;
	}
	MakeArrowSelection.append();
	MakeArrowSelection.setList(pkt.arrowList);
	//MakeArrowSelection.setTitle(DB.getMessage(658));
	MakeArrowSelection.setTitle('LIST');
}

/**
 * Get a list of items to refine
 *
 * @param {object} pkt - PACKET.ZC.NOTIFY_WEAPONITEMLIST
 */
function onRefineList(pkt) {
	if (!pkt.itemList.length) {
		showToast(document.body, '没有可精炼的装备', 'info');
		return;
	}

	RefineWeaponSelection.onIndexSelected = index => {
		if (index >= -1) {
			const _pkt = new PACKET.CZ.REQ_WEAPONREFINE();
			_pkt.Index = index;
			Network.sendPacket(_pkt);
		}
	};

	if (Platform.isMobile) {
		openGameSelection(
			'精炼武器',
			selectionEntries(
				pkt.itemList.map(item => item.index),
				'inventory'
			),
			RefineWeaponSelection.onIndexSelected,
			() => RefineWeaponSelection.onIndexSelected(-1),
			'精炼可能导致装备损坏，请核对后确认'
		);
		return;
	}
	RefineWeaponSelection.append();
	RefineWeaponSelection.setList(pkt.itemList);
	RefineWeaponSelection.setTitle(DB.getMessage(910));
}

/**
 * Get a list of items to repair
 *
 * @param {object} pkt - PACKET.ZC.REPAIRITEMLIST
 */
function onRepairList(pkt) {
	if (!pkt.itemList.length) {
		showToast(document.body, '没有需要修理的装备', 'info');
		return;
	}

	RefineWeaponSelection.onIndexSelected = index => {
		if (index >= -1) {
			const item = Platform.isMobile
				? pkt.itemList.find(entry => entry.index === index)
				: RefineWeaponSelection.getItemByIndex(index);

			const _pkt = new PACKET.CZ.REQ_ITEMREPAIR();
			_pkt.index = index;
			_pkt.itemId = item?.ITID || 0;
			_pkt.RefiningLevel = item?.RefiningLevel || 0;
			if (item) _pkt.slots = item.slot;
			Network.sendPacket(_pkt);
		}
	};

	if (Platform.isMobile) {
		openGameSelection(
			'修理装备',
			selectionEntries(pkt.itemList, 'equipment'),
			RefineWeaponSelection.onIndexSelected,
			() => RefineWeaponSelection.onIndexSelected(-1)
		);
		return;
	}
	RefineWeaponSelection.append();
	RefineWeaponSelection.setList(pkt.itemList);
	RefineWeaponSelection.setTitle(DB.getMessage(812));
}

/**
 * Send back informations from server
 * The user want to modify the shortcut
 *
 * @param {number} shortcut index
 * @param {boolean|number} isSkill
 * @param {number} ID
 * @param {number} count / level
 */
ShortCut.onChange = function onChange(index, isSkill, ID, count) {
	let pkt;
	if (PACKETVER.value >= 20190522) {
		pkt = new PACKET.CZ.SHORTCUT_KEY_CHANGE2();
	} else {
		pkt = new PACKET.CZ.SHORTCUT_KEY_CHANGE1();
	}
	pkt.Index = index;
	pkt.ShortCutKey.isSkill = isSkill ? 1 : 0;
	pkt.ShortCutKey.ID = ID;
	pkt.ShortCutKey.count = count;

	Network.sendPacket(pkt);
};

function onSetSkillDelay(pkt) {
	ShortCut.setSkillDelay(pkt.SKID, pkt.DelayTM);
}

/**
 * User want to level up a skill
 *
 * @param {number} skill id
 */
function onIncreaseSkill(SKID) {
	const pkt = new PACKET.CZ.UPGRADE_SKILLLEVEL();
	pkt.SKID = SKID;

	Network.sendPacket(pkt);
}
Guild.onIncreaseSkill =
	SkillListMH.homunculus.onIncreaseSkill =
	SkillListMH.mercenary.onIncreaseSkill =
		onIncreaseSkill;

const queuedTargetSkills = new WeakMap();

/** Re-evaluate a queued targeted cast after walking, rather than send a stale request. */
export function resumeQueuedTargetSkill(packet) {
	const queued = queuedTargetSkills.get(packet);
	if (!queued) return false;
	queuedTargetSkills.delete(packet);
	const { caster, target } = queued;
	if (
		!Session.Playing ||
		Session.Entity !== caster ||
		caster.action === caster.ACTION.DIE ||
		EntityManager.get(target.GID) !== target ||
		(target.action === target.ACTION.DIE && packet.SKID !== SkillId.ALL_RESURRECTION) ||
		target.remove_tick > 0
	)
		return true;
	// onUseSkill searches from the current positions and queues a fresh walk if needed.
	onUseSkill(packet.SKID, packet.selectedLevel, packet.targetID);
	return true;
}

/**
 * Cast a skill on someone
 *
 * @param {number} skill id
 * @param {number} level
 * @param {optional|number} target game id
 */
function onUseSkill(id, level, targetID, { allowMove = true } = {}) {
	let entity;
	let range;

	const isHomun = id > SkillId.HOMUN_BEGIN && id < SkillId.HOMUN_LAST;
	const isMerc = id > SkillId.MERCENARY_BEGIN && id < SkillId.MERCENARY_LAST;

	// Not used so far
	//var isElem = (id > SkillId.ELEMENTAL_BEGIN && id < SkillId.ELEMENTAL_LAST);

	if (isHomun) {
		entity = EntityManager.get(Session.homunId);
	} else if (isMerc) {
		entity = EntityManager.get(Session.mercId);
	} else {
		entity = Session.Entity;
		//Fixme: this check is needed, but not here, because flywing and other AUTORUN_SKILL then doesn't work
		/*if(entity.isOverWeight){
				ChatBox.addText( DB.getMessage(243), ChatBox.TYPE.ERROR, ChatBox.FILTER.SKILL_FAIL);
				return true;
			}*/
	}

	// Client side minimum delay
	if (!entity || entity.amotionTick > Renderer.tick) {
		// Can't spam skills faster than amotion
		return;
	}

	const target = EntityManager.get(targetID) || entity;
	const skill = isHomun
		? SkillListMH.homunculus.getSkillById(id)
		: isMerc
			? SkillListMH.mercenary.getSkillById(id)
			: SkillWindow.getUI().getSkillById(id);
	const out = [];
	if (isHomun || isMerc) cancelCompanionSkill(entity);

	if (skill) {
		range = skill.attackRange + 1;
	} else if (SkillInfo[id]) {
		range = SkillInfo[id].AttackRange[level - 1] + 1;
	} else {
		range = entity.attack_range;
	}

	const count = PathFinding.search(
		entity.position[0] | 0,
		entity.position[1] | 0,
		target.position[0] | 0,
		target.position[1] | 0,
		range,
		out,
		Altitude.TYPE.WALKABLE
	);

	// A held touch joystick owns movement; do not auto-chase its skill target.
	if (!count || (!allowMove && count >= 2)) {
		return false;
	}

	if (id === SkillId.MC_CHANGECART) {
		if (Session.Entity.hasCart == true) {
			UIManager.getComponent('ChangeCart').onChangeCartSkill();
		}
	}
	let pkt;
	if (PACKETVER.value >= 20180307) {
		pkt = new PACKET.CZ.USE_SKILL2();
	} else {
		pkt = new PACKET.CZ.USE_SKILL();
	}
	pkt.SKID = id;
	pkt.selectedLevel = level;
	pkt.targetID = targetID || entity.GID;

	// In range
	if (count < 2 || target === entity) {
		Network.sendPacket(pkt);
		return;
	}

	// Keep pending casts with the entity that is actually moving.
	if (isHomun || isMerc) {
		queueCompanionSkill(
			entity,
			pkt,
			out.slice((count - 1) * 2, count * 2),
			() =>
				EntityManager.get(target.GID) === target &&
				target.action !== target.ACTION.DIE &&
				PathFinding.search(
					entity.position[0] | 0,
					entity.position[1] | 0,
					target.position[0] | 0,
					target.position[1] | 0,
					range,
					[],
					Altitude.TYPE.WALKABLE
				) === 1
		);
	} else {
		queuedTargetSkills.set(pkt, { caster: entity, target });
		Session.moveAction = pkt;
	}

	// Move to position
	if (isHomun) {
		pkt = new PACKET.CZ.REQUEST_MOVENPC();
		pkt.GID = Session.homunId;
	} else if (isMerc) {
		pkt = new PACKET.CZ.REQUEST_MOVENPC();
		pkt.GID = Session.mercId;
	} else {
		if (PACKETVER.value >= 20180307) {
			pkt = new PACKET.CZ.REQUEST_MOVE2();
		} else {
			pkt = new PACKET.CZ.REQUEST_MOVE();
		}
	}
	pkt.dest[0] = out[(count - 1) * 2 + 0];
	pkt.dest[1] = out[(count - 1) * 2 + 1];
	Network.sendPacket(pkt);
}
Guild.onUseSkill =
	SkillListMH.homunculus.onUseSkill =
	SkillListMH.mercenary.onUseSkill =
	SkillTargetSelection.onUseSkillToId =
		onUseSkill;

/**
 * Cast a skill on the ground
 *
 * @param {number} skill id
 * @param {number} level
 * @param {number} position x
 * @param {number} position y
 */
SkillTargetSelection.onUseSkillToPos = function onUseSkillToPos(id, level, x, y) {
	let entity;
	let range;

	const isHomun = id > SkillId.HOMUN_BEGIN && id < SkillId.HOMUN_LAST;
	const isMerc = id > SkillId.MERCENARY_BEGIN && id < SkillId.MERCENARY_LAST;

	if (isHomun) {
		entity = EntityManager.get(Session.homunId);
	} else if (isMerc) {
		entity = EntityManager.get(Session.mercId);
	} else {
		entity = Session.Entity;
		if (entity?.isOverWeight) {
			ChatBox.addText(DB.getMessage(243), ChatBox.TYPE.ERROR, ChatBox.FILTER.SKILL_FAIL);
			return true;
		}
	}

	// Client side minimum delay
	if (!entity || entity.amotionTick > Renderer.tick) {
		// Can't spam skills faster than amotion
		return;
	}

	const pos = entity.position;
	const skill = isHomun
		? SkillListMH.homunculus.getSkillById(id)
		: isMerc
			? SkillListMH.mercenary.getSkillById(id)
			: SkillWindow.getUI().getSkillById(id);
	const out = [];
	if (isHomun || isMerc) cancelCompanionSkill(entity);

	if (skill) {
		range = skill.attackRange + 1;
	} else if (SkillInfo[id]) {
		range = SkillInfo[id].AttackRange[level - 1] + 1;
	} else {
		range = entity.attack_range;
	}

	const count = PathFinding.search(pos[0] | 0, pos[1] | 0, x | 0, y | 0, range, out, Altitude.TYPE.WALKABLE);

	// Can't attack to this point
	if (!count) {
		return;
	}
	let pkt;
	if (PACKETVER.value >= 20190904) {
		pkt = new PACKET.CZ.USE_SKILL_TOGROUND3();
	} else if (PACKETVER.value >= 20180307) {
		pkt = new PACKET.CZ.USE_SKILL_TOGROUND2();
	} else {
		pkt = new PACKET.CZ.USE_SKILL_TOGROUND();
	}
	pkt.SKID = id;
	pkt.selectedLevel = level;
	pkt.xPos = x;
	pkt.yPos = y;

	//This is how the client knows the magic ring size for self..
	Session.Entity.lastSKID = id;
	Session.Entity.lastSkLvl = level;

	// In range
	if (count < 2) {
		Network.sendPacket(pkt);
		return;
	}

	// Keep pending casts with the entity that is actually moving.
	if (isHomun || isMerc) {
		queueCompanionSkill(
			entity,
			pkt,
			out.slice((count - 1) * 2, count * 2),
			() =>
				PathFinding.search(
					entity.position[0] | 0,
					entity.position[1] | 0,
					x | 0,
					y | 0,
					range,
					[],
					Altitude.TYPE.WALKABLE
				) === 1
		);
	} else {
		Session.moveAction = pkt;
	}

	// Move to the position
	if (isHomun) {
		pkt = new PACKET.CZ.REQUEST_MOVENPC();
		pkt.GID = Session.homunId;
	} else if (isMerc) {
		pkt = new PACKET.CZ.REQUEST_MOVENPC();
		pkt.GID = Session.mercId;
	} else {
		if (PACKETVER.value >= 20180307) {
			pkt = new PACKET.CZ.REQUEST_MOVE2();
		} else {
			pkt = new PACKET.CZ.REQUEST_MOVE();
		}
	}
	pkt.dest[0] = out[(count - 1) * 2 + 0];
	pkt.dest[1] = out[(count - 1) * 2 + 1];
	Network.sendPacket(pkt);
};

function onSpiritSphere(pkt) {
	EffectManager.remove(null, pkt.AID, [228, 504, 629, 833]);
	EffectManager.remove(null, pkt.AID, servantWeaponEffectIds);
	const owner = EntityManager.get(pkt.AID);
	if (owner && isServantWeaponJob(owner._job)) {
		const count = Math.max(0, Math.min(servantWeaponEffectIds.length, pkt.num));
		for (let index = 0; index < count; index++) {
			EffectManager.spam({ effectId: servantWeaponEffectIds[index], ownerAID: pkt.AID, startTick: Renderer.tick });
		}
		return;
	}

	if (pkt.num > 0) {
		const entity = EntityManager.get(pkt.AID);
		if (entity) {
			const EF_Init_Par = {
				effectId: EffectConst.EF_CHOOKGI,
				ownerAID: pkt.AID,
				spiritNum: pkt.num
			};

			if (DB.isMonk(entity._job)) {
				EF_Init_Par.effectId = EffectConst.EF_CHOOKGI2;
			} else if (DB.isGunslinger(entity._job)) {
				EF_Init_Par.effectId = EffectConst.EF_CHOOKGI3;
			} else if (DB.isRoyalGuard(entity._job)) {
				EF_Init_Par.effectId = EffectConst.EF_CHOOKGI_N;
			}

			EffectManager.spam(EF_Init_Par);
		}
	}
}

/**
 * Millennium Shield visual effect
 *
 * @param {object} pkt - PACKET.ZC.MILLENNIUMSHIELD
 */
function onMillenniumShield(pkt) {
	// Remove existing millennium shield effects
	EffectManager.remove(null, pkt.AID, [749]);

	// The server sends state=0; the shield count determines whether to show the effect.
	if (pkt.num > 0) {
		const entity = EntityManager.get(pkt.AID);
		if (entity) {
			const EF_Init_Par = {
				effectId: EffectConst.EF_MILSHIELD_STR,
				ownerAID: pkt.AID
			};

			EffectManager.spam(EF_Init_Par);
		}
	}
}

function onTaekwonMission(pkt) {
	const total = 100;
	let message = DB.getMessage(927);
	const percent = Math.floor((pkt.star / total) * 100);
	const color = '#F8F8FF'; //GhostWhite

	message = message.replace('%s', pkt.monsterName);
	message = message.replace('%d%', percent);

	ChatBox.addText(message, ChatBox.TYPE.ANNOUNCE, ChatBox.FILTER.PUBLIC_LOG, color);
	Announce.append();
	Announce.set(message, color);
}

function onMessageSkill(pkt) {
	let message = DB.getMessage(pkt.MSGID);
	const color = '#B8BEEB';
	const name = SkillInfo[pkt.SKID].SkillName;
	message = `[${name}] ${message}`;

	ChatBox.addText(message, ChatBox.TYPE.ANNOUNCE, ChatBox.FILTER.PUBLIC_LOG, color);
}

function onSense(pkt) {
	if (Platform.isMobile) {
		openMonsterInformation(pkt);
		return;
	}
	Sense.append();
	Sense.setWindow(pkt);
}

function hookSkillWindow() {
	SkillWindow.getUI().onIncreaseSkill = onIncreaseSkill;
	SkillWindow.getUI().onUseSkill = onUseSkill;
}

/**
 * Initialize
 */
export default function SkillEngine() {
	hookSkillWindow();

	Network.hookPacket(PACKET.ZC.SKILLINFO_LIST, onSkillList);
	Network.hookPacket(PACKET.ZC.SKILLINFO_LIST2, onSkillList);
	Network.hookPacket(PACKET.ZC.SKILLINFO_UPDATE, onSkillUpdate);
	Network.hookPacket(PACKET.ZC.SKILLINFO_UPDATE2, onSkillUpdate);
	Network.hookPacket(PACKET.ZC.SKILLINFO_UPDATE3, onSkillUpdate);
	Network.hookPacket(PACKET.ZC.ADD_SKILL, onSkillAdded);
	Network.hookPacket(PACKET.ZC.ADD_SKILL2, onSkillAdded);
	Network.hookPacket(PACKET.ZC.ADD_SKILL3, onSkillAdded);
	Network.hookPacket(PACKET.ZC.SHORTCUT_KEY_LIST, onShortCutList);
	Network.hookPacket(PACKET.ZC.SHORTCUT_KEY_LIST_V2, onShortCutList);
	Network.hookPacket(PACKET.ZC.SHORTCUT_KEY_LIST_V3, onShortCutList);
	Network.hookPacket(PACKET.ZC.SHORTCUT_KEY_LIST_V4, onShortCutList);
	Network.hookPacket(PACKET.ZC.ACK_TOUSESKILL, onSkillResult);
	Network.hookPacket(PACKET.ZC.NOTIFY_EFFECT, onSpecialEffect);
	Network.hookPacket(PACKET.ZC.NOTIFY_EFFECT2, onEffect);
	Network.hookPacket(PACKET.ZC.NOTIFY_EFFECT3, onEffect);
	Network.hookPacket(PACKET.ZC.NOTIFY_GROUNDSKILL, onSkillToGround);
	Network.hookPacket(PACKET.ZC.SKILL_SCALE, onSkillToGround);
	Network.hookPacket(PACKET.ZC.AUTORUN_SKILL, onAutoCastSkill);
	Network.hookPacket(PACKET.ZC.ITEMIDENTIFY_LIST, onIdentifyList);
	Network.hookPacket(PACKET.ZC.ACK_ITEMIDENTIFY, onIdentifyResult);
	Network.hookPacket(PACKET.ZC.AUTOSPELLLIST, onAutoSpellList);
	Network.hookPacket(PACKET.ZC.AUTOSPELLLIST2, onAutoSpellList);
	Network.hookPacket(PACKET.ZC.SKILL_SELECT_REQUEST, onSelectSkillList);
	Network.hookPacket(PACKET.ZC.WARPLIST, onTeleportList);
	Network.hookPacket(PACKET.ZC.WARPLIST2, onTeleportList);
	Network.hookPacket(PACKET.ZC.NOTIFY_MAPINFO, onTeleportResult);
	Network.hookPacket(PACKET.ZC.ACK_REMEMBER_WARPPOINT, onMemoResult);
	Network.hookPacket(PACKET.ZC.MAKINGARROW_LIST, onMakingarrowList);
	Network.hookPacket(PACKET.ZC.NOTIFY_WEAPONITEMLIST, onRefineList);
	Network.hookPacket(PACKET.ZC.REPAIRITEMLIST, onRepairList);
	Network.hookPacket(PACKET.ZC.REPAIRITEMLIST2, onRepairList);
	Network.hookPacket(PACKET.ZC.SPIRITS, onSpiritSphere);
	Network.hookPacket(PACKET.ZC.SPIRITS2, onSpiritSphere);
	Network.hookPacket(PACKET.ZC.MILLENNIUMSHIELD, onMillenniumShield);
	Network.hookPacket(PACKET.ZC.SKILL_POSTDELAY, onSetSkillDelay);
	Network.hookPacket(PACKET.ZC.STARSKILL, onTaekwonMission);
	Network.hookPacket(PACKET.ZC.MSG_SKILL, onMessageSkill);
	Network.hookPacket(PACKET.ZC.MONSTER_INFO, onSense);
	Network.hookPacket(PACKET.ZC.DEVOTIONLIST, onDevotionList);
	Network.hookPacket(PACKET.ZC.SELECTCART, pkt => CartDecoration.onSelectCart(pkt));
}
