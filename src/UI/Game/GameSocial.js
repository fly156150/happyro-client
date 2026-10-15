import { validateSocialText } from 'Utils/SocialText.js';
import DB from 'DB/DBManager.js';
import SkillInfo from 'DB/Skills/SkillInfo.generated.js';
import { canExecuteSkill } from 'UI/Components/SkillList/SkillUse.js';
import { toPlainRagnarokText } from 'Utils/RagnarokText.js';
import Entity from 'Renderer/Entity/Entity.js';
import Session from 'Engine/SessionStorage.js';
import PartyFriends from 'UI/Components/PartyFriends/PartyFriends.js';
import Guild from 'UI/Components/Guild/Guild.js';
import FriendEngine from 'Engine/MapEngine/Friends.js';
import GroupEngine from 'Engine/MapEngine/Group.js';
import GuildEngine from 'Engine/MapEngine/Guild.js';
import EntityManager from 'Renderer/EntityManager.js';

export function createGameSocial(canOperate, shortcuts) {
	let pendingSkill = null;
	function allowed() {
		return Boolean(canOperate() && Session.Playing);
	}
	function snapshot() {
		const social = PartyFriends.getUI().getSocialSnapshot();
		const guild = Guild.getSocialSnapshot();
		const signature = JSON.stringify([guild.points, guild.skills]);
		if (pendingSkill && pendingSkill !== signature) pendingSkill = null;
		return {
			...social,
			party: Session.hasParty ? social.party : [],
			guild: Session.hasGuild ? guild : null,
			allowed: allowed(),
			hasParty: !!Session.hasParty,
			leader: !!Session.isPartyLeader,
			master: !!Session.isGuildMaster,
			rights: Session.guildRight || 0,
			self: { AID: Session.AID, GID: Session.GID },
			guildName: Session.guildName || '',
			guildSkills: Session.hasGuild
				? guild.skills
						.filter(skill => SkillInfo[skill.SKID])
						.map(skill => ({
							...skill,
							name: SkillInfo[skill.SKID].SkillName,
							description: toPlainRagnarokText(DB.getSkillDescription(skill.SKID)),
							active: canExecuteSkill(skill),
							learnable:
								allowed() &&
								Session.isGuildMaster &&
								guild.points > 0 &&
								skill.upgradable &&
								!pendingSkill
						}))
				: []
		};
	}
	function act(action, data = {}) {
		const state = snapshot();
		if (!state.allowed) return '当前不能操作';
		const name = String(data.name || '').trim();
		const textFields = {};
		if (
			[
				'addFriend',
				'createParty',
				'inviteParty',
				'createGuild',
				'breakGuild',
				'inviteGuild',
				'editGuildPosition',
				'guildAlliance',
				'guildHostility'
			].includes(action)
		)
			textFields.name = name;
		if (action === 'guildNotice') Object.assign(textFields, { subject: data.subject, notice: data.notice });
		if (action === 'leaveGuild' || action === 'expelGuild') textFields.reason = data.reason;
		const textError = validateSocialText(textFields);
		if (textError) return textError;
		const friend = state.friends.find(f => f.AID === data.AID && f.GID === data.GID);
		const member = state.party.find(m => m.AID === data.AID);
		const guildMember = state.guild?.members.find(m => m.AID === data.AID && m.GID === data.GID);
		switch (action) {
			case 'addFriend':
				if (!name) return '请输入有效角色名';
				FriendEngine.addFriend(name);
				break;
			case 'removeFriend':
				if (!friend) return '好友已变化';
				FriendEngine.removeFriend(state.friends.indexOf(friend));
				break;
			case 'createParty':
				if (state.hasParty || !name) return '无法创建队伍，请检查名称';
				GroupEngine.onRequestCreation(name, Number(data.pickup) || 0, Number(data.division) || 0);
				break;
			case 'inviteParty':
				if (!state.leader || !state.hasParty || !name) return '只有队长可以邀请有效角色';
				GroupEngine.onRequestInvitation(0, name);
				break;
			case 'leaveParty':
				if (!state.hasParty) return '尚未加入队伍';
				GroupEngine.onRequestLeave();
				break;
			case 'expelParty':
			case 'leadParty':
				if (!state.leader || !member || member.AID === Session.AID) return '队员或权限已变化';
				if (action === 'expelParty') GroupEngine.onRequestExpel(member.AID, member.characterName);
				else GroupEngine.onRequestChangeLeader(member.AID);
				break;
			case 'partyOptions':
				if (!state.leader || ![data.exp, data.pickup, data.division].every(v => v === 0 || v === 1))
					return '队伍设置无效';
				GroupEngine.onRequestInfoUpdate(data.exp, data.pickup, data.division);
				break;
			case 'createGuild':
				if (state.guild || !name) return '无法创建公会，请检查名称';
				GuildEngine.createGuild(name);
				break;
			case 'leaveGuild':
				if (!state.guild || state.master) return '公会会长不能直接离会';
				GuildEngine.requestLeave(Session.AID, Session.GID, String(data.reason || ''));
				break;
			case 'breakGuild':
				if (!state.master || name !== state.guildName) return '请确认完整公会名称';
				GuildEngine.breakGuild(name);
				break;
			case 'inviteGuild': {
				if (!state.guild || !(state.master || state.rights & 1) || !name) return '没有邀请权限';
				let target;
				EntityManager.forEach(entity => {
					if (entity.objecttype === Entity.TYPE_PC && entity.display?.name === name) target = entity;
				});
				if (!target) return '请在附近找到该角色再邀请';
				GuildEngine.requestPlayerInvitation(target.GID);
				break;
			}
			case 'guildNotice':
				if (!state.master) return '仅会长可修改公告';
				GuildEngine.requestNoticeUpdate(String(data.subject || ''), String(data.notice || ''));
				break;
			case 'expelGuild':
				if (!(state.master || state.rights & 0x10) || !guildMember || guildMember.AID === Session.AID)
					return '成员或权限已变化';
				GuildEngine.requestMemberExpel(guildMember.AID, guildMember.GID, String(data.reason || ''));
				break;
			case 'learnGuildSkill': {
				const skill = state.guildSkills.find(entry => entry.SKID === data.id);
				if (!skill?.learnable || skill.level + 1 !== data.level) return '技能或学习权限已变化';
				pendingSkill = JSON.stringify([state.guild.points, state.guild.skills]);
				Guild.onIncreaseSkill(data.id);
				break;
			}
			case 'bindGuildSkill': {
				const skill = state.guildSkills.find(entry => entry.SKID === data.id);
				if (
					!state.master ||
					!skill?.active ||
					!Number.isInteger(data.level) ||
					data.level < 1 ||
					data.level > skill.level ||
					!shortcuts.configure(data.slot, { isSkill: true, ID: data.id }, data.level)
				)
					return '技能、等级或快捷键已变化';
				return '快捷键已设置';
			}
			case 'editGuildPosition': {
				const position = state.guild?.positions.find(entry => entry.positionID === data.position);
				if (
					!state.master ||
					!position ||
					!name ||
					!Number.isInteger(data.tax) ||
					data.tax < 0 ||
					data.tax > 50 ||
					![0, 1, 16, 17].includes(data.right)
				)
					return '职位、权限或税率无效';
				GuildEngine.requestPositionUpdate([
					{
						positionID: position.positionID,
						ranking: position.ranking,
						right: data.right,
						posName: name,
						payRate: data.tax
					}
				]);
				break;
			}
			case 'guildAlliance':
			case 'guildHostility': {
				if (!state.master || !state.guild || !name) return '仅会长可设置公会关系';
				let target;
				EntityManager.forEach(entity => {
					if (
						entity.objecttype === Entity.TYPE_PC &&
						entity.display?.name === name &&
						entity.GUID &&
						entity.GUID !== Session.Entity.GUID
					)
						target = entity;
				});
				if (!target) return '请在附近找到其他公会的角色';
				if (action === 'guildAlliance') GuildEngine.requestAlliance(target.GID);
				else GuildEngine.requestHostility(target.GID);
				break;
			}
			case 'removeGuildRelation': {
				const relation = state.guild?.relations.find(
					entry => entry.GDID === data.GDID && entry.relation === data.relation
				);
				if (!state.master || !relation) return '公会关系或权限已变化';
				GuildEngine.requestDeleteRelatedGuild(relation.GDID, relation.relation);
				break;
			}
			case 'guildPosition':
				if (!state.master || !guildMember || !state.guild.positions.some(p => p.positionID === data.position))
					return '成员或职位已变化';
				GuildEngine.requestChangeMemberPos([
					{ AID: guildMember.AID, GID: guildMember.GID, positionID: data.position }
				]);
				break;
			default:
				return '未知操作';
		}
		return '已请求，等待服务器回复';
	}
	return {
		snapshot,
		act,
		shortcutName(index) {
			return shortcuts.slotName(index);
		},
		async uploadEmblem(file) {
			const guildId = Session.Entity?.GUID;
			if (!allowed() || !Session.hasGuild || !Session.isGuildMaster || !file || file.size > 50000)
				return '没有上传权限或文件过大';
			const data = new Uint8Array(await file.arrayBuffer());
			const gif = data.length >= 6 && String.fromCharCode(...data.subarray(0, 6)).match(/^GIF8[79]a$/);
			const bmp = data.length >= 30 && data[0] === 0x42 && data[1] === 0x4d;
			if (!gif && !bmp) return '请选择 BMP 或 GIF 徽章';
			if (bmp && (data.length > 1783 || new DataView(data.buffer).getUint16(28, true) > 24))
				return 'BMP 徽章需为 24 位或以下，且不超过 1783 字节';
			if (!allowed() || !Session.hasGuild || !Session.isGuildMaster || Session.Entity?.GUID !== guildId)
				return '公会或操作状态已变化';
			Guild.onSendEmblem(data);
			return '已请求上传徽章，结果以服务器回复为准';
		},
		refreshGuild() {
			if (allowed() && Session.hasGuild) {
				GuildEngine.requestAccess();
				for (let type = 0; type <= 4; type++) GuildEngine.requestInfo(type);
			}
		}
	};
}
