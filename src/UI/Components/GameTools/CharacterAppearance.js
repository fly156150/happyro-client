import { renderGameSelect } from './GameSelect.js';
import escapeHtml from './escapeHtml.js';

const reasons = {
	appearance_busy: '请复活并结束对话、交易或仓库等操作后重试',
	appearance_job_required: '当前职业无法使用此外观'
};

export function renderCharacterAppearance(appearance, pending) {
	const { current, options, reason } = appearance;
	if (options.length <= 1) return '';
	const selected = options.find(option => option.id === current);
	return `<section class="character-appearance"><h4>职业外观</h4>${renderGameSelect({
		name: 'character-appearance', ariaLabel: '职业外观', value: current,
		options: options.map(option => ({ value: option.id, label: option.name })), disabled: pending || Boolean(reason)
	})}${selected?.mountLabel ? `<p class="character-appearance-mount">骑乘外观：${escapeHtml(selected.mountLabel)}</p>` : ''}${reason ? `<p class="character-appearance-reason">${escapeHtml(reasons[reason] || reason)}</p>` : ''}</section>`;
}
