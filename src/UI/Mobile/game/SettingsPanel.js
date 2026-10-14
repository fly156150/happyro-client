import { confirmAction } from 'UI/Components/Confirmation.js';
import { menuDensity } from './MenuLayout.js';
import { showToast } from 'UI/Components/Toast.js';

/** Graphics and audio settings use a draft until saved. */
export function createSettingsPanel(body, service, initialSection = '画面') {
	let draft = service.snapshot();
	let activeSection = initialSection;
	const host = body.getRootNode().host;
	const scene = () => host?.dataset.menuDensity || menuDensity(window.innerWidth, window.innerHeight);
	let updateScene = () => {};
	const observer = new MutationObserver(() => updateScene());
	if (host) observer.observe(host, { attributes: true, attributeFilter: ['data-menu-density'] });
	const resize = () => updateScene();
	if (!host) window.addEventListener('resize', resize);
	const notify = message => showToast(body, message);
	function render() {
		body.replaceChildren();
		const form = document.createElement('form');
		form.className = 'settings-form';
		form.onsubmit = event => event.preventDefault();
		const tabs = document.createElement('div');
		tabs.className = 'settings-tabs menu-tabs';
		tabs.setAttribute('role', 'group');
		tabs.setAttribute('aria-label', '设置分类');
		const content = document.createElement('div');
		content.className = 'settings-content';
		const sections = new Map();
		for (const name of ['画面', '特效', '声音']) {
			const section = document.createElement('section');
			section.className = 'settings-section';
			section.setAttribute('aria-label', name);
			section.hidden = name !== activeSection;
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = name;
			button.setAttribute('aria-pressed', String(name === activeSection));
			button.onclick = () => {
				activeSection = name;
				for (const [label, entry] of sections) {
					entry.section.hidden = label !== name;
					entry.button.setAttribute('aria-pressed', String(label === name));
				}
				content.scrollTop = 0;
			};
			sections.set(name, { section, button });
			tabs.append(button);
			content.append(section);
		}
		form.append(tabs, content);
		const field = (section, label, input) => {
			const row = document.createElement('label');
			row.className = 'settings-field';
			const caption = document.createElement('span');
			caption.textContent = label;
			row.append(caption, input);
			sections.get(section).section.append(row);
			return row;
		};
		const displayKeys = ['quality', 'fpslimit', 'performanceMode', 'viewArea', 'cursor', 'pixelPerfectSprites'];
		for (const [key, label, range, max, step] of service.fields) {
			const input = document.createElement(Array.isArray(range) ? 'select' : 'input');
			input.dataset.setting = key;
			if (Array.isArray(range)) {
				for (const value of range) {
					const option = document.createElement('option');
					option.value = String(value);
					option.textContent = value === -1 ? '不限制' : String(value);
					input.append(option);
				}
				input.value = String(draft.graphics[key]);
			} else if (range === undefined) {
				input.type = 'checkbox';
				input.checked = draft.graphics[key];
			} else {
				input.type = 'number';
				input.min = range;
				input.max = max;
				input.step = step;
				input.value = draft.graphics[key];
				input.inputMode = 'decimal';
			}
			input.oninput = () => {
				draft.graphics[key] = input.type === 'checkbox' ? input.checked : Number(input.value);
			};
			field(displayKeys.includes(key) ? '画面' : '特效', key === 'quality' ? '渲染比例（%）' : label, input);
		}
		const previewLines = document.createElement('select');
		previewLines.dataset.setting = 'chatPreviewLines';
		for (const value of [2, 3, 4, 5, 6, 7, 8]) {
			const option = document.createElement('option');
			option.value = value;
			option.textContent = `${value} 行`;
			previewLines.append(option);
		}
		const settingKey = () => (scene() === 'spacious' ? 'chatPreviewSpaciousLines' : 'chatPreviewCompactLines');
		updateScene = () => {
			previewLines.value = String(draft.interface[settingKey()]);
		};
		updateScene();
		previewLines.oninput = () => {
			draft.interface[settingKey()] = Number(previewLines.value);
			service.preview?.(draft.interface);
		};
		field('画面', '聊天行数', previewLines);
		const previewTabs = document.createElement('input');
		previewTabs.type = 'checkbox';
		previewTabs.dataset.setting = 'chatPreviewTabs';
		previewTabs.checked = draft.interface.chatPreviewTabs;
		previewTabs.oninput = () => {
			draft.interface.chatPreviewTabs = previewTabs.checked;
			service.preview?.(draft.interface);
		};
		field('画面', '显示聊天分类标签', previewTabs);
		const duration = document.createElement('input');
		duration.type = 'number';
		duration.min = 1;
		duration.max = 10;
		duration.step = 1;
		duration.dataset.setting = 'toastDuration';
		duration.value = draft.interface.toastDuration;
		duration.oninput = () => {
			draft.interface.toastDuration = Number(duration.value);
		};
		field('画面', '通知显示时长（秒）', duration);
		for (const [key, name] of [
			['BGM', '背景音乐'],
			['Sound', '音效']
		]) {
			const enabled = document.createElement('input');
			enabled.type = 'checkbox';
			enabled.checked = draft.audio[key].play;
			enabled.dataset.audio = key;
			enabled.oninput = () => {
				draft.audio[key].play = enabled.checked;
			};
			field('声音', name, enabled);
			const volume = document.createElement('input');
			volume.type = 'range';
			volume.min = 0;
			volume.max = 100;
			volume.step = 1;
			volume.value = draft.audio[key].volume * 100;
			volume.oninput = () => {
				draft.audio[key].volume = Number(volume.value) / 100;
			};
			const row = field('声音', name + '音量', volume);
			row.classList.add('settings-volume');
			const value = document.createElement('span');
			value.className = 'settings-volume-value';
			value.textContent = `${volume.value}%`;
			volume.addEventListener('input', () => {
				value.textContent = `${volume.value}%`;
			});
			row.append(value);
		}

		// Keep related numeric fields in their declared order, then collect switches.
		// Start switches on a fresh grid row without adding visible category labels.
		for (const name of ['画面', '特效', '声音']) {
			const section = sections.get(name).section;
			const rows = [...section.children];
			const switches = rows.filter(row => row.querySelector('input[type="checkbox"]'));
			const values = rows.filter(row => !row.querySelector('input[type="checkbox"]'));
			switches[0]?.classList.add('settings-switch-start');
			section.append(...values, ...switches);
		}

		const footer = document.createElement('div');
		footer.className = 'settings-footer';
		const buttons = document.createElement('div');
		buttons.className = 'settings-actions';
		for (const [label, action] of [
			[
				'保存',
				() => {
					notify(service.save({ ...draft, pickup: service.snapshot().pickup }));
				}
			],
			[
				'恢复默认',
				() => {
					confirmAction(
						body,
						'确认恢复全部画面、特效和声音设置为默认值？',
						() => {
							const message = service.save({
								...service.snapshot(true),
								pickup: service.snapshot().pickup
							});
							draft = service.snapshot();
							render();
							notify(message);
							body.querySelector('.settings-tabs [aria-pressed=true]')?.focus();
						},
						{}
					);
				}
			]
		]) {
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = label;
			button.onclick = () => {
				action();
				if (!form.isConnected) body.querySelector('.settings-tabs [aria-pressed=true]')?.focus();
			};
			buttons.append(button);
		}
		footer.append(buttons);
		form.append(footer);
		body.append(form);
	}
	render();
	return () => {
		observer.disconnect();
		window.removeEventListener('resize', resize);
		service.preview?.(service.snapshot().interface);
	};
}
