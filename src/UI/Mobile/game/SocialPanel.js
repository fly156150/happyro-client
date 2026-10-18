import DB from 'DB/DBManager.js';
import { createMenuField } from './MenuFormControls.js';
import { SOCIAL_TEXT_LIMITS, validateSocialText } from 'Utils/SocialText.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
import { setListItemText } from './ListItemText.js';

export function createSocialPanel(body, service, whisper) {
	body.innerHTML =
		'<div class="inventory-layout" data-menu-layout="split"><div class="inventory-list" aria-label="社交列表"></div><section class="inventory-detail" aria-label="社交详情"></section></div><nav class="social-tabs menu-tabs menu-bottom-tabs" aria-label="社交分类"><button type="button" data-social-tab="friends" aria-pressed="true">好友</button><button type="button" data-social-tab="party" aria-pressed="false">队伍</button><button type="button" data-social-tab="guild" aria-pressed="false">公会</button></nav><div class="social-footer menu-footer menu-footer--trailing"><div class="social-footer-actions"></div><button type="button" data-refresh>刷新公会</button></div>';
	const $ = selector => body.querySelector(selector),
		detail = $('.inventory-detail'),
		list = $('.inventory-list');
	let category = 'friends',
		state,
		selected = null,
		lastKey = '',
		listKey = '';
	const status = createFeedback(body);
	const saves = new Map();
	function savedValue(action, data, snapshot) {
		if (action === 'partyOptions')
			return [snapshot.options.exp_share, snapshot.options.item_share, snapshot.options.item_sharing_type];
		if (action === 'guildNotice') return [snapshot.guild?.notice.subject, snapshot.guild?.notice.notice];
		if (action === 'editGuildPosition') {
			const p = snapshot.guild?.positions.find(position => position.positionID === data.position);
			return [p?.posName, p?.payRate, p?.right & 17];
		}
		if (action === 'guildPosition')
			return snapshot.guild?.members.find(m => m.AID === data.AID && m.GID === data.GID)?.GPositionID;
	}
	function expectedValue(action, data) {
		if (action === 'partyOptions') return [data.exp, data.pickup, data.division];
		if (action === 'guildNotice') return [data.subject, data.notice];
		if (action === 'editGuildPosition') return [data.name.trim(), data.tax, data.right];
		if (action === 'guildPosition') return data.position;
	}

	const act = (action, data) => {
		const expected = expectedValue(action, data);
		if (
			expected !== undefined &&
			JSON.stringify(expected) === JSON.stringify(savedValue(action, data, service.snapshot()))
		) {
			status('设置未改变', 'info');
			return;
		}
		const message = service.act(action, data);
		if (message === '已请求，等待服务器回复' && expected !== undefined)
			saves.set(`${action}:${data.position ?? ''}`, { action, data, expected, start: Date.now() });
		status(
			message,
			action === 'bindGuildSkill'
				? message === '快捷键已设置'
					? 'success'
					: 'error'
				: message === '已请求，等待服务器回复'
					? 'pending'
					: 'error'
		);
	};
	function button(text, fn) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = text;
		b.onclick = fn;
		return b;
	}
	function paragraph(text) {
		const p = document.createElement('p');
		p.textContent = text;
		return p;
	}
	function memberSummary(member, type, isSelf) {
		const card = document.createElement('section');
		card.className = 'social-member-card';
		card.setAttribute('aria-label', '成员资料');
		const header = document.createElement('div');
		header.className = 'social-member-header';
		const name = document.createElement('h3');
		name.textContent = `${member.Name || member.characterName || member.CharName}${isSelf ? '（自己）' : ''}`;
		const rawStatus = type === 'friends' ? member.State : type === 'party' ? member.state : member.CurrentState;
		const online = rawStatus === undefined ? null : type === 'guild' ? Boolean(rawStatus) : rawStatus === 0;
		const badge = document.createElement('span');
		badge.className = 'social-member-status';
		badge.dataset.status = online === null ? 'unknown' : online ? 'online' : 'offline';
		badge.textContent = online === null ? '状态未知' : online ? '在线' : '离线';
		header.append(name, badge);
		card.append(header);
		const mapCode = member.mapName || member.mapname;
		const mapName = mapCode ? DB.getMapName(mapCode.replace(/\.(gat|rsw)$/, '') + '.rsw', '未知地图') : '未知';
		const rows = type === 'friends' ? [
			['等级', member.baseLevel ? `Lv.${member.baseLevel}` : '未知'],
			['地图', mapName]
		] : type === 'party' ? [
			['队伍', state.partyName || '未知'],
			['身份', member.role === 0 ? '队长' : member.role === 1 ? '队员' : '未知'],
			['等级', member.baseLevel ? `Lv.${member.baseLevel}` : '未知'],
			['地图', mapName]
		] : [
			['公会', state.guildName || '未知'],
			['职位', state.guild.positions.find(position => position.positionID === member.GPositionID)?.posName || '未知'],
			['等级', member.Level ? `Lv.${member.Level}` : '未知']
		];
		const facts = document.createElement('dl');
		facts.className = 'social-member-facts';
		for (const [label, value] of rows) {
			const row = document.createElement('div');
			const term = document.createElement('dt');
			const description = document.createElement('dd');
			term.textContent = label;
			description.textContent = value;
			row.append(term, description);
			facts.append(row);
		}
		if (rows.length) card.append(facts);
		return card;
	}
	function form(title, fields, submit, confirm = false, autoSave = false) {
		const f = document.createElement('form');
		f.className = 'social-form menu-form-row';
		const inputs = {};
		for (const [name, label, type = 'text', value = '', options] of fields) {
			const l = document.createElement('label');
			const caption = document.createElement('span');
			caption.textContent = label;
			if (!options && type === 'text') l.className = 'social-role-field';
			l.append(caption);
			const input = createMenuField(options ? 'select' : type === 'textarea' ? 'textarea' : 'input');
			input.setAttribute('aria-label', label);
			if (!options && type === 'text') input.placeholder = label;
			if (options) for (const [id, text] of options) input.add(new Option(text, id));
			else {
				if (type !== 'textarea') input.type = type;
				if (SOCIAL_TEXT_LIMITS[name]) {
					input.maxLength = SOCIAL_TEXT_LIMITS[name];
					input.addEventListener('input', () => {
						input.setCustomValidity(validateSocialText({ [name]: input.value }));
					});
				}
			}
			input.value = value;
			inputs[name] = input;
			l.append(input);
			f.append(l);
		}
		const send = document.createElement('button');
		send.type = 'submit';
		send.textContent = title;
		const footerAction = (category === 'friends' || category === 'party') && fields.length === 0;
		if (!autoSave) {
			if (footerAction) {
				send.type = 'button';
				send.onclick = () => f.requestSubmit();
				$('.social-footer-actions').append(send);
				const updateEnabled = () => {
					send.disabled = !state.allowed || Object.values(inputs).some(input => !input.value.trim() || !input.validity.valid);
				};
				f.addEventListener('input', updateEnabled);
				f.addEventListener('change', updateEnabled);
				updateEnabled();
			} else f.append(send);
		}
		f.onsubmit = e => {
			e.preventDefault();
			const values = Object.fromEntries(Object.entries(inputs).map(([name, node]) => [name, node.value]));
			if (confirm) confirmAction(footerAction ? body : f, `确认${title}？`, () => submit(values));
			else submit(values);
		};
		if (autoSave)
			f.onchange = () =>
				submit(Object.fromEntries(Object.entries(inputs).map(([name, node]) => [name, node.value])));
		detail.append(f);
		return f;
	}
	function syncFooter() {
		if (category === 'guild') return;
		const actions = $('.social-footer-actions');
		if (!actions.querySelector('button:not(:disabled)')) {
			const empty = button('无操作', () => {});
			empty.disabled = true;
			actions.replaceChildren(empty);
		}
	}
	function identity(member) {
		return `${member.AID}:${member.GID || 0}`;
	}
	function render() {
		const type = category;
		list.dataset.socialType = type;
		$('[data-refresh]').hidden = type !== 'guild';
		$('[data-refresh]').disabled = !state.allowed || !state.guild;
		const emblem = detail.querySelector('[data-guild-emblem]');
		if (emblem) {
			emblem.hidden = !state.guild?.emblem;
			if (state.guild?.emblem) emblem.src = state.guild.emblem;
		}
		const members =
			type === 'friends' ? state.friends : type === 'party' ? state.party : state.guild?.members || [];
		const next = JSON.stringify([
			type,
			members.map(m => [identity(m), m.Name || m.characterName || m.CharName, m.State, m.state, m.CurrentState])
		]);
		if (next !== listKey) {
			listKey = next;
			list.replaceChildren(
				button(type === 'friends' ? '好友管理' : type === 'party' ? '队伍管理' : '公会管理', () => {
					selected = null;
					lastKey = '';
					render();
				})
			);
			for (const member of members) {
				const name = member.Name || member.characterName || member.CharName;
				const b = button(name, () => {
					selected = identity(member);
					lastKey = '';
					render();
				});
				b.className = 'inventory-item';
				b.dataset.member = identity(member);
				setListItemText(b, name);
				list.append(b);
			}
			list.firstElementChild.classList.add('social-management', 'inventory-item');
		}
		const member = members.find(m => identity(m) === selected);
		if (selected && !member) selected = null;
		for (const button of list.querySelectorAll('button'))
			button.setAttribute('aria-pressed', String((button.dataset.member || null) === selected));
		const key = JSON.stringify([
			type,
			selected,
			member && [member.AID, member.GID, member.Name, member.characterName, member.CharName,
				member.State, member.state, member.role, member.CurrentState, member.mapName, member.mapname, member.baseLevel, member.Level, member.GPositionID],
			state.allowed,
			state.hasParty,
			state.partyName,
			state.guildName,
			state.leader,
			state.options,
			state.master,
			state.rights,
			state.guild?.info,
			state.guild?.notice,
			state.guild?.positions,
			state.guild?.relations,
			state.guild?.history,
			state.guildSkills
		]);
		if (key === lastKey) return;
		lastKey = key;
		detail.replaceChildren();
		$('.social-footer-actions').replaceChildren();
		if (type === 'party' && state.hasParty && !member) {
			const heading = document.createElement('h3');
			heading.className = 'social-party-heading';
			const name = document.createElement('span');
			name.textContent = state.partyName;
			heading.append(name);
			if (state.leader) {
				const role = document.createElement('small');
				role.textContent = '队长';
				heading.append(role);
			}
			detail.append(heading);
		}
		if (member) {
			const name = member.Name || member.characterName || member.CharName;
			const isSelf = member.AID === state.self.AID;
			detail.append(memberSummary(member, type, isSelf));
			const chat = button('私聊', () => whisper(name));
			chat.disabled = !state.allowed || isSelf;
			(type === 'guild' ? detail : $('.social-footer-actions')).append(chat);
			if (type === 'friends') {
				form('删除好友', [], () => act('removeFriend', member), true);
			} else if (type === 'party') {
				if (state.leader && member.AID !== state.self.AID) {
					form('转交队长', [], () => act('leadParty', member), true);
					form('移出队伍', [], () => act('expelParty', member), true);
				}
			} else {
				if (state.master && !isSelf)
					form(
						'设置职位',
						[
							[
								'position',
								'公会职位',
								'',
								member.GPositionID,
								(state.guild.positions || []).map(p => [p.positionID, p.posName])
							]
						],
						values => act('guildPosition', { ...member, position: Number(values.position) }),
						true
					);
				if ((state.master || state.rights & 0x10) && member.AID !== state.self.AID)
					form(
						'移出公会',
						[['reason', '移出原因']],
						values => act('expelGuild', { ...member, ...values }),
						true
					);
			}
			syncFooter();
			return;
		}
		if (type === 'friends') form('添加好友', [['name', '角色名']], values => act('addFriend', values));
		if (type === 'party') {
			if (!state.hasParty) form('创建队伍', [['name', '队伍名']], values => act('createParty', values), true);
			else {
				if (state.leader) {
					form('邀请入队', [['name', '邀请角色名']], values => act('inviteParty', values));
					form(
						'保存队伍设置',
						[
							[
								'exp',
								'经验分配',
								'',
								state.options.exp_share,
								[
									[0, '各自获得'],
									[1, '平均分配']
								]
							],
							[
								'pickup',
								'拾取规则',
								'',
								state.options.item_share,
								[
									[0, '各自拾取'],
									[1, '队伍共享']
								]
							],
							[
								'division',
								'物品分配',
								'',
								state.options.item_sharing_type,
								[
									[0, '拾取者获得'],
									[1, '随机分配']
								]
							]
						],
						values =>
							act(
								'partyOptions',
								Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)]))
							),
						false,
						true
					);
				}
				form('退出队伍', [], () => act('leaveParty'), true);
			}
		}
		if (type === 'guild') {
			if (!state.guild) {
				form('创建公会', [['name', '公会名']], values => act('createGuild', values), true);
				return;
			}
			const skillGroup = document.createElement('details'),
				summary = document.createElement('summary');
			summary.textContent = `公会技能 · 剩余点数 ${state.guild.points}`;
			skillGroup.append(summary);
			detail.append(skillGroup);
			for (const skill of state.guildSkills) {
				skillGroup.append(paragraph(`${skill.name} Lv.${skill.level}`), paragraph(skill.description));
				if (skill.learnable)
					skillGroup.append(
						form(
							`学习 ${skill.name} 一级`,
							[],
							() => act('learnGuildSkill', { id: skill.SKID, level: skill.level + 1 }),
							true
						)
					);
				if (state.master && skill.active)
					skillGroup.append(
						form(
							`设置 ${skill.name} 快捷槽`,
							[
								['level', `${skill.name} 施放等级`, 'number', skill.level],
								[
									'slot',
									`${skill.name} 快捷槽`,
									'',
									0,
									Array.from({ length: 36 }, (_, index) => [
										index,
										`${index + 1}：${service.shortcutName(index)}`
									])
								]
							],
							values =>
								act('bindGuildSkill', {
									id: skill.SKID,
									level: Number(values.level),
									slot: Number(values.slot)
								}),
							true
						)
					);
			}
			if (state.master) {
				const upload = document.createElement('form');
				upload.className = 'social-form menu-form-row';
				const file = createMenuField();
				file.type = 'file';
				file.accept = '.bmp,.gif,image/bmp,image/gif';
				file.setAttribute('aria-label', '公会徽章文件');
				const send = document.createElement('button');
				send.type = 'submit';
				send.textContent = '上传徽章';
				upload.append(paragraph('徽章：BMP 不超过 1783 字节、24 位或以下；GIF 不超过 50 KB'), file, send);
				upload.onsubmit = event => {
					event.preventDefault();
					const selectedFile = file.files[0];
					if (!selectedFile) {
						status('请选择徽章文件', 'error');
						return;
					}
					confirmAction(upload, `确认上传徽章「${selectedFile.name}」？`, async () => {
						send.disabled = true;
						try {
							const result = await service.uploadEmblem(selectedFile);
							status(result, result === '已请求上传徽章，结果以服务器回复为准' ? 'pending' : 'error');
						} catch {
							status('无法读取徽章文件，请重新选择', 'error');
						} finally {
							send.disabled = false;
						}
					});
				};
				detail.append(upload);
			}
			const info = state.guild.info;
			const emblemImage = document.createElement('img');
			emblemImage.dataset.guildEmblem = '';
			emblemImage.alt = '公会徽章';
			emblemImage.width = emblemImage.height = 48;
			emblemImage.hidden = !state.guild.emblem;
			if (state.guild.emblem) emblemImage.src = state.guild.emblem;
			detail.append(emblemImage);
			detail.append(
				paragraph(state.guildName),
				paragraph(
					info
						? `Lv.${info.level} · 会长：${info.masterName} · 成员：${info.userNum}/${info.maxUserNum}`
						: '正在获取公会信息'
				),
				paragraph(state.guild.notice.subject),
				paragraph(state.guild.notice.notice)
			);
			for (const relation of state.guild.relations) {
				detail.append(paragraph(`${relation.relation === 0 ? '同盟' : '敌对'}：${relation.guildName}`));
				if (state.master)
					form(`解除与 ${relation.guildName} 的关系`, [], () => act('removeGuildRelation', relation), true);
			}
			if (state.master) {
				form('申请同盟', [['name', '附近其他公会角色名']], values => act('guildAlliance', values), true);
				form('设为敌对', [['name', '附近敌对角色名']], values => act('guildHostility', values), true);
				for (const position of state.guild.positions) {
					form(
						`保存职位 ${position.positionID}`,
						[
							['name', `职位 ${position.positionID} 名称`, 'text', position.posName],
							['tax', `职位 ${position.positionID} 经验税率（0–50）`, 'number', position.payRate],
							[
								'right',
								`职位 ${position.positionID} 权限`,
								'',
								position.right & 17,
								[
									[0, '无管理权限'],
									[1, '邀请成员'],
									[16, '移出成员'],
									[17, '邀请和移出成员']
								]
							]
						],
						values =>
							act('editGuildPosition', {
								...values,
								position: position.positionID,
								tax: Number(values.tax),
								right: Number(values.right)
							}),
						true
					);
				}
			}
			for (const entry of state.guild.history)
				detail.append(paragraph(`移出记录：${entry.charname} · ${entry.reason}`));
			if (state.master || state.rights & 1)
				form('邀请入会', [['name', '附近角色名']], values => act('inviteGuild', values));
			if (state.master) {
				form(
					'修改公告',
					[
						['subject', '公告标题', 'text', state.guild.notice.subject],
						['notice', '公告内容', 'textarea', state.guild.notice.notice]
					],
					values => act('guildNotice', values),
					true
				);
				form('解散公会', [['name', '输入完整公会名称']], values => act('breakGuild', values), true);
			} else form('退出公会', [['reason', '离会原因']], values => act('leaveGuild', values), true);
		}
		syncFooter();
	}
	function update() {
		state = service.snapshot();
		for (const [key, save] of saves) {
			if (JSON.stringify(savedValue(save.action, save.data, state)) === JSON.stringify(save.expected)) {
				saves.delete(key);
				status('设置已保存', 'success');
			} else if (Date.now() - save.start > 10000) {
				saves.delete(key);
				lastKey = '';
				status('设置未确认保存，请检查当前值', 'error');
			}
		}
		render();
	}
	for (const tab of body.querySelectorAll('[data-social-tab]')) tab.onclick = () => {
		category = tab.dataset.socialTab;
		for (const item of body.querySelectorAll('[data-social-tab]'))
			item.setAttribute('aria-pressed', String(item === tab));
		selected = null;
		lastKey = '';
		listKey = '';
		if (category === 'guild') service.refreshGuild();
		update();
	};
	$('[data-refresh]').onclick = () => service.refreshGuild();
	update();
	return { update };
}
