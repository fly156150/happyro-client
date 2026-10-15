import { resetTabScroll } from './TabViewState.js';
import { clearTabDrafts } from './TabViewState.js';
import { showToast } from 'UI/Components/Toast.js';
import { getJobDisplayName } from 'DB/Jobs/JobDisplayNameTable.js';
import JobPropertyTable from 'DB/Jobs/JobPropertyTable.js';
import { renderGameSelect, mountGameSelect } from './GameSelect.js';
import { loadCurrentCharacter, maintainCurrentCharacter } from './AdventureControlService.js';
import escapeHtml from './escapeHtml.js';
import { requestConfirmation } from 'UI/Components/Confirmation.js';

const statFields = [
	['str', '力量'],
	['agi', '敏捷'],
	['vit', '体质'],
	['int', '智力'],
	['dex', '灵巧'],
	['luk', '幸运']
];
const traitFields = [
	['pow', '力量 POW'],
	['sta', '耐力 STA'],
	['wis', '智慧 WIS'],
	['spl', '法力 SPL'],
	['con', '专注 CON'],
	['crt', '创造 CRT']
];

function jobGroup(job) {
	const properties = JobPropertyTable[job.id];
	if (job.traits || properties?.isFourthClass) return '四转';
	if (properties?.isExpanded || properties?.isDoram) return '扩展职业';
	if (properties?.isThirdClass) return '三转';
	if (properties?.isSecondClass) return '二转';
	if (properties?.isFirstClass) return '一转';
	if (properties?.isNoviceClass) return '初心者';
	return '其它';
}

function changedValues(form, current) {
	return Object.fromEntries(
		new FormData(form)
			.entries()
			.map(([key, value]) => [key, Number(value)])
			.filter(([key, value]) => value !== current[key])
	);
}

function mount(container, context = {}) {
	container.classList.add('management-tab', 'character-attributes-tab');
	let snapshot;
	let jobs = [];
	let disposed = false;
	let loadToken = 0;
	let selectedJobId;
	let search = '';
	let group = '';
	let pending = false;

	async function load() {
		const token = ++loadToken;
		if (!snapshot) container.innerHTML = '<div class="management-loading">正在读取角色实时状态...</div>';
		try {
			const next = await loadCurrentCharacter();
			if (disposed || token !== loadToken) return;
			snapshot = next;
			updateJobs();
			selectedJobId ??= snapshot.job_id;
			if (container.querySelector('.character-detail')) {
				renderJobs();
				renderDetail();
			} else render();
		} catch (error) {
			if (disposed || token !== loadToken) return;
			container.innerHTML = `<div class="management-error">${escapeHtml(error.message)}</div>`;
		}
	}

	async function submitCommands(commands, confirmation) {
		if (pending) return;
		if (confirmation && !(await requestConfirmation(container, confirmation))) return;
		if (!commands.length) {
			showToast(container, '暂无修改', 'info');

			renderDetail();
			return;
		}
		pending = true;


		renderDetail();
		try {
			for (const { type, payload } of commands) {
				snapshot = await maintainCurrentCharacter(type, payload);
				updateJobs();
				clearTabDrafts(container, Object.keys(payload));
			}
			selectedJobId = snapshot.job_id;

			const jobChange = commands.find(
				command => command.type === 'character.progression.update' && command.payload.job_id !== undefined
			);
			showToast(container, jobChange ? `已转职为${getJobDisplayName(snapshot.job_id, '当前职业')}` : '操作成功');
		} catch (error) {
			showToast(container, error.message, 'error');
		} finally {
			pending = false;
			renderJobs();
			renderDetail();
		}
	}

	function submit(type, payload, confirmation) {
		const mayBeEmpty = ![
			'character.progression.update',
			'character.points.update',
			'character.stats.update',
			'character.traits.update'
		].includes(type);
		const commands = mayBeEmpty || Object.keys(payload).length ? [{ type, payload }] : [];
		return submitCommands(commands, confirmation);
	}

	function filteredJobs() {
		const term = search.trim().toLocaleLowerCase();
		return jobs.filter(
			job =>
				(!group || jobGroup(job) === group) &&
				(!term || job.name.toLocaleLowerCase().includes(term) || String(job.id).includes(term))
		);
	}

	function updateJobs() {
		jobs = snapshot.jobs
			.map(job => ({ ...job, name: getJobDisplayName(job.id, `职业 ${job.id}`) }))
			.sort((a, b) => a.id - b.id);
	}

	function renderJobs() {
		const filtered = filteredJobs();
		container.querySelector('.character-job-list').innerHTML =
			filtered
				.map(
					job => `
			<button class="character-job-row${job.id === selectedJobId ? ' selected' : ''}" type="button" data-job-id="${job.id}">
				<span class="character-job-emblem">${escapeHtml(job.name.slice(0, 1))}</span>
				<span class="monster-row-text"><strong>${escapeHtml(job.name)}</strong><small>${jobGroup(job)} · ID ${job.id}</small></span>
			</button>`
				)
				.join('') || '<div class="character-job-empty">没有匹配的职业</div>';
		container.querySelectorAll('[data-job-id]').forEach(button => {
			button.addEventListener('click', () => {
				if (selectedJobId !== Number(button.dataset.jobId)) {
					resetTabScroll(container, container.querySelector('.character-detail'));
				}
				selectedJobId = Number(button.dataset.jobId);

				renderJobs();
				renderDetail();
			});
		});
	}

	function renderDetail() {
		const selectedJob = jobs.find(job => job.id === selectedJobId);
		const displayedJobId = snapshot.job_id;
		const displayedJobName = getJobDisplayName(displayedJobId, `职业 ${displayedJobId}`);
		const detail = container.querySelector('.character-detail');
		detail.innerHTML = `
			<div class="character-detail-scroll">
				<section><h4>${escapeHtml(displayedJobName)} <small>ID ${displayedJobId}</small></h4><div class="selected-job"><span class="management-form-actions"><button type="button" data-action="vitals">恢复状态</button><button data-action="apply-job" type="button" ${pending || selectedJobId === snapshot.job_id ? 'disabled' : ''}>${selectedJobId !== snapshot.job_id ? `转换为${escapeHtml(selectedJob?.name || `职业 ${selectedJobId}`)}` : '转换职业'}</button></span></div>
				</section>
				<section><h4>等级与点数</h4><form data-form="progression" class="management-form progression-form">
					<label><span>基础等级</span><input name="base_level" type="number" min="1" max="${snapshot.max_base_level}" value="${snapshot.base_level}" required></label>
					<label><span>职业等级</span><input name="job_level" type="number" min="1" max="${snapshot.max_job_level}" value="${snapshot.job_level}" required></label>
					<label><span>素质点</span><input name="status_points" type="number" min="0" max="${snapshot.max_status_points}" value="${snapshot.status_points}" required></label>
					<label><span>四转素质点</span><input name="trait_points" type="number" min="0" max="${snapshot.traits.max_points}" value="${snapshot.traits.points}" ${snapshot.traits.enabled ? '' : 'disabled'} required></label>
					<label><span>技能点</span><input name="skill_points" type="number" min="0" max="${snapshot.max_skill_points}" value="${snapshot.skill_points}" required></label>
					<div class="management-form-actions"><button type="submit">应用</button><button type="button" data-action="skills-reset">重置技能</button><button type="button" data-action="skills-learn-all">学满技能</button></div>
				</form></section>
				<section><h4>基础属性 <small>剩余 ${snapshot.status_points} 点</small></h4><form data-form="stats" class="management-form stat-form">
					${statFields.map(([key, label]) => `<label><span>${label}</span><input name="${key}" type="number" min="1" max="${snapshot.max_stats?.[key] ?? snapshot.max_stat}" value="${snapshot[key]}" required></label>`).join('')}
					<div class="management-form-actions"><button type="submit">应用</button><button type="button" data-action="stats-reset">重置</button></div>
				</form></section>
				${
					snapshot.traits.enabled
						? `<section><h4>${context.mobile ? '四转属性' : '四转特性'} <small>剩余 ${snapshot.traits.points} 点</small></h4><form data-form="traits" class="management-form stat-form">
					${traitFields.map(([key, label]) => `<label><span>${label}</span><input name="${key}" type="number" min="0" max="${snapshot.traits.maximums[key]}" value="${snapshot.traits.values[key]}" required></label>`).join('')}
					<div class="management-form-actions"><button type="submit">应用</button><button type="button" data-action="traits-reset">重置</button></div>
					${context.mobile ? '' : '<small>直接设置特性值，不受当前特性点限制，不消耗剩余点数。</small>'}
				</form></section>`
						: context.mobile
							? '<section><h4>四转属性</h4><p class="character-traits-unavailable">当前职业尚未开放四转属性</p></section>'
							: ''
				}
			</div>`;

		detail.querySelector('[data-action="apply-job"]').addEventListener('click', () => {
			if (!selectedJob || selectedJobId === snapshot.job_id) return;
			void submit(
				'character.progression.update',
				{ job_id: selectedJobId },
				`是否确认转职为「${selectedJob.name}」?`
			);
		});
		detail.querySelector('[data-form="progression"]').addEventListener('submit', event => {
			event.preventDefault();
			if (!event.currentTarget.reportValidity()) return;
			const changes = changedValues(event.currentTarget, { ...snapshot, trait_points: snapshot.traits.points });
			const levels = Object.fromEntries(
				Object.entries(changes).filter(([key]) => ['base_level', 'job_level'].includes(key))
			);
			const points = Object.fromEntries(
				Object.entries(changes).filter(([key]) => ['status_points', 'skill_points', 'trait_points'].includes(key))
			);
			const commands = [];
			if (Object.keys(levels).length) commands.push({ type: 'character.progression.update', payload: levels });
			if (Object.keys(points).length) commands.push({ type: 'character.points.update', payload: points });
			void submitCommands(commands, levels.base_level < snapshot.base_level ? '确认降低基础等级？' : undefined);
		});
		detail.querySelector('[data-form="stats"]').addEventListener('submit', event => {
			event.preventDefault();
			void submit('character.stats.update', changedValues(event.currentTarget, snapshot));
		});
		detail.querySelector('[data-form="traits"]')?.addEventListener('submit', event => {
			event.preventDefault();
			const form = event.currentTarget;
			if (pending || !form.reportValidity()) return;
			void submit('character.traits.update', changedValues(form, snapshot.traits.values));
		});
		detail
			.querySelector('[data-action="traits-reset"]')
			?.addEventListener('click', () => void submit('character.traits.reset', {}, '确认重置四转素质点？'));
		detail
			.querySelector('[data-action="vitals"]')
			.addEventListener('click', () => void submit('character.vitals.restore', {}));
		detail
			.querySelector('[data-action="stats-reset"]')
			.addEventListener('click', () => void submit('character.stats.reset', {}, '确认重置基础素质点？'));
		detail
			.querySelector('[data-action="skills-reset"]')
			.addEventListener('click', () => void submit('character.skills.reset', {}, '确认重置技能点？'));
		detail
			.querySelector('[data-action="skills-learn-all"]')
			.addEventListener('click', () => void submit('character.skills.learn_all', {}, '确认学满技能？'));
		if (pending) detail.querySelectorAll('button, input').forEach(element => (element.disabled = true));
	}

	function render() {
		container.innerHTML = `<div class="character-job-toolbar catalog-toolbar"><input class="catalog-search" type="search" placeholder="搜索职业名称或 ID" aria-label="搜索职业">${renderGameSelect(
			{
				className: 'catalog-filter',
				ariaLabel: '职业分组',
				value: group,
				options: [
					{ value: '', label: '全部' },
					...['一转', '二转', '三转', '四转', '初心者', '扩展职业', '其它'].map(label => ({
						value: label,
						label
					}))
				]
			}
		)}</div>
			<div class="character-layout" data-menu-layout="split"><section class="character-job-browser">
			<div class="character-job-list"></div>
		</section><section class="character-detail"></section></div>`;
		const searchInput = container.querySelector('.character-job-toolbar .catalog-search');
		const { input: groupInput } = mountGameSelect(container.querySelector('[data-game-select]'));
		groupInput.addEventListener('change', () => {
			group = groupInput.value;
			resetTabScroll(container, container.querySelector('.character-job-list'));
			renderJobs();
		});
		searchInput.value = search;
		searchInput.addEventListener('input', () => {
			search = searchInput.value;
			resetTabScroll(container, container.querySelector('.character-job-list'));
			renderJobs();
		});
		renderJobs();
		renderDetail();
	}

	const refresh = () => {
		if (!pending) void load();
	};
	const clearFeedback = () => {
		if (snapshot) renderDetail();
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

export default {
	id: 'character',
	label: '角色属性',
	refreshOnOpen: true,
	capability: 'characterMaintenanceAllowed',
	mount
};
