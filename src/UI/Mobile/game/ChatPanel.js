import { privateRecipientError } from 'UI/Game/PrivateRecipient.js';
import { requestMobileInput } from './MobileInputEditor.js';
import { chatChannelLabels } from './ChatChannels.js';
import { chatEmotions } from 'UI/Game/ChatEmotions.js';
import { createFeedback } from 'UI/Components/Feedback.js';

export function createChatComposer() {
	return { receiver: '', drafts: new Map(), contacts: new Set(), removedContacts: new Map(), read: new Set() };
}

export function createChatPanel(
	body,
	send,
	initialReceiver = '',
	loadEmotionImages,
	initialFilter = 'all',
	onFilterChange,
	composer = createChatComposer(),
	channelError = () => '',
	onEmotionSent
) {
	body.innerHTML = `
		<div class="chat-conversation">
			<nav class="chat-filters" data-menu-list-spacing="flush-block" aria-label="消息分类"></nav>
			<section class="chat-contacts" aria-label="私聊对象" hidden>
				<button type="button" data-new-private>＋ 新私聊</button>
				<div class="chat-contact-list" data-menu-list-spacing="flush"></div>
			</section>
			<div class="chat-content">
				<div class="chat-recipient" hidden></div>
				<div class="chat-log" data-menu-list-spacing="flush-block" role="log" aria-label="聊天消息"></div>
				<div class="chat-emotions" data-menu-list-spacing="flush-block" hidden aria-label="RO 表情"></div>
			</div>
		</div>
		<form class="chat-form">
			<input data-menu-control="field" data-input-submit aria-label="聊天内容" maxlength="120" autocomplete="off" enterkeyhint="send">
			<button type="button" data-emotions aria-label="选择表情" aria-expanded="false">表情</button>
			<button type="submit">发送</button>
		</form>`;
	const feedback = createFeedback(body);
	const $ = selector => body.querySelector(selector);
	const log = $('.chat-log'),
		input = $('[aria-label="聊天内容"]');
	const palette = $('.chat-emotions'),
		toggle = $('[data-emotions]');
	const recipient = $('.chat-recipient');
	let dismissNewPrivate;
	const sendable = ['public', 'private', 'party', 'guild', 'clan'];
	let messages = [],
		filter = initialReceiver ? 'private' : initialFilter;
	if (initialReceiver) {
		composer.receiver = initialReceiver;
		composer.contacts.add(initialReceiver);
		composer.removedContacts.delete(initialReceiver);
	}
	const key = () => (filter === 'private' ? `private:${composer.receiver}` : filter);
	const canSend = () => sendable.includes(filter) && (filter !== 'private' || Boolean(composer.receiver));
	function saveDraft() {
		if (canSend()) composer.drafts.set(key(), input.value);
	}
	function hideEmotions() {
		palette.hidden = true;
		toggle.setAttribute('aria-expanded', 'false');
	}
	function renderComposer() {
		input.disabled =
			toggle.disabled =
			$('.chat-form [type="submit"]').disabled =
				!canSend() || Boolean(channelError(filter));
		input.value = canSend() ? composer.drafts.get(key()) || '' : '';
		input.placeholder =
			channelError(filter) ||
			(filter === 'all'
				? '请选择频道，或点击消息回复'
				: !sendable.includes(filter)
					? '当前分类仅供查看'
					: filter === 'private'
						? composer.receiver
							? '输入私聊消息'
							: '请先选择私聊对象'
						: `发送到${chatChannelLabels[filter]}`);
		recipient.hidden = filter !== 'private';
		recipient.textContent = composer.receiver || '请选择私聊对象';
		$('.chat-contacts').hidden = filter !== 'private';
		$('.chat-conversation').classList.toggle('is-private', filter === 'private');
		for (const button of $('.chat-filters').children)
			button.setAttribute('aria-pressed', String(button.dataset.chatFilter === filter));
	}
	function chooseFilter(value, peer) {
		saveDraft();
		if (peer) {
			composer.receiver = peer;
			composer.contacts.add(peer);
			composer.removedContacts.delete(peer);
		}
		filter = value;
		hideEmotions();
		renderComposer();
		update();
		log.scrollTop = log.scrollHeight;
		onFilterChange?.(filter);
	}
	for (const [value, label] of Object.entries({ all: '全部', ...chatChannelLabels })) {
		const button = document.createElement('button');
		button.type = 'button';
		button.dataset.chatFilter = value;
		button.textContent = label;
		button.onclick = () => chooseFilter(value);
		$('.chat-filters').append(button);
	}
	function selectPeer(name) {
		name = name.trim();
		if (privateRecipientError(name)) return;
		dismissNewPrivate?.();
		chooseFilter('private', name);
	}
	function removePeer(name) {
		saveDraft();
		composer.contacts.delete(name);
		composer.removedContacts.set(name, Math.max(0, ...messages.map(message => message.id)));
		for (const message of messages) {
			if (message.privatePeer === name) composer.read.add(message.id);
		}
		if (composer.receiver === name) composer.receiver = '';
		renderComposer();
		update();
	}
	let contactsKey = '';
	function renderContacts() {
		const nextContactsKey = JSON.stringify([composer.receiver, [...composer.contacts], messages.filter(m => m.incomingPrivate && !composer.read.has(m.id)).map(m => [m.id, m.privatePeer])]);
		if (nextContactsKey === contactsKey) return;
		contactsKey = nextContactsKey;
		const list = $('.chat-contact-list');
		const scrollTop = list.scrollTop;
		list.replaceChildren();
		for (const name of [...composer.contacts].reverse()) {
			const unread = messages.filter(
				m => m.privatePeer === name && m.incomingPrivate && !composer.read.has(m.id)
			).length;
			const row = document.createElement('div');
			row.className = 'chat-contact';
			row.classList.toggle('is-selected', name === composer.receiver);
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'chat-contact-select';
			const label = document.createElement('span');
			label.className = 'chat-contact-name';
			label.textContent = name;
			button.append(label);
			button.title = name;
			button.setAttribute('aria-label', `${name}${unread ? `，${unread} 条未读` : ''}`);
			if (unread) {
				const badge = document.createElement('b');
				badge.className = 'chat-contact-unread';
				badge.textContent = String(unread);
				button.append(badge);
			}
			button.setAttribute('aria-pressed', String(name === composer.receiver));
			button.onclick = () => selectPeer(name);
			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'chat-contact-remove';
			remove.textContent = '×';
			remove.title = '删除对象';
			remove.setAttribute('aria-label', `删除私聊对象 ${name}`);
			remove.onclick = () => removePeer(name);
			row.append(button, remove);
			list.append(row);
		}
		list.scrollTop = scrollTop;
	}
	function openRecipients() {
		const field = document.createElement('input');
		field.placeholder = '输入角色名';
		field.maxLength = 24;
		field.required = true;
		field.autocomplete = 'off';
		dismissNewPrivate = requestMobileInput(body.getRootNode().host, {
			field,
			title: '新私聊',
			doneLabel: '开始私聊',
			validate: value => privateRecipientError(value.trim()),
			onConfirm: selectPeer,
			onClose: () => {
				dismissNewPrivate = null;
			}
		});
	}
	$('[data-new-private]').onclick = openRecipients;
	function update(next = messages) {
		messages = next;
		const scrollTop = log.scrollTop;
		const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
		for (const message of messages) {
			if (message.privatePeer) {
				const removedAt = composer.removedContacts.get(message.privatePeer);
				if (removedAt === undefined || (message.incomingPrivate && message.id > removedAt)) {
					composer.removedContacts.delete(message.privatePeer);
					composer.contacts.add(message.privatePeer);
				}
			}
			if (
				!dismissNewPrivate &&
				(filter === 'all' || (filter === 'private' && message.privatePeer === composer.receiver))
			)
				composer.read.add(message.id);
		}
		const unread = messages.filter(m => m.incomingPrivate && !composer.read.has(m.id)).length;
		$('[data-chat-filter="private"]').textContent = `私聊${unread ? ` (${unread})` : ''}`;
		log.replaceChildren(
			...messages
				.filter(
					m =>
						filter === 'all' ||
						(m.channel === filter && (filter !== 'private' || m.privatePeer === composer.receiver))
				)
				.map(m => {
					const p = document.createElement('p');
					p.dataset.channel = m.channel;
					if (filter === 'private') {
						p.classList.add('chat-private-message');
						p.dataset.direction = m.direction || (m.incomingPrivate ? 'incoming' : 'outgoing');
						const label = document.createElement('span');
						label.className = 'chat-message-author';
						label.textContent =
							p.dataset.direction === 'error' ? '提示' : p.dataset.direction === 'incoming' ? '喵' : '我';
						const text = document.createElement('span');
						label.textContent += '：';
						text.className = 'chat-message-body';
						text.textContent = m.bodyText;
						p.append(label, text);
					} else if (m.channel === 'private' && m.privatePeer) {
						const prefix = m.direction === 'error' ? '提示 ' : m.direction === 'outgoing' ? '回复 ' : '';
						p.textContent = `[私聊] ${prefix}[${m.privatePeer}]: ${m.bodyText}`;
					} else p.textContent = `[${chatChannelLabels[m.channel] || '系统'}] ${m.text}`;
					if (
						filter === 'all' &&
						(m.channel === 'private' ? m.replyable !== false : m.replyable === true) &&
						sendable.includes(m.channel) &&
						(m.channel !== 'private' || (m.privatePeer && m.incomingPrivate))
					) {
						const reply = document.createElement('a');
						reply.href = '#';
						reply.className = 'chat-reply';
						reply.textContent = m.channel === 'private' ? '回复' : '发言';
						reply.setAttribute(
							'aria-label',
							m.privatePeer ? `私聊 ${m.privatePeer}` : `在${chatChannelLabels[m.channel]}发言`
						);
						reply.onclick = event => {
							event.preventDefault();
							chooseFilter(m.channel, m.privatePeer);
							input.focus();
						};
						p.append(' ', reply);
					}
					return p;
				})
		);
		renderContacts();
		log.scrollTop = atBottom ? log.scrollHeight : scrollTop;
	}
	let loading;
	async function ensureEmotions() {
		if (loading) return loading;
		palette.textContent = '正在加载表情…';
		loading = loadEmotionImages()
			.then(images => {
				if (!body.contains(palette)) return;
				palette.replaceChildren();
				for (const [command, label] of chatEmotions) {
					const button = document.createElement('button');
					button.type = 'button';
					button.title = `${label} /${command}`;
					button.setAttribute('aria-label', label);
					const icon = document.createElement('img');
					icon.src = images[command];
					icon.alt = '';
					icon.width = icon.height = 40;
					button.append(icon);
					button.onclick = () => submit(`/${command}`, true);
					palette.append(button);
				}
			})
			.catch(() => {
				loading = null;
				palette.textContent = '表情加载失败，请重新打开';
				feedback('表情加载失败', 'error');
			});
		return loading;
	}
	toggle.onclick = () => {
		palette.hidden = !palette.hidden;
		toggle.setAttribute('aria-expanded', String(!palette.hidden));
		if (!palette.hidden) void ensureEmotions();
	};
	let composing = false;
	input.addEventListener('input', saveDraft);
	input.addEventListener('compositionstart', () => {
		composing = true;
	});
	input.addEventListener('compositionend', () => {
		composing = false;
		saveDraft();
	});
	function submit(text, emotion = false) {
		if (!canSend() || composing || channelError(filter)) return;
		const error = send(text, filter, filter === 'private' ? composer.receiver : '');
		if (error) {
			if (filter !== 'private') feedback(error, 'error');
			return;
		}
		if (!emotion) {
			input.value = '';
			saveDraft();
		}
		hideEmotions();
		if (emotion || chatEmotions.some(([command]) => text.trim() === `/${command}`)) onEmotionSent?.();
	}
	$('.chat-form').onsubmit = event => {
		event.preventDefault();
		submit(input.value);
	};
	renderComposer();
	if (initialReceiver) onFilterChange?.(filter);
	return {
		update,
		refresh() {
			const disabled = !canSend() || Boolean(channelError(filter));
			if (input.disabled !== disabled) {
				saveDraft();
				renderComposer();
			}
		}
	};
}
