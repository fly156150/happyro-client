import { afterEach, expect, it, vi } from 'vitest';
vi.mock('DB/DBManager.js', () => ({ default: { getMapInfo: () => ({ displayName: '普隆德拉' }) } }));
vi.mock('../../src/UI/Components/GameTools/AdventureControlService.js', () => ({ loadCurrentCharacter: vi.fn(), maintainCurrentCharacter: vi.fn() }));
vi.mock('../../src/UI/Components/Confirmation.js', () => ({ requestConfirmation: vi.fn().mockResolvedValue(true) }));
import { loadCurrentCharacter, maintainCurrentCharacter } from '../../src/UI/Components/GameTools/AdventureControlService.js';
import tab from '../../src/UI/Components/GameTools/CharacterMaintenanceTab.js';

const traits = { enabled: true, points: 7, budget: 7,
	values: {pow: 0, sta: 0, wis: 0, spl: 0, con: 0, crt: 0},
	maximums: {pow: 32767, sta: 32767, wis: 32767, spl: 32767, con: 32767, crt: 32767} };
const snapshot = { characterAppearance: { current: 0, options: [{ id: 0, name: '默认外观', mountLabel: '', fallbackOnMount: false }], reason: '' }, job_id: 4060, name: '四转测试', map: 'prontera', x: 1, y: 1, hp: 50, max_hp: 50, sp: 10, max_sp: 10,
	base_level: 200, job_level: 70, skill_points: 0, status_points: 0, max_base_level: 200, max_job_level: 70,
	max_skill_points: 32767, max_status_points: 2147483647, str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1, max_stat: 32767,
	riding: [], traits: {...traits, enabled: false}, jobs: [
		{id: 4060, max_base_level: 200, max_job_level: 70, traits: false},
		{id: 4252, max_base_level: 275, max_job_level: 60, traits: true},
		{id: 4302, max_base_level: 275, max_job_level: 60, traits: true}
	] };
afterEach(() => { document.body.replaceChildren(); vi.clearAllMocks(); });

it('filters job stages using the catalog dropdown and combines category with search', async () => {
	const jobs = [0, 1, 4002, 4024, 7, 4008, 4060, 4252, 4302, 4308, 24, 4218, 22].map(id => ({
		id, max_base_level: 275, max_job_level: 60, traits: [4252, 4302, 4308].includes(id)
	}));
	loadCurrentCharacter.mockResolvedValue({...snapshot, jobs});
	document.body.innerHTML = '<div id="test"></div>';
	const root = document.getElementById('test');
	const dispose = tab.mount(root);
	await vi.waitFor(() => expect(root.querySelector('.game-select-trigger')).not.toBeNull());
	const visibleJobs = () => Array.from(root.querySelectorAll('[data-job-id]'), button => Number(button.dataset.jobId));
	for (const [group, expected] of [
		['一转', [1, 4002, 4024]], ['二转', [7, 4008]], ['三转', [4060]],
		['四转', [4252, 4302, 4308]], ['初心者', [0]], ['扩展职业', [24, 4218]], ['其它', [22]]
	]) {
		root.querySelector('.game-select-trigger').click();
		root.querySelector(`.game-select-option[data-value="${group}"]`).click();
		expect(visibleJobs()).toEqual(expected);
		expect(root.querySelector('.game-select-trigger').textContent).toContain(group);
	}
	root.querySelector('.game-select-option[data-value="四转"]').click();
	const search = root.querySelector('.catalog-search');
	search.value = '4302';
	search.dispatchEvent(new Event('input', {bubbles: true}));
	expect(visibleJobs()).toEqual([4302]);
	expect(maintainCurrentCharacter).not.toHaveBeenCalled();
	dispose();
});

it('applies levels independently and refreshes point balances from the server', async () => {
	loadCurrentCharacter.mockResolvedValue(snapshot);
	maintainCurrentCharacter.mockResolvedValue({...snapshot, base_level: 201, status_points: 25, skill_points: 3});
	document.body.innerHTML = '<div id="test"></div>';
	const root = document.getElementById('test');
	const dispose = tab.mount(root);
	await vi.waitFor(() => expect(root.querySelector('[data-form="progression"]')).not.toBeNull());
	const levels = root.querySelector('[data-form="progression"]');
	expect(Array.from(levels.querySelectorAll('input'), input => input.name)).toEqual(['base_level', 'job_level', 'status_points', 'trait_points', 'skill_points']);
	expect(Array.from(levels.querySelectorAll('button'), button => button.textContent)).toEqual(['应用', '重置技能', '学满技能']);
	levels.querySelector('[name="job_level"]').value = '60';
	levels.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
	await vi.waitFor(() => expect(maintainCurrentCharacter).toHaveBeenCalledWith('character.progression.update', {job_level: 60}));
	await vi.waitFor(() => expect(root.querySelector('[name="status_points"]').value).toBe('25'));
	expect(root.querySelector('[name="skill_points"]').value).toBe('3');
	expect(maintainCurrentCharacter).toHaveBeenCalledTimes(1);
	dispose();
});

it('applies both point balances in one command without submitting levels or resetting skills', async () => {
	loadCurrentCharacter.mockResolvedValue(snapshot);
	maintainCurrentCharacter.mockResolvedValue({...snapshot, skill_points: 10, status_points: 20});
	document.body.innerHTML = '<div id="test"></div>';
	const root = document.getElementById('test');
	const dispose = tab.mount(root);
	await vi.waitFor(() => expect(root.querySelector('[data-form="progression"]')).not.toBeNull());
	root.querySelector('[name="skill_points"]').value = '10';
	root.querySelector('[name="status_points"]').value = '20';
	root.querySelector('[data-form="progression"]').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
	await vi.waitFor(() => expect(maintainCurrentCharacter).toHaveBeenCalledWith('character.points.update', {skill_points: 10, status_points: 20}));
	await vi.waitFor(() => expect(root.querySelector('[data-action="skills-reset"]').disabled).toBe(false));
	expect(maintainCurrentCharacter).toHaveBeenCalledTimes(1);
	root.querySelector('[data-action="skills-reset"]').click();
	await vi.waitFor(() => expect(maintainCurrentCharacter).toHaveBeenLastCalledWith('character.skills.reset', {}));
	await vi.waitFor(() => expect(root.querySelector('[data-action="skills-learn-all"]').disabled).toBe(false));
	root.querySelector('[data-action="skills-learn-all"]').click();
	await vi.waitFor(() => expect(maintainCurrentCharacter).toHaveBeenLastCalledWith('character.skills.learn_all', {}));
	dispose();
});

it('applies changed levels before explicit point balances and stops when levels fail', async () => {
	loadCurrentCharacter.mockResolvedValue(snapshot);
	maintainCurrentCharacter.mockResolvedValue({...snapshot, job_level: 60, skill_points: 10});
	document.body.innerHTML = '<div id="test"></div>';
	const root = document.getElementById('test');
	const dispose = tab.mount(root);
	await vi.waitFor(() => expect(root.querySelector('[data-form="progression"]')).not.toBeNull());
	root.querySelector('[name="job_level"]').value = '60';
	root.querySelector('[name="skill_points"]').value = '10';
	root.querySelector('[data-form="progression"]').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
	await vi.waitFor(() => expect(maintainCurrentCharacter).toHaveBeenCalledTimes(2));
	expect(maintainCurrentCharacter).toHaveBeenNthCalledWith(1, 'character.progression.update', {job_level: 60});
	expect(maintainCurrentCharacter).toHaveBeenNthCalledWith(2, 'character.points.update', {skill_points: 10});
	await vi.waitFor(() => expect(root.querySelector('[name="job_level"]').disabled).toBe(false));
	maintainCurrentCharacter.mockClear().mockRejectedValue(new Error('等级修改失败'));
	root.querySelector('[name="job_level"]').value = '50';
	root.querySelector('[name="skill_points"]').value = '20';
	root.querySelector('[data-form="progression"]').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
	await vi.waitFor(() => expect(document.querySelector('.ui-toast.error').textContent).toBe('等级修改失败'));
	expect(maintainCurrentCharacter).toHaveBeenCalledTimes(1);
	dispose();
});

it('sets traits above the normal cap and available budget without spending points', async () => {
	loadCurrentCharacter.mockResolvedValue({...snapshot, job_id: 4252, traits});
	maintainCurrentCharacter.mockResolvedValue({...snapshot, job_id: 4252, traits: {...traits, values: {...traits.values, spl: 292}}});
	document.body.innerHTML = '<div id="test"></div>';
	const root = document.getElementById('test');
	const dispose = tab.mount(root);
	await vi.waitFor(() => expect(root.querySelector('[name="spl"]')).not.toBeNull());
	expect(root.querySelector('[name="spl"]').max).toBe('32767');
	root.querySelector('[name="spl"]').value = '292';
	root.querySelector('[data-form="traits"]').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
	await vi.waitFor(() => expect(maintainCurrentCharacter).toHaveBeenCalledWith('character.traits.update', {spl: 292}));
	await vi.waitFor(() => expect(root.querySelector('[name="spl"]').disabled).toBe(false));
	expect(root.querySelector('[data-form="traits"]').closest('section').textContent).toContain('剩余 7 点');
	dispose();
});

it.each([99, 200, 300])('uses the server-normalized transfer level for Base %i', async baseLevel => {
	loadCurrentCharacter.mockResolvedValue({...snapshot, base_level: baseLevel});
	maintainCurrentCharacter.mockResolvedValue({...snapshot, job_id: 4252, base_level: Math.max(200, Math.min(baseLevel, 275)), job_level: 1,
		max_base_level: 275, max_job_level: 60, traits});
	document.body.innerHTML = '<div id="test"></div>';
	const root = document.getElementById('test');
	tab.mount(root);
	await vi.waitFor(() => expect(root.querySelector('[data-job-id="4252"]')).not.toBeNull());
	expect(root.querySelector('[data-job-id="4252"]').textContent).toContain('龙骑士');
	expect(root.querySelector('[data-job-id="4280"]')).toBeNull();
	root.querySelector('[data-job-id="4252"]').click();
	expect(root.querySelector('[data-form="job-target"]')).toBeNull();
	expect(root.querySelectorAll('[name="base_level"]')).toHaveLength(1);
	root.querySelector('[data-action="apply-job"]').click();
	await vi.waitFor(() => expect(maintainCurrentCharacter).toHaveBeenCalledWith('character.progression.update', {job_id: 4252}));
	await vi.waitFor(() => expect(root.querySelector('[data-form="traits"]')).not.toBeNull());
	expect(root.querySelector('[data-form="progression"] [name="base_level"]').max).toBe('275');
	expect(root.querySelector('[name="base_level"]').value).toBe(String(Math.max(200, Math.min(baseLevel, 275))));
	expect(root.querySelector('[data-form="progression"] [name="job_level"]').max).toBe('60');
});

it('submits only changed traits and keeps trait reset separate from base stats', async () => {
	loadCurrentCharacter.mockResolvedValue({...snapshot, job_id: 4252, traits});
	maintainCurrentCharacter.mockResolvedValue({...snapshot, job_id: 4252, traits: {...traits, points: 0, values: {...traits.values, pow: 7}}});
	document.body.innerHTML = '<div id="test"></div>';
	const root = document.getElementById('test');
	tab.mount(root);
	await vi.waitFor(() => expect(root.querySelector('[name="pow"]')).not.toBeNull());
	root.querySelector('[name="pow"]').value = '7';
	root.querySelector('[data-form="traits"]').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
	await vi.waitFor(() => expect(maintainCurrentCharacter).toHaveBeenCalledWith('character.traits.update', {pow: 7}));
	await vi.waitFor(() => expect(root.querySelector('[data-action="traits-reset"]').disabled).toBe(false));
	root.querySelector('[data-action="traits-reset"]').click();
	await vi.waitFor(() => expect(maintainCurrentCharacter).toHaveBeenLastCalledWith('character.traits.reset', {}));
});
