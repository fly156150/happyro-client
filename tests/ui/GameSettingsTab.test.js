import { expect, it, vi } from 'vitest';

vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({
	loadAdventureGameSettings: vi.fn(),
	applyAdventureGameSettings: vi.fn()
}));
vi.mock('../../src/UI/Components/Confirmation.js', () => ({
	requestConfirmation: vi.fn().mockResolvedValue(true)
}));
vi.mock('../../src/UI/Components/GameTools/GameSelect.js', () => ({
	mountGameSelects: vi.fn(),
	renderGameSelect: vi.fn()
}));
import { loadAdventureGameSettings, applyAdventureGameSettings } from '../../src/UI/Components/GameTools/AdventureControlService.js';
import GameSettingsTab from '../../src/UI/Components/GameTools/GameSettingsTab.js';

it.each([false, true])('renders drop categories and saves Mini independently (mobile: %s)', async mobile => {
	const keys = ['base_exp_rate', 'job_exp_rate', 'navigation_teleport_policy', 'navigation_teleport_cross_map',
		'navigation_teleport_cooldown', 'navigation_map_channels_enabled', 'game_tools_monster_spawn_policy',
		'game_tools_monster_spawn_cooldown', 'game_tools_monster_spawn_duration', 'game_tools_monster_spawn_allow_boss'];
	for (const type of ['common', 'heal', 'use', 'equip', 'card']) {
		for (const suffix of ['', '_boss', '_mvp']) keys.push(`item_rate_${type}${suffix}`);
	}
	const values = Object.fromEntries(keys.map(key => [key, 100]));
	const definitions = Object.fromEntries(keys.map(key => [key, { minimum: 0, maximum: 1000000, unit: 'percent' }]));
	loadAdventureGameSettings.mockResolvedValue({ values, definitions });
	applyAdventureGameSettings.mockResolvedValue({ values: { ...values, item_rate_card_boss: 1000000, item_rate_heal_boss: 250 } });
	const container = document.createElement('div');
	document.body.replaceChildren(container);
	GameSettingsTab.mount(container, { mobile });
	await vi.waitFor(() => expect(container.querySelectorAll('.settings-drop-table input')).toHaveLength(15));
	expect([...container.querySelectorAll('.settings-drop-table thead th')].map(node => node.textContent)).toEqual(['物品类型', '普通（倍）', 'Mini（倍）', 'MVP（倍）']);
	expect(container.querySelector('.settings-drop-table em')).toBeNull();
	container.querySelector('[name=item_rate_card_boss]').value = '10000';
	container.querySelector('[name=item_rate_heal_boss]').value = '2.5';
	container.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
	await vi.waitFor(() => expect(applyAdventureGameSettings).toHaveBeenCalledWith({ item_rate_card_boss: 1000000, item_rate_heal_boss: 250 }));
	expect(container.querySelector('[name=item_rate_card]').value).toBe('1');
	expect(container.querySelector('[name=item_rate_card_mvp]').value).toBe('1');
	expect(container.querySelector('[name=item_rate_card_boss]').value).toBe('10000');
});
