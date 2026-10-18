import { privateRecipientError } from './PrivateRecipient.js';
import Emotions from 'DB/Emotions.js';
import Session from 'Engine/SessionStorage.js';
import ChatBox from 'UI/Components/ChatBox/ChatBox.js';

export function chatChannel(message) {
	if (
		[
			ChatBox.FILTER.BATTLE,
			ChatBox.FILTER.PARTY_BATTLE,
			ChatBox.FILTER.EXP,
			ChatBox.FILTER.PARTY_EXP,
			ChatBox.FILTER.ITEM,
			ChatBox.FILTER.PARTY_ITEM
		].includes(message.filterType)
	)
		return 'battle';
	const channels = {
		[ChatBox.FILTER.WHISPER]: 'private',
		[ChatBox.FILTER.PARTY]: 'party',
		[ChatBox.FILTER.GUILD]: 'guild',
		[ChatBox.FILTER.CLAN]: 'clan',
		[ChatBox.FILTER.PUBLIC_CHAT]: 'public'
	};
	if (Object.hasOwn(channels, message.filterType)) return channels[message.filterType];
	return 'system';
}
export function isIncomingPrivateMessage(message) {
	return (
		chatChannel(message) === 'private' &&
		Boolean(message.colorType & ChatBox.TYPE.PRIVATE) &&
		!(message.colorType & (ChatBox.TYPE.SELF | ChatBox.TYPE.ERROR))
	);
}
export function chatChannelError(channel) {
	if (channel === 'party' && !Session.hasParty) return '尚未加入队伍';
	if (channel === 'guild' && !Session.hasGuild) return '尚未加入公会';
	if (channel === 'clan' && !Session.hasClan) return '尚未加入氏族';
	return '';
}
export function createGameChat(send, canOperate, sendEmotion) {
	let lastEmotion = -Infinity;
	return {
		emote(command) {
			if (!canOperate() || !Session.Playing) return '当前不能发送表情';
			if (!Object.hasOwn(Emotions.commands, command)) return '请选择有效表情';
			if (Date.now() - lastEmotion < 1000) return '表情发送太快了';
			sendEmotion(Emotions.commands[command]);
			lastEmotion = Date.now();
			return '';
		},
		send(text, channel, receiver = '') {
			text = text.trim();
			receiver = receiver.trim();
			const reject = error => {
				if (channel === 'private') ChatBox.addText(['(', { kind: 'nickname', text: receiver }, ') : ', error], ChatBox.TYPE.ERROR, ChatBox.FILTER.WHISPER);
				return error;
			};
			if (!canOperate() || !Session.Playing) return reject('当前不能发送消息');
			if (!text || text.length > 120) return reject('请输入 1 至 120 个字符');
			if (text.startsWith('/') && Object.hasOwn(Emotions.commands, text.slice(1))) {
				const error = this.emote(text.slice(1));
				return error ? reject(error) : '';
			}
			if (!['public', 'private', 'party', 'guild', 'clan'].includes(channel)) return '请选择聊天频道';
			if (channel === 'private') {
				const error = privateRecipientError(receiver);
				if (error) return reject(error);
			}
			const error = chatChannelError(channel);
			if (error) return error;
			return send(text, channel, receiver) || '';
		}
	};
}
