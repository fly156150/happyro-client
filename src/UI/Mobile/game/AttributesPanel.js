import { confirmAction } from 'UI/Components/Confirmation.js';
import { allocationCost } from 'UI/Game/AttributeAllocation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
export function createAttributesPanel(body, actions, header) {
	body.innerHTML =
		'<div class="attribute-toolbar"><div class="attribute-tabs menu-tabs" role="group" aria-label="素质分类"></div></div><div class="attribute-layout" data-menu-layout="form"><section class="attribute-editor"><div class="attribute-allocation" aria-label="素质加点"></div></section><section class="attribute-results" aria-label="相关数值"><dl></dl></section></div><div class="attribute-footer menu-footer menu-footer--split"><strong class="point-counter" data-attribute-points><span><span class="attribute-points-affix">剩余</span><span data-attribute-points-label></span><span class="attribute-points-affix">：</span></span><span class="point-counter-value" data-attribute-points-value></span></strong><div class="attribute-plan-actions menu-action-group menu-action-group--trailing"><button type="button" class="point-reset-button" data-reset-points>重置素质点</button><button type="button" data-clear-plan>清除预加点</button><button type="button" data-apply-plan>确认</button></div></div>';
	const $ = selector => body.querySelector(selector);
	const toolbar = $('.attribute-toolbar');
	const layout = $('.attribute-layout');
	let destroyed = false;
	const feedback = createFeedback(body);
	const drafts = { base: {}, traits: {} };
	let baseline = '',
		submitting = false;
	function signature(snapshot) {
		return JSON.stringify(
			['base', 'traits'].map(kind => [
				snapshot[kind].points,
				snapshot[kind].enabled,
				snapshot[kind].rows.map(row => [row.key, row.value, row.maximum])
			])
		);
	}
	function spent(kind) {
		return state[kind].rows.reduce(
			(sum, row) => sum + allocationCost(kind, row.value, drafts[kind][row.key] || 0),
			0
		);
	}
	function add(key, amount) {
		const section = state[active],
			row = section.rows.find(entry => entry.key === key);
		if (!row?.canAdd || row.maximum === null || submitting) return;
		let value = row.value + (drafts[active][key] || 0),
			points = section.points - spent(active),
			added = 0;
		while (added < amount && value < row.maximum) {
			const cost = allocationCost(active, value, 1);
			if (cost > points) break;
			points -= cost;
			value++;
			added++;
		}
		drafts[active][key] = (drafts[active][key] || 0) + added;
		update();
	}
	$('[data-reset-points]').onclick = () => {
		const kind = active;
		if (submitting || !actions.snapshot().allowed) return;
		confirmAction(body, `确认重置${kind === 'traits' ? '四转' : '基础'}素质点？`, async () => {
			if (submitting || !actions.snapshot().allowed) return;
			submitting = true;
			try {
				const request = actions.reset(kind);
				update();
				const message = await request;
				feedback(message, message.endsWith('已重置') ? 'success' : 'error');
			} catch (error) {
				feedback(error.message, 'error');
			} finally {
				drafts[kind] = {};
				submitting = false;
				baseline = '';
				update();
			}
		});
	};
	$('[data-clear-plan]').onclick = () => {
		drafts[active] = {};
		update();
	};
	$('[data-apply-plan]').onclick = async () => {
		if (submitting) return;
		const kind = active,
			expected = state[kind],
			additions = { ...drafts[kind] };
		submitting = true;
		try {
			const request = actions.apply(kind, additions, expected);
			update();
			await request;
		} catch (error) {
			feedback(error.message, 'error');
		} finally {
			drafts[kind] = {};
			submitting = false;
			baseline = '';
			update();
		}
	};

	let active = 'base',
		state,
		rowKind;
	const rows = new Map(),
		results = new Map();
	const tabs = new Map();
	for (const [kind, label] of [
		['base', '基础素质'],
		['traits', '四转素质']
	]) {
		const tab = document.createElement('button');
		tab.type = 'button';
		tab.textContent = label;
		tab.onclick = () => {
			active = kind;
			update();
		};
		tabs.set(kind, tab);
		$('.attribute-tabs').append(tab);
	}
	function update() {
		if (destroyed || !body.contains(layout)) return;
		state = actions.snapshot();
		const nextBaseline = signature(state);
		if (baseline && baseline !== nextBaseline && !submitting) {
			drafts.base = {};
			drafts.traits = {};
		}
		baseline = nextBaseline;
		if (!state.traits.enabled) active = 'base';
		tabs.get('traits').hidden = !state.traits.enabled;
		for (const [kind, tab] of tabs) {
			tab.setAttribute('aria-pressed', String(kind === active));
			tab.disabled = state.pending || submitting;
		}
		const section = state[active];
		const plannedCost = spent(active);
		$('[data-attribute-points-label]').textContent = active === 'traits' ? '四转素质点' : '素质点';
		$('[data-attribute-points-value]').textContent =
			section.points === null ? '—' : section.points - (submitting ? 0 : plannedCost);
		$('[data-apply-plan]').disabled = submitting || !state.allowed || plannedCost === 0;
		$('[data-reset-points]').disabled = submitting || !state.allowed;
		$('[data-clear-plan]').disabled = submitting || state.pending || plannedCost === 0;
		if (rowKind !== active) {
			rowKind = active;
			rows.clear();
			results.clear();
			$('.attribute-allocation').replaceChildren();
			$('.attribute-results dl').replaceChildren();
		}
		for (const stat of section.rows) {
			let row = rows.get(stat.key);
			if (!row) {
				row = document.createElement('div');
				row.className = 'attribute-row';
				row.dataset.attribute = stat.key;
				row.innerHTML =
					'<strong></strong><span class="attribute-value"></span><small></small><div class="attribute-increments"></div>';
				row.querySelector('strong').textContent = stat.label;
				for (const [text, amount] of [
					['+1', 1],
					['+10', 10],
					['MAX', Infinity]
				]) {
					const button = document.createElement('button');
					button.type = 'button';
					button.textContent = text;
					button.setAttribute('aria-label', `${stat.label}预加 ${text}`);
					button.onclick = () => add(stat.key, amount);
					row.querySelector('.attribute-increments').append(button);
				}
				rows.set(stat.key, row);
				$('.attribute-allocation').append(row);
			}
			const amount = submitting ? 0 : drafts[active][stat.key] || 0;
			const value = stat.value === null ? null : stat.value + amount;
			row.querySelector('.attribute-value').textContent =
				`${stat.value ?? '—'}${amount ? ` → ${value}` : ''}${stat.bonus ? ` ${stat.bonus > 0 ? '+' : '−'} ${Math.abs(stat.bonus)}` : ''}`;
			const cost = value === null ? null : allocationCost(active, value, 1);
			row.querySelector('small').textContent =
				stat.maximum === null || cost === null
					? '读取中'
					: value >= stat.maximum || stat.cost === 0
						? '已达上限'
						: `消耗 ${cost} 点`;
			for (const button of row.querySelectorAll('button'))
				button.disabled =
					submitting ||
					!stat.canAdd ||
					stat.maximum === null ||
					value >= stat.maximum ||
					cost > section.points - plannedCost;
		}
		for (const stat of state.related[active]) {
			let pair = results.get(stat.key);
			if (!pair) {
				const term = document.createElement('dt'),
					value = document.createElement('dd');
				term.textContent = stat.label;
				value.dataset.result = stat.key;
				$('.attribute-results dl').append(term, value);
				pair = value;
				results.set(stat.key, pair);
			}
			pair.textContent = String(stat.value);
		}
	}
	if (header) {
		header.insertBefore(toolbar, header.querySelector('.panel-navigation'));
		header.classList.add('has-attribute-tabs');
	}
	update();
	actions
		.prepare()
		.then(update)
		.catch(error => {
			if (!destroyed && body.contains(layout)) feedback(error.message, 'error');
		});
	return {
		update,
		destroy() {
			destroyed = true;
			toolbar.remove();
			header?.classList.remove('has-attribute-tabs');
		}
	};
}
