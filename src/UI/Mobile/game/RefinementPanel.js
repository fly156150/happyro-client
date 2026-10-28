import { createCompanionSwitch } from './CompanionSwitch.js';
import { createRefinementEquipmentBrowser } from './RefinementEquipmentBrowser.js';
import { renderDescriptionMarkup } from './DescriptionMarkup.js';
import { createMenuField } from './MenuFormControls.js';
import { setListItemText, setListItemIcon } from './ListItemText.js';
import { interactionColumns, interactionReview, interactionFooter } from './InteractionPanel.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
export function createRefinementPanel(body, service) {
	const operation = service.snapshot().kind === 'grade' ? '升阶' : '精炼';
	const isRefine = service.snapshot().kind === 'refine';
	const browser = isRefine ? createRefinementEquipmentBrowser(body, () => update()) : null;
	if (!isRefine)
		interactionColumns(body, [
			{ title: `待${operation}装备`, className: 'inventory-list' },
			{ title: `${operation}配置`, className: 'inventory-detail' },
			{ title: '装备与结果', className: 'interaction-result' }
		]);
	const feedback = createFeedback(body);
	const $ = selector => body.querySelector(selector),
		list = $('.inventory-list'),
		detail = $('.inventory-detail'),
		nodes = new Map();
	const { footer, status } = interactionFooter(body);
	if (isRefine) status.hidden = true;
	function appendDisabledActions() {
		const unavailableProtection = createCompanionSwitch('祝福');
		unavailableProtection.classList.add('refinement-protection');
		unavailableProtection.querySelector('input').disabled = true;
		footer.append(unavailableProtection);
		const field = document.createElement('label');
		field.className = 'interaction-field refinement-material-field menu-labeled-select';
		const caption = document.createElement('span');
		caption.textContent = '材料';
		const select = createMenuField('select');
		select.setAttribute('aria-label', '精炼材料');
		select.add(new Option('无可用材料', ''));
		select.disabled = true;
		field.append(caption, select);
		footer.append(field);
		const disabledNext = document.createElement('button');
		disabledNext.textContent = '下一步';
		disabledNext.disabled = true;
		footer.append(disabledNext);
	}
	let lastResultId = 0;
	let key = '',
		editingId = '';
	function placeResponsiveControls() {
		if (!isRefine) return;

		const field = body.querySelector('.refinement-material-field');
		if (!field) return;
		if (field.parentElement !== footer) {
			const action = [...footer.children].find(child => child.tagName === 'BUTTON');
			footer.insertBefore(field, action || null);
		}
	}
	function update() {
		placeResponsiveControls();
		const state = service.snapshot();
		if (state.resultId && state.resultId !== lastResultId) {
			lastResultId = state.resultId;
			feedback(state.message, state.messageKind);
		}

		status.textContent = state.message || `余额：${state.zeny ?? 0} Z`;
		const visibleItems = browser ? browser.filter(state.items) : state.items;
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
		const result = isRefine ? detail : $('.interaction-result');
		if (!isRefine) result.replaceChildren();
		const selectedItem = state.items.find(item => item.index === state.selected?.index);
		const title = document.createElement('h3');
		title.textContent = selectedItem?.name || '请选择装备';
		const description = document.createElement('p');
		description.className = 'item-description';
		if (!isRefine) {
			renderDescriptionMarkup(description, selectedItem?.descriptionMarkup || selectedItem?.description || '');
			result.append(title, description);
		}
		const identity = JSON.stringify(state.selected);
		const previous =
			identity === editingId
				? {
						material: (isRefine ? body.querySelector('.refinement-material-field') : detail)?.querySelector(
							'select'
						)?.value,
						blessing: detail.querySelector('input')?.value,
						checked: (isRefine ? footer : detail).querySelector('input')?.checked
					}
				: {};
		editingId = identity;
		detail.replaceChildren();
		detail.classList.toggle('menu-hint', !state.offer);
		footer.querySelector('.refinement-material-field')?.remove();
		[...footer.children].find(child => child.tagName === 'BUTTON')?.remove();
		footer.querySelector('.refinement-protection')?.remove();
		if (!state.offer) {
			detail.textContent = state.pending ? `正在请求${operation}配置…` : '请选择装备';
			if (isRefine) appendDisabledActions();
			return;
		}
		if (state.kind === 'refine' && !state.materials.length) {
			detail.classList.add('menu-hint');
			const hint = document.createElement('p');
			hint.textContent = '此装备无法精炼';
			detail.append(title, hint);
			appendDisabledActions();
			return;
		}
		const gradeBlocked = state.kind === 'grade' && state.offer.success_chance === 0;
		const warning = document.createElement('p');
		warning.textContent = `${operation}会消耗材料与 Z，失败可能降低精炼等级或损毁装备。${state.kind === 'grade' ? '升阶成功后精炼等级归零。' : ''}`;
		if (gradeBlocked) warning.textContent = state.message;
		const materials = createMenuField('select');
		materials.setAttribute('aria-label', `${operation}材料`);
		for (const material of state.materials) {
			const risk = material.breakable ? '可能损毁' : material.downgrade ? '可能降级' : '装备保留';
			const name =
				state.kind === 'grade' ? `${risk} · ${material.name} × ${material.amount ?? 1}` : material.name;
			materials.add(new Option(name, material.index));
		}
		const materialField = document.createElement('label');
		materialField.className = 'interaction-field';
		materialField.classList.toggle('refinement-material-field', state.kind === 'refine');
		materialField.classList.toggle('menu-labeled-select', state.kind === 'refine');
		const materialCaption = document.createElement('span');
		materialCaption.textContent = state.kind === 'grade' ? '材料方案（成功率相同）' : '材料';
		materialField.append(materialCaption, materials);
		const cost = document.createElement('p');
		cost.className = 'item-description';
		if ([...materials.options].some(option => option.value === previous.material))
			materials.value = previous.material;
		materials.disabled = !state.allowed;
		const chance = document.createElement('p');
		chance.className = 'refinement-chance';
		const switchControl = isRefine ? createCompanionSwitch('祝福') : null;
		const blessing = switchControl ? switchControl.querySelector('input') : createMenuField();
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
			blessing.disabled = !state.allowed;
			protection = '祝福次数';
		}
		const label = switchControl || document.createElement('label');
		if (!isRefine) {
			label.className = 'interaction-field';
			label.textContent = protection;
			label.append(blessing);
		}
		const blessingHint = document.createElement('p');
		blessingHint.className = 'refinement-hint';
		blessingHint.textContent =
			state.kind === 'grade'
				? `每次消耗 ${state.offer.blessing_info?.amount || 0} 个祝福材料，成功率增加 ${state.offer.blessing_info?.bonus || 0} 个百分点。最多 ${state.offer.blessing_info?.max_blessing || 0} 次。`
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
			cost.textContent = `材料：${material?.name || '—'} × ${material?.amount ?? 1}\n${isRefine ? '拥有' : '持有'}：${material?.owned ?? 0}\n费用：${material?.zeny ?? material?.price ?? 0} Z`;
			chance.textContent =
				state.kind === 'refine'
					? `成功率：${material?.chance ?? 0}%`
					: `成功率：${Math.min(100, (state.offer.success_chance || 0) + Number(blessing.value) * (state.offer.blessing_info?.bonus || 0))}%\n失败时：${material?.breakable ? '可能损毁装备' : material?.downgrade ? '精炼等级可能降低' : '装备保留，精炼等级不变'}`;
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
		if (isRefine) {
			label.classList.add('refinement-protection');
			footer.append(label);
		} else blessingSection.append(label);
		blessingSection.append(blessingHint);
		config.append(materialField, cost, blessingSection);
		warning.className = 'interaction-warning';
		if (isRefine) {
			config.append(chance, warning);
			detail.append(title, config);
		} else {
			detail.append(config);
			result.insertBefore(chance, description);
			result.insertBefore(warning, description);
		}
		footer.append(confirm);
		placeResponsiveControls();
	}
	update();
	return { update };
}
