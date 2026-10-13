import { clearTabDrafts } from './TabViewState.js';
import { showToast } from 'UI/Components/Toast.js';
import { applyAdventureGameSettings, loadAdventureGameSettings } from './AdventureControlService.js';
import escapeHtml from './escapeHtml.js';
import { requestConfirmation } from 'UI/Components/Confirmation.js';
import { mountGameSelects, renderGameSelect } from './GameSelect.js';

const groups = [
	{
		title: '经验倍率',
		keys: ['base_exp_rate', 'job_exp_rate']
	},
	{
		title: '地图导航',
		keys: [
			'navigation_teleport_policy',
			'navigation_teleport_cross_map',
			'navigation_teleport_cooldown',
			'navigation_map_channels_enabled'
		]
	},
	{
		title: '魔物召唤',
		keys: [
			'game_tools_monster_spawn_policy',
			'game_tools_monster_spawn_cooldown',
			'game_tools_monster_spawn_duration',
			'game_tools_monster_spawn_allow_boss'
		]
	}
];
const dropTypes = ['common', 'heal', 'use', 'equip', 'card'];
const dropCategories = ['', '_boss', '_mvp'];
const dropKeys = dropTypes.flatMap(type => dropCategories.map(suffix => `item_rate_${type}${suffix}`));
const labels = {
	base_exp_rate: '基础倍率',
	job_exp_rate: '职业经验倍率',
	item_rate_common: '普通物品',
	item_rate_common_boss: 'Mini 普通物品',
	item_rate_common_mvp: 'MVP 普通物品',
	item_rate_heal: '恢复品',
	item_rate_heal_boss: 'Mini 恢复品',
	item_rate_heal_mvp: 'MVP 恢复品',
	item_rate_use: '消耗品',
	item_rate_use_boss: 'Mini 消耗品',
	item_rate_use_mvp: 'MVP 消耗品',
	item_rate_equip: '装备与武器',
	item_rate_equip_boss: 'Mini 装备与武器',
	item_rate_equip_mvp: 'MVP 装备与武器',
	item_rate_card: '卡片',
	item_rate_card_boss: 'Mini 卡片',
	item_rate_card_mvp: 'MVP 卡片',
	navigation_teleport_policy: '地图传送开放范围',
	navigation_teleport_cross_map: '允许跨地图传送',
	navigation_teleport_cooldown: '传送冷却',
	navigation_map_channels_enabled: '启用地图分流',
	game_tools_monster_spawn_policy: '魔物召唤开放范围',
	game_tools_monster_spawn_cooldown: '召唤冷却',
	game_tools_monster_spawn_duration: '魔物存在时间',
	game_tools_monster_spawn_allow_boss: '允许召唤 Boss / MVP'
};
const rateKeys = new Set([...groups[0].keys, ...dropKeys]);
const visibleKeys = new Set([...groups.flatMap(group => group.keys), ...dropKeys]);

function displayValue(key, value) {
	return rateKeys.has(key) ? Number(value) / 100 : value;
}

function serverValue(key, value) {
	return rateKeys.has(key) ? Math.round(Number(value) * 100) : Number(value);
}

function control(key, value, definition) {
	if (definition.unit === 'boolean') {
		return renderGameSelect({
			name: key,
			ariaLabel: labels[key],
			value,
			options: [
				{ value: 1, label: '开启' },
				{ value: 0, label: '关闭' }
			]
		});
	}
	if (definition.unit === 'policy') {
		return renderGameSelect({
			name: key,
			ariaLabel: labels[key],
			value,
			options: [
				...(definition.minimum === 0 ? [{ value: 0, label: '关闭' }] : []),
				{ value: 1, label: '仅管理员' },
				{ value: 2, label: '所有玩家' }
			]
		});
	}
	const isRate = rateKeys.has(key);
	const suffix = definition.unit === 'seconds' ? '秒' : '倍';
	return `<span class="setting-number"><input name="${key}" aria-label="${labels[key]}" type="number" min="${displayValue(key, definition.minimum)}" max="${displayValue(key, definition.maximum)}" step="${isRate ? '0.01' : '1'}" value="${displayValue(key, value)}" required><em>${suffix}</em></span>`;
}

function mount(container, context = {}) {
	container.classList.add('management-tab');
	let settings;
	let disposed = false;
	let loadToken = 0;

	async function load(message = '') {
		const token = ++loadToken;
		if (!settings) container.innerHTML = '<div class="management-loading">正在读取服务器实际设置...</div>';
		try {
			const next = await loadAdventureGameSettings();
			if (disposed || token !== loadToken) return;
			settings = next;
			render(message);
		} catch (error) {
			if (disposed || token !== loadToken) return;
			container.innerHTML = `<div class="management-error">${escapeHtml(error.message)}</div>`;
		}
	}

	function render(message = '', error = false) {
		if (message) showToast(container, message, error ? 'error' : 'success');
		container.innerHTML = `<form class="settings-form">
			<div class="settings-scroll">
				<section><h4>经验倍率</h4><div class="settings-rate-columns">${groups[0].keys.map(key => `<div class="settings-rate-list"><label><span>${labels[key]}</span>${control(key, settings.values[key], settings.definitions[key])}</label></div>`).join('')}</div></section>
				<section><h4>${context.mobile ? '掉落倍率' : '掉落倍率（普通魔物 &amp; Mini &amp; MVP）'}</h4><div class="settings-drop-scroll"><table class="settings-drop-table">
					${context.mobile ? '<thead><tr><th scope="col">物品类型</th><th scope="col">普通</th><th scope="col">Mini</th><th scope="col">MVP</th></tr></thead>' : ''}
					<tbody>${dropTypes
						.map(
							type =>
								`<tr><th scope="row">${labels[`item_rate_${type}`]}</th>${dropCategories
									.map(suffix => {
										const key = `item_rate_${type}${suffix}`;
										return `<td>${control(key, settings.values[key], settings.definitions[key])}</td>`;
									})
									.join('')}</tr>`
						)
						.join('')}</tbody>
				</table></div></section>
				${groups
					.slice(1)
					.map(
						group =>
							`<section><h4>${group.title}</h4><div class="settings-grid">${group.keys.map(key => `<label><span>${labels[key]}</span>${control(key, settings.values[key], settings.definitions[key])}</label>`).join('')}</div></section>`
					)
					.join('')}
			</div>
			<footer class="settings-footer">

				<button type="submit">应用全服设置</button>
			</footer>
		</form>`;
		mountGameSelects(container);
		container.querySelector('form').addEventListener('submit', async event => {
			event.preventDefault();
			const form = event.currentTarget;
			const data = new FormData(form);
			const changes = {};
			for (const key of visibleKeys) {
				const value = serverValue(key, data.get(key));
				if (value !== settings.values[key]) changes[key] = value;
			}
			if (!Object.keys(changes).length) {
				render();
				showToast(container, '暂无修改', 'info');
				return;
			}
			form.querySelectorAll('button, input').forEach(element => (element.disabled = true));
			if (!(await requestConfirmation(container, `确认将 ${Object.keys(changes).length} 项修改应用到全服？`))) {
				form.querySelectorAll('button, input').forEach(element => (element.disabled = false));
				return;
			}
			try {
				const result = await applyAdventureGameSettings(changes);
				clearTabDrafts(container);
				settings.values = result.values;
				render();
				showToast(container, '游戏设置已保存');
			} catch (requestError) {
				render(requestError.message, true);
			}
		});
	}

	const refresh = () => {
		void load();
	};
	const clearFeedback = () => {
		if (settings) render();
	};
	container.addEventListener('game-tools-activate', refresh);
	container.addEventListener('game-tools-reset-feedback', clearFeedback);
	void load();
	return () => {
		disposed = true;
		loadToken++;
		container.removeEventListener('game-tools-activate', refresh);
		container.removeEventListener('game-tools-reset-feedback', clearFeedback);
	};
}

export default { id: 'settings', label: '游戏设置', refreshOnOpen: true, capability: 'gameSettingsAllowed', mount };
