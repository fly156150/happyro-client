import escapeHtml from './escapeHtml.js';

const names = { cart: '手推车', peco: '大嘴鸟', dragon: '龙', gryphon: '狮鹫', mado: '魔导机甲', falcon: '猎鹰', warg: '战狼', warg_rider: '战狼骑乘', hawk: '鹰' };
const ridingActions = { enable: '骑乘', disable: '下骑' };
const actions = {
	cart: { enable: '租用', disable: '卸下' },
	peco: ridingActions, dragon: ridingActions, gryphon: ridingActions,
	mado: { enable: '驾驶', disable: '解除驾驶' },
	falcon: { enable: '租用', disable: '解除' },
	warg: { enable: '召唤', disable: '召回' },
	warg_rider: ridingActions,
	hawk: { enable: '召唤', disable: '召回' }
};
const skills = { cart: '手推车使用', peco: '骑乘大嘴鸟', dragon: '龙训练', gryphon: '骑乘大嘴鸟', mado: '魔导机甲执照', falcon: '猎鹰精通', warg: '狼群精通', warg_rider: '骑乘狼', hawk: '猎鹰精通' };
const reasons = {
	riding_busy: '请结束对话、交易或仓库等操作后重试',
	riding_job_required: '当前职业无法使用',
	riding_conflict: '请先解除当前坐骑',
	riding_insufficient_zeny: 'Zeny 不足',
	riding_dismount_warg: '请先从战狼上下骑',
	riding_warg_required: '请先召唤战狼',
	riding_falcon_conflict: '请先召回战狼',
	riding_warg_conflict: '请先解除猎鹰'
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
		if (['falcon', 'warg', 'hawk'].includes(row.kind)) return `确认${actions[row.kind].disable}${names[row.kind]}？`;
		if (row.kind === 'warg_rider') return '确认从战狼上下骑？下骑后战狼会继续随行。';
		if (row.kind === 'mado') return '确认解除魔导机甲驾驶？';
		return `确认从${names[row.kind]}上下来？`;
	}
	if (row.kind === 'warg') return '确认召唤战狼？需携带狼笛，并按技能规则消耗 SP。';
	if (row.kind === 'hawk') return '确认召唤鹰？需携带猎鹰笛，并按技能规则消耗 SP。';
	if (row.kind === 'warg_rider') return '确认骑乘战狼？将按技能规则消耗 SP。';
	return `确认${actions[row.kind].enable}${names[row.kind]}？${row.ticket ? '将消耗手推车免费使用券 ×1。' : row.fee ? `需支付 ${row.fee.toLocaleString()} Zeny。` : ''}`;
}
