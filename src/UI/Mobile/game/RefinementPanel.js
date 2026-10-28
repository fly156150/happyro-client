import { createCompanionSwitch } from './CompanionSwitch.js';
import { createRefinementEquipmentBrowser } from './RefinementEquipmentBrowser.js';
import { createMenuField } from './MenuFormControls.js';
import { setListItemText, setListItemIcon } from './ListItemText.js';
import { interactionReview, interactionFooter } from './InteractionPanel.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
export function createRefinementPanel(body, service) {
	const operation = service.snapshot().kind === 'grade' ? '升阶' : '精炼';
	const isRefine = service.snapshot().kind === 'refine';
	const browser = createRefinementEquipmentBrowser(body, () => update(), operation);
	const feedback = createFeedback(body);
	const $ = selector => body.querySelector(selector),
		list = $('.inventory-list'),
		detail = $('.inventory-detail'),
		nodes = new Map();
	const { footer, status } = interactionFooter(body);
	status.hidden = true;
	// Keep the same material control mounted from the first empty state onward.
	const materialField = document.createElement('label');
	materialField.className = 'interaction-field refinement-material-field menu-labeled-select';
	const materialCaption = document.createElement('span');
	materialCaption.textContent = '材料';
	const materials = createMenuField('select');
	materials.setAttribute('aria-label', `${operation}材料`);
	materialField.append(materialCaption, materials);
	footer.append(materialField);
	function appendDisabledActions() {
		const unavailableProtection = isRefine ? createCompanionSwitch('祝福') : document.createElement('label');
		if (!isRefine) {
			const caption = document.createElement('span');
			caption.textContent = '祝福';
			unavailableProtection.append(caption);
			const input = createMenuField('input', 'segment');
			input.type = 'number';
			input.value = '0';
			input.setAttribute('aria-label', '祝福次数');
			unavailableProtection.append(input);
			unavailableProtection.classList.add('refinement-grade-blessing');
		}
		unavailableProtection.classList.add('refinement-protection');
		unavailableProtection.querySelector('input').disabled = true;
		footer.insertBefore(unavailableProtection, materialField);
		materials.replaceChildren(new Option('无可用材料', ''));
		materials.disabled = true;
		const disabledNext = document.createElement('button');
		disabledNext.textContent = '下一步';
		disabledNext.disabled = true;
		footer.append(disabledNext);
	}
	let lastResultId = 0;
	let key = '',
		editingId = '';
	function update() {
		const state = service.snapshot();
		if (state.resultId && state.resultId !== lastResultId) {
			lastResultId = state.resultId;
			feedback(state.message, state.messageKind);
		}

		status.textContent = state.message || `余额：${state.zeny ?? 0} Z`;
		const visibleItems = browser.filter(state.items);
		const ids = new Set(visibleItems.map(item => item.index));
		for (const [id, node] of nodes)
			if (!ids.has(id)) {
				node.remove();
				nodes.delete(id);
			}
		for (const item of visibleItems) {
			let button = nodes.get(item.index);
			if (!button) {
				button = document.createElement('button');
				button.className = 'inventory-item';
				button.onclick = () => {
					const current = service.snapshot().items.find(entry => entry.index === item.index);
					const error = current ? service.select(current.index, current.ID) : '装备已经变化';
					if (error) feedback(error, 'error');
					key = '';
					update();
				};
				nodes.set(item.index, button);
				list.append(button);
			}
			setListItemText(button, item.name);
			setListItemIcon(button, item);
			button.disabled = !state.allowed;
			button.setAttribute('aria-pressed', String(state.selected?.index === item.index));
		}
		const next = JSON.stringify([
			state.selected,
			state.offer,
			state.pending,
			state.allowed,
			state.zeny,
			state.blessingOwned,
			state.materials
		]);
		if (key === next) return;
		key = next;
		const selectedItem = state.items.find(item => item.index === state.selected?.index);
		const title = document.createElement('h3');
		title.textContent = selectedItem?.name || '请选择装备';
		const identity = JSON.stringify(state.selected);
		const previous =
			identity === editingId
				? {
						material: body.querySelector('.refinement-material-field select')?.value,
						blessing: footer.querySelector('.refinement-protection input')?.value,
						checked: footer.querySelector('.refinement-protection input')?.checked
					}
				: {};
		editingId = identity;
		detail.replaceChildren();
		detail.classList.toggle('menu-hint', !state.offer);
		[...footer.children].find(child => child.tagName === 'BUTTON')?.remove();
		footer.querySelector('.refinement-protection')?.remove();
		if (!state.offer) {
			detail.textContent = state.pending ? `正在请求${operation}配置…` : state.message || '请选择装备';
			appendDisabledActions();
			return;
		}
		if (!state.materials.length) {
			detail.classList.add('menu-hint');
			const hint = document.createElement('p');
			hint.textContent = `此装备无法${operation}`;
			detail.append(title, hint);
			appendDisabledActions();
			return;
		}
		const gradeBlocked = state.kind === 'grade' && state.offer.success_chance === 0;
		const warning = document.createElement('p');
		warning.textContent = `${operation}会消耗材料与 Z，失败可能降低精炼等级或损毁装备。${state.kind === 'grade' ? '升阶成功后精炼等级归零。' : ''}`;
		if (gradeBlocked) warning.textContent = state.message;
		materials.replaceChildren();
		for (const material of state.materials) {
			const name =
				state.kind === 'grade' ? `${material.name} × ${material.amount ?? 1}` : material.name;
			materials.add(new Option(name, material.index));
		}
		const cost = document.createElement('p');
		cost.className = 'item-description';
		if ([...materials.options].some(option => option.value === previous.material))
			materials.value = previous.material;
		materials.disabled = !state.allowed;
		const chance = document.createElement('p');
		chance.className = 'refinement-chance';
		const switchControl = isRefine ? createCompanionSwitch('祝福') : null;
		const blessing = switchControl ? switchControl.querySelector('input') : createMenuField('input', 'segment');
		blessing.type = 'number';
		blessing.min = '0';
		blessing.step = '1';
		blessing.value = previous.blessing ?? '0';
		blessing.required = true;
		blessing.setAttribute('aria-label', '祝福次数');
		let protection;
		if (state.kind === 'refine') {
			blessing.type = 'checkbox';
			blessing.required = false;
			blessing.setAttribute('aria-label', '祝福');
			blessing.setAttribute('role', 'switch');
			blessing.checked = Boolean(previous.checked && state.offer.blacksmithBlessing);
			blessing.disabled =
				!state.allowed ||
				!state.offer.blacksmithBlessing ||
				state.blessingOwned < state.offer.blacksmithBlessing;
			if (blessing.disabled) blessing.checked = false;
			protection = '祝福';
		} else {
			blessing.max = state.offer.blessing_info?.max_blessing || 0;
			blessing.disabled =
				!state.allowed || gradeBlocked || !Number(blessing.max) || state.offer.success_chance >= 100;
			if (blessing.disabled) blessing.value = '0';
			protection = '祝福';
		}
		const label = switchControl || document.createElement('label');
		if (!isRefine) {
			label.className = 'interaction-field refinement-grade-blessing';
			const caption = document.createElement('span');
			caption.textContent = protection;
			label.append(caption, blessing);
		}
		const blessingHint = document.createElement('p');
		blessingHint.className = 'refinement-hint';
		blessingHint.textContent =
			state.kind === 'grade'
				? `祝福材料：${state.blessingName || '—'}
持有：${state.blessingOwned} 个
每次消耗：${state.offer.blessing_info?.amount || 0} 个
每次增加：${state.offer.blessing_info?.bonus || 0} 个百分点（最多 ${state.offer.blessing_info?.max_blessing || 0} 次）`
				: state.offer.blacksmithBlessing
					? `消耗：${state.offer.blacksmithBlessing} 个\n持有：${state.blessingOwned} 个\n效果：避免装备损毁${state.blessingOwned < state.offer.blacksmithBlessing ? '\n铁匠的祝福不足' : ''}`
					: '当前精炼不支持使用铁匠的祝福。';
		const confirm = document.createElement('button');
		confirm.textContent = '下一步';
		function selected() {
			return {
				material: Number(materials.value),
				blessing:
					state.kind === 'refine'
						? blessing.checked
							? state.offer.blacksmithBlessing
							: 0
						: Number(blessing.value)
			};
		}
		function details() {
			const material = state.materials.find(row => row.index === Number(materials.value));
			cost.textContent = `材料：${material?.name || '—'} × ${material?.amount ?? 1}\n拥有：${material?.owned ?? 0}\n费用：${material?.zeny ?? material?.price ?? 0} Z`;
			if (isRefine) {
				const percentage = document.createElement('strong');
				percentage.className = 'refinement-success-rate';
				percentage.textContent = `${material?.chance ?? 0}%`;
				chance.replaceChildren('成功率：', percentage);
				warning.textContent =
					material?.chance >= 100
						? '本次精炼不会失败。'
						: blessing.checked
							? '铁匠祝福已启用，避免装备损毁。'
							: '失败可能降低精炼等级或损毁装备。';
			}
			if (!isRefine) {
				const percentage = document.createElement('strong');
				percentage.className = 'refinement-success-rate';
				percentage.textContent = `${Math.min(100, (state.offer.success_chance || 0) + Number(blessing.value) * (state.offer.blessing_info?.bonus || 0))}%`;
				chance.replaceChildren('成功率：', percentage);
				warning.textContent = gradeBlocked
					? state.message
					: parseFloat(percentage.textContent) >= 100
						? '本次升阶不会失败，成功后精炼等级归零。'
						: `升阶成功后精炼等级归零。失败时${material?.breakable ? '可能损毁装备' : material?.downgrade ? '精炼等级可能降低' : '装备保留，精炼等级不变'}。`;
			}
			confirm.textContent = '下一步';
		}
		materials.onchange = details;
		blessing.oninput = details;
		blessing.onchange = details;
		details();
		confirm.disabled = !state.allowed || !state.materials.length || gradeBlocked;
		confirm.onclick = () => {
			if (!blessing.reportValidity()) return;
			const choice = selected();
			const terms = value => [value.selected, value.offer, value.materials.map(({ owned, ...row }) => row)];
			const signature = JSON.stringify(terms(state));
			const material = state.materials.find(row => row.index === choice.material);
			const item = state.items.find(row => row.index === state.selected?.index);
			const content = interactionReview(
				[
					`装备：${item?.name || '已选装备'}`,
					`材料：${material?.name} × ${material?.amount ?? 1}`,
					`祝福：${choice.blessing}`,
					chance.textContent
				],
				`费用：${material?.zeny ?? material?.price ?? 0} Z`,
				warning.textContent
			);
			confirmAction(
				body,
				`确认${operation}？`,
				() => {
					const current = service.snapshot();
					if (JSON.stringify(terms(current)) !== signature) {
						feedback(`${operation}内容已变化，请重新核对`, 'error');
						return;
					}
					const error = service.confirm(choice.material, choice.blessing);
					if (error) {
						feedback(error, 'error');
						return;
					}
					key = '';
					update();
				},
				{ content }
			);
		};
		const config = document.createElement('div');
		config.className = 'refinement-config';
		const blessingSection = document.createElement('div');
		blessingSection.className = 'refinement-blessing';
		label.classList.add('refinement-protection');
		footer.insertBefore(label, materialField);
		blessingSection.append(blessingHint);
		config.append(cost, blessingSection, chance, warning);
		warning.className = 'interaction-warning';
		detail.append(title, config);
		footer.append(confirm);
	}
	update();
	return { update };
}
