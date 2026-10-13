import { afterEach, expect, it, vi } from 'vitest';
vi.mock('DB/Jobs/JobDisplayNameTable.js', () => ({ default: { 0: '初心者', 1: '剑士' }, getJobDisplayName: id => id === 1 ? '剑士' : '初心者' }));
vi.mock('DB/DBManager.js', () => ({ default: { getMapInfo: () => ({ displayName: '普隆德拉' }) } }));
vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({ loadCurrentCharacter: vi.fn(), maintainCurrentCharacter: vi.fn() }));
vi.mock('../../src/UI/Components/Confirmation.js', () => ({ requestConfirmation: vi.fn().mockResolvedValue(true) }));
import { loadCurrentCharacter, maintainCurrentCharacter } from '../../src/UI/Components/GameTools/AdventureControlService.js';
import tab from '../../src/UI/Components/GameTools/CharacterMaintenanceTab.js';
afterEach(() => { document.body.replaceChildren(); vi.clearAllMocks(); });
it.each([false, true])('keeps character actions working with mobile layout %s', async mobile => {
	const snapshot = { job_id: 0, name: '测试角色', map: 'prontera', x: 1, y: 1, hp: 50, max_hp: 50, sp: 10, max_sp: 10,
		base_level: 1, job_level: 1, skill_points: 0, status_points: 0, max_base_level: 200, max_job_level: 50, max_skill_points: 1000,
		str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1, max_stat: 130,
		traits: { enabled: false }, jobs: [{id: 0, max_base_level: 99, max_job_level: 10}, {id: 1, max_base_level: 99, max_job_level: 50}] };
	loadCurrentCharacter.mockResolvedValue(snapshot);
	maintainCurrentCharacter.mockResolvedValue({ ...snapshot, job_id: 1 });
	document.body.innerHTML = '<div class="game-tools-window"><div class="tab"></div></div>';
	const root = document.querySelector('.game-tools-window');
	const close = vi.fn();
	tab.mount(root.firstElementChild, { close, mobile });
	await vi.waitFor(() => expect(root.querySelector('[data-job-id="1"]')).not.toBeNull());
	expect(root.querySelector('.character-job-summary')).toBeNull();
	root.querySelector('[data-job-id="1"]').click();
	if (mobile) {
		expect(root.querySelector('.selected-job').previousElementSibling.textContent).toBe('初心者 ID 0');
		expect(root.querySelector('[data-action="apply-job"]').textContent).toBe('转换为剑士');
	}
	root.querySelector('[data-action="apply-job"]').click();
	await vi.waitFor(() => expect(document.querySelector('.ui-toast.success')?.textContent).toContain('已转职为剑士'));
	expect(close).not.toHaveBeenCalled();
	if (mobile) {
		expect(root.querySelector('.character-summary')).toBeNull();
		expect(root.querySelector('.character-current-job')).toBeNull();
		expect(root.querySelector('.selected-job').previousElementSibling.textContent).toBe('剑士 ID 1');
		expect([...root.querySelectorAll('.character-detail-scroll > section > h4')].map(node => node.firstChild.textContent.trim())).toEqual(['剑士', '等级与点数', '基础属性', '四转属性']);
	} else expect(root.querySelector('.character-summary').textContent).toContain('剑士');
	expect(root.querySelector('[data-action="apply-job"]').disabled).toBe(true);
	maintainCurrentCharacter.mockRejectedValue(new Error('服务暂时不可用'));
	root.querySelector('[data-action="vitals"]').click();
	await vi.waitFor(() => expect(document.querySelector('.ui-toast.error')?.textContent).toBe('服务暂时不可用'));
	expect(document.querySelector('.ui-toast.error')).not.toBeNull();
});
