import DB from 'DB/DBManager.js';
import { requestMobileInput } from './MobileInputEditor.js';
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

	}
	function expectedValue(action, data) {
		if (action === 'partyOptions') return [data.exp, data.pickup, data.division];
		if (action === 'guildNotice') return [data.subject, data.notice];
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
		status(message, message === '已请求，等待服务器回复' ? 'pending' : 'error');
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
		header.append(name);
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
			['等级', member.Level ? `Lv.${member.Level}` : '未知']
		];
		const facts = document.createElement('dl');
		facts.className = 'social-member-facts';
		for (const [label, value] of [['状态', badge], ...rows]) {
			const row = document.createElement('div');
			const term = document.createElement('dt');
			const description = document.createElement('dd');
			term.textContent = label;
			if (value === badge) description.append(badge);
			else description.textContent = value;
			row.append(term, description);
			facts.append(row);
		}
		if (rows.length) card.append(facts);
		return card;
	}
	function form(title, fields, submit, confirm = false, autoSave = false, inFooter = false) {
		const f = document.createElement('form');
		f.className = 'social-form menu-form-row';
		const inputs = {};
		for (const [name, label, type = 'text', value = '', options] of fields) {
			const l = document.createElement('label');
			const caption = document.createElement('span');
			caption.textContent = label;
			if (!options && type === 'text' && name !== 'subject') l.className = 'social-role-field';
			l.append(caption);
			const input = createMenuField(options ? 'select' : type === 'textarea' ? 'textarea' : 'input');
			input.setAttribute('aria-label', label);
			if (!options && type === 'text' && name !== 'subject') input.placeholder = label;
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
		const footerAction = inFooter || ((category === 'friends' || category === 'party') && fields.length === 0);
		if (!autoSave) {
			if (footerAction) {
				send.type = 'button';
				send.onclick = () => f.requestSubmit();
				$('.social-footer-actions').append(send);
				const updateEnabled = () => {
					send.disabled = !state.allowed || Object.entries(inputs).some(([name, input]) => !input.validity.valid || (name === 'name' && !input.value.trim()));
				};
				f.addEventListener('input', updateEnabled);
				f.addEventListener('change', updateEnabled);
				updateEnabled();
			} else f.append(send);
		}
		f.onsubmit = e => {
			e.preventDefault();
			const values = Object.fromEntries(Object.entries(inputs).map(([name, node]) => [name, node.value]));
			if (confirm) confirmAction(f, `确认${title}？`, () => submit(values));
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
			$('.social-footer-actions').append(chat);
			if (type === 'friends') {
				form('删除好友', [], () => act('removeFriend', member), true);
			} else if (type === 'party') {
				if (state.leader && member.AID !== state.self.AID) {
					form('转交队长', [], () => act('leadParty', member), true);
					form('移出队伍', [], () => act('expelParty', member), true);
				}
			} else {
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
			const info = state.guild.info;
			const overview = document.createElement('section');
			overview.className = 'social-guild-overview';
			const heading = document.createElement('h3');
			heading.className = 'social-party-heading';
			heading.textContent = state.guildName;
			overview.append(heading);
			if (info) {
				const facts = document.createElement('div');
				facts.className = 'social-guild-labels';
				for (const [label, value] of [['等级', `Lv.${info.level}`], ['会长', info.masterName], ['成员', `${info.userNum}/${info.maxUserNum}`]]) {
					const row = document.createElement('span'), term = document.createElement('span'), description = document.createElement('span');
					row.className = 'social-guild-label';
					term.className = 'social-guild-label-name';
					description.className = 'social-guild-label-value';
					term.textContent = label;
					description.textContent = value;
					row.append(term, description);
					facts.append(row);
				}
				overview.append(facts);
			} else overview.append(paragraph('正在获取公会信息'));
			detail.append(overview);
			if (!state.master) {
				const notice = document.createElement('section');
				notice.className = 'social-guild-notice';
				const title = document.createElement('h4');
				title.textContent = state.guild.notice.subject || '公会公告';
				notice.append(title, paragraph(state.guild.notice.notice || '暂无公告'));
				detail.append(notice);
			}
			if (state.master || state.rights & 1) {
				const invite = button('邀请入会', () => {
					const guildName = state.guildName;
					const field = createMenuField();
					field.placeholder = '输入附近角色名';
					field.required = true;
					field.maxLength = SOCIAL_TEXT_LIMITS.name;
					field.autocomplete = 'off';
					requestMobileInput(body.getRootNode().host, {
						field,
						title: '邀请入会',
						doneLabel: '邀请',
						validate: value => !value.trim() ? '请输入角色名' : validateSocialText({ name: value.trim() }),
						onConfirm: value => {
							if (!overview.isConnected || service.snapshot().guildName !== guildName) return;
							act('inviteGuild', { name: value.trim() });
						}
					});
				});
				invite.disabled = !state.allowed;
				$('.social-footer-actions').append(invite);
			}
			if (state.master) {
				const noticeForm = form(
					'保存公告',
					[
						['subject', '公告标题', 'text', state.guild.notice.subject],
						['notice', '公告内容', 'textarea', state.guild.notice.notice]
					],
					values => act('guildNotice', values),
					true,
					false,
					true
				);
				noticeForm.classList.add('social-guild-notice-editor');
				const dissolve = button('解散公会', () => {
					const guildName = state.guildName;
					const content = document.createElement('div');
					content.className = 'social-form';
					const name = createMenuField();
					name.required = true;
					name.placeholder = '输入完整公会名称';
					name.setAttribute('aria-label', '输入完整公会名称');
					const validate = () => name.setCustomValidity(name.value.trim() === guildName ? '' : '请输入完整公会名称');
					name.oninput = validate;
					validate();
					content.append(name);
					confirmAction(overview, `解散公会「${guildName}」？请输入完整名称确认，此操作不会保存公告。`, () => {
						if (service.snapshot().guildName !== guildName) return status('公会已变化，请重新打开菜单', 'error');
						act('breakGuild', { name: name.value });
					}, { content });
				});
				dissolve.disabled = !state.allowed;
				$('.social-footer-actions').append(dissolve);
			} else form('退出公会', [['reason', '离会原因']], values => act('leaveGuild', values), true, false, true);
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
