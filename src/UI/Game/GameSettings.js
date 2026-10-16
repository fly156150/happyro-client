import { loadPickupSettings, savePickupSettings, pickupDefaults, validPickupSettings } from './PickupSettings.js';
import Interface, { defaultInterfaceSettings } from 'Preferences/Interface.js';
import Graphics from 'Preferences/Graphics.js';
import Audio from 'Preferences/Audio.js';
import Configs from 'Core/Configs.js';
import Renderer from 'Renderer/Renderer.js';
import BGM from 'Audio/BGM.js';
import Sound from 'Audio/SoundManager.js';

// Shared preferences, independent touch view. Desktop window positions are never edited.
export const graphicsFields = [
	['quality', '渲染比例', 25, 100, 5],
	['fpslimit', '帧率上限', [-1, 30, 60, 90, 120]],
	['performanceMode', '性能模式'],
	['viewArea', '显示范围', 4, 20, 1],
	['cursor', '游戏光标'],
	['pixelPerfectSprites', '像素完美（重新加载后完全生效）'],
	['bloom', '泛光'],
	['bloomIntensity', '泛光强度', 0.1, 3, 0.05],
	['blur', '景深'],
	['blurArea', '景深范围', 3, 20, 1],
	['blurIntensity', '景深强度', 2, 10, 0.1],
	['fxaaEnabled', '抗锯齿'],
	['fxaaSubpix', '亚像素抗锯齿', 0, 1, 0.05],
	['fxaaEdgeThreshold', '边缘阈值', 0.063, 0.333, 0.001],
	['vibranceEnabled', '自然饱和度'],
	['vibrance', '饱和强度', -0.9, 0.9, 0.1],
	['cartoonEnabled', '卡通效果'],
	['cartoonPower', '卡通强度', 0.1, 9.9, 0.1],
	['cartoonEdgeSlope', '描边强度', 1.5, 5.9, 0.1],
	['casEnabled', '锐化'],
	['casContrast', '锐化对比度', 0, 1, 0.05],
	['casSharpening', '锐化强度', 0, 1, 0.05]
];
export function settingsSnapshot(defaults = false) {
	const graphics = Object.fromEntries(
		graphicsFields.map(([key]) => [key, (defaults ? Graphics.defaults : Graphics)[key]])
	);
	return {
		graphics,
		pickup: defaults ? pickupDefaults() : loadPickupSettings(),
		interface: Object.fromEntries(
			Object.keys(defaultInterfaceSettings).map(key => [
				key,
				(defaults ? defaultInterfaceSettings : Interface)[key]
			])
		),
		audio: Object.fromEntries(
			['BGM', 'Sound'].map(key => [
				key,
				defaults ? { play: true, volume: 0.5 } : { play: Audio[key].play, volume: Audio[key].volume }
			])
		)
	};
}
export function saveGameSettings(draft) {
	if (!validPickupSettings(draft?.pickup)) return '拾取设置无效，范围须为 1–15 格';
	if (
		!Number.isInteger(draft?.interface?.toastDuration) ||
		draft.interface.toastDuration < 1 ||
		draft.interface.toastDuration > 10
	)
		return '通知时长须为 1–10 秒';
	if (
		!['chatPreviewCompactLines', 'chatPreviewSpaciousLines'].every(key =>
			[2, 3, 4, 5, 6, 7, 8].includes(draft.interface[key])
		) ||
		typeof draft.interface.chatPreviewTabs !== 'boolean'
	)
		return '聊天预览设置无效';
	for (const [key, , range, max] of graphicsFields) {
		const value = draft?.graphics?.[key];
		if (
			range === undefined
				? typeof value !== 'boolean'
				: Array.isArray(range)
					? !range.includes(value)
					: !Number.isFinite(value) || value < range || value > max
		)
			return '设置值无效，未保存';
	}
	for (const key of ['BGM', 'Sound']) {
		const value = draft?.audio?.[key];
		if (
			!value ||
			typeof value.play !== 'boolean' ||
			!Number.isFinite(value.volume) ||
			value.volume < 0 ||
			value.volume > 1
		)
			return '音量无效，未保存';
	}
	if (!savePickupSettings(draft.pickup)) return '无法保存拾取设置，请检查浏览器存储权限';
	const previous = settingsSnapshot();
	for (const [key] of graphicsFields) Graphics[key] = draft.graphics[key];
	for (const key of ['BGM', 'Sound']) Object.assign(Audio[key], draft.audio[key]);
	for (const key of Object.keys(defaultInterfaceSettings)) Interface[key] = draft.interface[key];
	Interface.save();
	window.dispatchEvent(new Event('interface-settings-change'));
	Graphics.save();
	Audio.save();
	if (previous.graphics.quality !== Graphics.quality) {
		Configs.set('quality', Graphics.quality);
		Renderer.resize();
	}
	// Renderer reads fpslimit on every frame. Do not start a second render loop.
	document.body.classList.toggle('custom-cursor', Graphics.cursor);
	if (previous.audio.Sound.play !== Audio.Sound.play || previous.audio.Sound.volume !== Audio.Sound.volume) {
		Sound.setVolume(Audio.Sound.volume);
		if (!Audio.Sound.play) Sound.stop();
	}
	if (previous.audio.BGM.volume !== Audio.BGM.volume) BGM.setVolume(Audio.BGM.volume);
	if (previous.audio.BGM.play !== Audio.BGM.play) {
		if (Audio.BGM.play) {
			if (BGM.filename) BGM.play(BGM.filename);
		} else BGM.stop();
	}
	return previous.graphics.pixelPerfectSprites !== Graphics.pixelPerfectSprites
		? '已保存，像素完美需刷新生效'
		: '设置已保存';
}

/** Apply audio controls immediately without saving unrelated graphics drafts. */
export function saveGameAudio(key, value) {
 if (!['BGM', 'Sound'].includes(key) || typeof value?.play !== 'boolean' || !Number.isFinite(value.volume) || value.volume < 0 || value.volume > 1) return;
 const wasPlaying = Audio[key].play;
 Object.assign(Audio[key], value);
 Audio.save();
 if (key === 'Sound') {
  Sound.setVolume(value.volume);
  if (!value.play) Sound.stop();
 } else {
  BGM.setVolume(value.volume);
  if (!value.play) BGM.stop();
  else if (!wasPlaying && BGM.filename) BGM.play(BGM.filename);
 }
}
