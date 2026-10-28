import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	mountGameSelect,
	renderGameSelect,
	setGameSelectOptions
} from '../../src/UI/Components/GameTools/GameSelect.js';

describe('game select', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('selects an option and emits a form-compatible change', () => {
		document.body.innerHTML = `<form>${renderGameSelect({
			name: 'policy',
			ariaLabel: '开放范围',
			value: 1,
			options: [
				{ value: 1, label: '仅管理员' },
				{ value: 2, label: '所有玩家' }
			]
		})}</form>`;
		const root = document.querySelector('[data-game-select]');
		const change = vi.fn();
		root.querySelector('.game-select-value').addEventListener('change', change);
		mountGameSelect(root);

		root.querySelector('.game-select-trigger').click();
		root.querySelector('[data-value="2"]').click();

		expect(new FormData(root.closest('form')).get('policy')).toBe('2');
		expect(root.querySelector('.game-select-value').value).toBe('2');
		expect(root.querySelector('.game-select-trigger span').textContent).toBe('所有玩家');
		expect(change).toHaveBeenCalledOnce();
	});

	it('filters searchable options by label and search metadata', () => {
		document.body.innerHTML = renderGameSelect({
			name: 'job_id',
			ariaLabel: '职业',
			value: 0,
			searchable: true,
			options: [
				{ value: 0, label: '初心者', search: 'novice' },
				{ value: 7, label: '骑士', search: 'knight' }
			]
		});
		const root = document.querySelector('[data-game-select]');
		mountGameSelect(root);

		const search = root.querySelector('.game-select-search');
		search.value = '骑士';
		search.dispatchEvent(new Event('input', { bubbles: true }));

		expect(root.querySelector('[data-value="0"]').hidden).toBe(true);
		expect(root.querySelector('[data-value="7"]').hidden).toBe(false);
	});

	it('replaces options after mount and keeps later selections working', () => {
		document.body.innerHTML = `<form>${renderGameSelect({
			name: 'subtype',
			ariaLabel: '子类',
			value: '',
			disabled: true,
			options: [{ value: '', label: '子类' }]
		})}</form>`;
		const root = document.querySelector('[data-game-select]');
		mountGameSelect(root);
		setGameSelectOptions(root, {
			options: [
				{ value: '', label: '子类' },
				{ value: 'Head_Top', label: '头上' }
			],
			value: '',
			disabled: false,
			ariaLabel: '子类'
		});

		root.querySelector('.game-select-trigger').click();
		root.querySelector('[data-value="Head_Top"]').click();

		expect(root.querySelector('.game-select-value').value).toBe('Head_Top');
		expect(root.querySelector('.game-select-trigger span').textContent).toBe('头上');
		expect(root.querySelector('.game-select-trigger').disabled).toBe(false);
	});
});

it('reopens on the first tap after Safari blurs the selected trigger', async () => {
 document.body.innerHTML = renderGameSelect({ ariaLabel: '分类', value: 'a', options: [{value:'a',label:'全部'},{value:'b',label:'装备'}] });
 const root = document.querySelector('[data-game-select]');
 mountGameSelect(root);
 const trigger = root.querySelector('.game-select-trigger');
 const menu = root.querySelector('.game-select-menu');
 for (let i = 0; i < 3; i++) {
  // WebKit taps blur rather than focus buttons, unlike Chromium.
  trigger.blur();
  trigger.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(menu.hidden).toBe(false);
  root.querySelector('[data-value="b"]').click();
  expect(menu.hidden).toBe(true);
  expect(document.activeElement).toBe(trigger);
 }
 trigger.click();
 trigger.blur();
 await new Promise(resolve => setTimeout(resolve, 0));
 expect(menu.hidden).toBe(true);
});
