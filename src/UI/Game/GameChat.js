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
			if (!canOperate() || !Session.Playing) return '当前不能发送消息';
			if (!text || text.length > 120) return '请输入 1 至 120 个字符';
			if (text.startsWith('/') && Object.hasOwn(Emotions.commands, text.slice(1)))
				return this.emote(text.slice(1));
			if (!['public', 'private', 'party', 'guild', 'clan'].includes(channel)) return '请选择聊天频道';
			if (channel === 'private' && (!receiver || receiver.length > 24)) return '请输入有效的私聊对象';
			if (channel === 'party' && !Session.hasParty) return '尚未加入队伍';
			if (channel === 'guild' && !Session.hasGuild) return '尚未加入公会';
			send(text, channel, receiver);
			return '';
		}
	};
}
