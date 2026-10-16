import escapeHtml from './escapeHtml.js';

const names = { cart: '手推车', peco: '大嘴鸟', dragon: '龙', gryphon: '狮鹫', mado: '魔导机甲' };
const ridingActions = { enable: '骑乘', disable: '下骑' };
const actions = {
	cart: { enable: '租用', disable: '卸下' },
	peco: ridingActions, dragon: ridingActions, gryphon: ridingActions,
	mado: { enable: '驾驶', disable: '解除驾驶' }
};
const skills = { cart: '手推车使用', peco: '骑乘大嘴鸟', dragon: '龙训练', gryphon: '骑乘大嘴鸟', mado: '魔导机甲执照' };
const reasons = {
	riding_busy: '请结束对话、交易或仓库等操作后重试',
	riding_job_required: '当前职业无法使用',
	riding_conflict: '请先解除当前坐骑',
	riding_insufficient_zeny: 'Zeny 不足'
};
export function renderCharacterRiding(rows, pending) {
	return `<section class="character-riding"><h4>骑乘与随行</h4><div class="character-riding-list">${rows.length ? rows.map(row => {
		const action = actions[row.kind];
		const reason = row.reason === 'riding_skill_required' ? `需学习「${skills[row.kind]}」` : reasons[row.reason] || row.reason;
		return `<div class="character-riding-row"><div><strong>${names[row.kind]}</strong>${reason ? `<p>${escapeHtml(reason)}</p>` : ''}</div><div class="management-form-actions"><button type="button" data-riding-kind="${row.kind}" ${pending || row.reason ? 'disabled' : ''}>${row.active ? action.disable : action.enable}</button></div></div>`;
	}).join('') : '<p class="character-traits-unavailable">当前职业没有可用的骑乘或随行功能</p>'}</div></section>`;
}
export function ridingConfirmation(row) {
	if (row.active) {
		if (row.kind === 'cart') return '确认卸下手推车？车内物品会保留。';
		if (row.kind === 'mado') return '确认解除魔导机甲驾驶？';
		return `确认从${names[row.kind]}上下来？`;
	}
	return `确认${actions[row.kind].enable}${names[row.kind]}？${row.ticket ? '将消耗手推车免费使用券 ×1。' : row.fee ? `需支付 ${row.fee.toLocaleString()} Zeny。` : ''}`;
}
