import ItemType from 'DB/Items/ItemType.js';
import { consumables, equipment } from 'UI/Game/InventoryItems.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createFeedback } from 'UI/Components/Feedback.js';
import { setListItemText } from './ListItemText.js';

/** Separate slot selection, candidate browsing and editing without jumping scroll position. */
export function createShortcutPanel(body, actions) {
	let index, selected, dismiss;
	body.innerHTML = `
		<div class="shortcut-pages"><button type="button" data-page-step="-1" aria-label="上一组快捷键">‹</button><div class="slot-picker" role="group" aria-label="选择快捷键"></div><button type="button" data-page-step="1" aria-label="下一组快捷键">›</button></div>
		<div class="shortcut-layout" data-menu-layout="split">
			<section class="shortcut-browser">
				<div class="shortcut-filters">
					<select aria-label="技能类型" data-skill-filter><option value="all">技能类型</option><option value="skills">全部技能</option></select>
					<select aria-label="物品类型" data-item-filter><option value="all">物品类型</option></select>
				</div>
				<div class="shortcut-choices"></div><p data-filter-empty hidden>没有符合条件的技能或物品</p>
			</section>
			<section class="shortcut-editor" aria-label="编辑快捷键">
				<div class="shortcut-current"><strong data-slot-title></strong><span data-current></span></div>
				<p data-choice-hint>从列表选择技能或道具，再保存到当前位置。</p>
				<form class="shortcut-config" hidden>
					<div class="shortcut-selected"><img alt="" data-choice-icon><strong data-choice></strong></div>
					<label class="shortcut-level">施放等级 <select aria-label="技能等级"></select></label>
					<button type="submit" data-save-slot aria-live="polite"></button>
					<button type="button" data-cancel-choice>取消选择</button>
				</form>
				<div class="shortcut-clear menu-footer"><button type="button" data-clear-slot>清空当前位置</button>
				</div>

			</section>
		</div>`;
	const $ = selector => body.querySelector(selector);
	const picker = $('.slot-picker'),
		choices = $('.shortcut-choices'),
		form = $('form');
	const status = createFeedback(body);
	function resetSaveFeedback() {
		const button = $('[data-save-slot]');
		button.textContent = `保存到位置 ${index + 1}`;
		delete button.dataset.saveState;
	}
	form.oninput = () => {
		resetSaveFeedback();
	};
	const slots = () => actions.snapshot().slots.filter(entry => !entry.unavailable);
	function updateSlotLabels() {
		const snapshot = actions.snapshot();
		const visible = snapshot.slots.filter(entry => !entry.unavailable);
		const key = visible.map(slot => slot.index).join(',');
		if (picker.dataset.slots !== key) {
			dismiss?.();
			dismiss = null;
			picker.replaceChildren();
			for (const slot of visible) {
				const button = document.createElement('button');
				button.type = 'button';
				button.dataset.index = slot.index;
				const title = document.createElement('strong');
				const prefix = document.createElement('span');
				prefix.className = 'shortcut-slot-prefix';
				prefix.textContent = '位置 ';
				title.append(prefix, String(slot.index + 1));
				button.append(title, document.createElement('span'));
				button.onclick = () => chooseSlot(slot.index);
				picker.append(button);
			}
			picker.dataset.slots = key;
			if (!visible.some(slot => slot.index === index)) index = visible[0]?.index ?? 0;
			cancelChoice();
		}
		for (const button of body.querySelectorAll('[data-page-step]')) button.disabled = snapshot.pages <= 1;
		for (const slot of visible) {
			const button = picker.querySelector(`[data-index="${slot.index}"]`);
			if (button) {
				button.setAttribute('aria-label', `位置 ${slot.index + 1}：${slot.name}`);
				button.querySelector(':scope > span').textContent =
					`${slot.name}${slot.binding?.isSkill ? ` · Lv.${slot.binding.count}` : ''}`;
				button.setAttribute('aria-pressed', String(slot.index === index));
			}
			if (slot.index === index) {
				$('[data-slot-title]').textContent = `位置 ${index + 1}`;
				$('[data-current]').textContent = `当前：${slot.name}${slot.amount ? ` · ${slot.amount}` : ''}`;
				$('[data-clear-slot]').disabled = slot.empty;
			}
		}
	}
	function highlightChoices() {
		for (const button of choices.children)
			button.setAttribute(
				'aria-pressed',
				String(Boolean(selected && button.dataset.key === `${selected.isSkill}:${selected.ID}`))
			);
	}
	function cancelChoice() {
		selected = null;
		resetSaveFeedback();
		form.hidden = true;
		$('[data-choice-hint]').hidden = false;
		highlightChoices();
	}
	function chooseSlot(next) {
		dismiss?.();
		dismiss = null;
		index = next;
		cancelChoice();
		$('[data-clear-slot]').hidden = false;
		status('');
		updateSlotLabels();
	}
	for (const button of body.querySelectorAll('[data-page-step]')) {
		button.onclick = () => {
			actions.turn(Number(button.dataset.pageStep));
			chooseSlot(slots()[0]?.index ?? 0);
		};
	}
	const candidates = actions.candidates();
	const skillFilter = $('[data-skill-filter]'),
		itemFilter = $('[data-item-filter]');
	for (const tier of ['初心者', '一转', '二转', '三转', '四转', '其它']) {
		if (candidates.some(entry => entry.isSkill && (entry.tier || '其它') === tier))
			skillFilter.add(new Option(tier, tier));
	}
	const itemCategories = [
		['items', '全部物品', null],
		['consumables', '消耗品', consumables],
		['equipment', '装备', equipment],
		['weapon', '武器', [ItemType.WEAPON]],
		['armor', '防具', [ItemType.ARMOR]],
		['ammo', '弹药', [ItemType.AMMO]],
		['pet', '宠物装备', [ItemType.PETARMOR]],
		['shadow', '影子装备', [ItemType.SHADOWGEAR]]
	];
	for (const [value, label] of itemCategories) itemFilter.add(new Option(label, value));
	function applyFilters(changed) {
		if (changed.value !== 'all') (changed === skillFilter ? itemFilter : skillFilter).value = 'all';
		const types = itemCategories.find(([value]) => value === itemFilter.value)?.[2];
		const visible = candidates.filter(
			entry =>
				(skillFilter.value === 'all' ||
					(entry.isSkill &&
						(skillFilter.value === 'skills' || (entry.tier || '其它') === skillFilter.value))) &&
				(itemFilter.value === 'all' || (!entry.isSkill && (!types || types.includes(entry.type))))
		);
		const keys = new Set(visible.map(entry => `${entry.isSkill}:${entry.ID}`));
		for (const button of choices.children) button.hidden = !keys.has(button.dataset.key);
		if (selected && !keys.has(`${selected.isSkill}:${selected.ID}`)) cancelChoice();
		$('[data-filter-empty]').hidden = visible.length > 0;
		choices.scrollTop = 0;
	}
	skillFilter.onchange = () => applyFilters(skillFilter);
	itemFilter.onchange = () => applyFilters(itemFilter);
	for (const entry of candidates) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'shortcut-choice';
		button.dataset.key = `${entry.isSkill}:${entry.ID}`;
		button.setAttribute('aria-pressed', 'false');
		const img = document.createElement('img'),
			label = document.createElement('span');
		img.alt = '';
		if (entry.icon) img.src = entry.icon;
		label.textContent = `${entry.name} · ${entry.amount}`;
		button.append(img, label);
		setListItemText(button, entry.name, String(entry.amount));
		button.onclick = () => {
			selected = entry;
			form.hidden = false;
			$('[data-choice-hint]').hidden = true;
			$('[data-clear-slot]').hidden = false;
			$('[data-choice]').textContent = entry.name;
			$('[data-choice-icon]').hidden = !entry.icon;
			if (entry.icon) $('[data-choice-icon]').src = entry.icon;
			$('.shortcut-level').hidden = !entry.isSkill;
			const select = $('.shortcut-level select');
			select.replaceChildren();
			if (entry.isSkill)
				for (let level = 1; level <= entry.level; level++) select.add(new Option(`Lv.${level}`, String(level)));
			const current = slots().find(slot => slot.index === index)?.binding;
			select.value = String(
				entry.isSkill && current?.isSkill && current.ID === entry.ID
					? Math.min(current.count, entry.level)
					: entry.level || 1
			);
			resetSaveFeedback();
			highlightChoices();
			status('');
		};
		choices.append(button);
	}
	applyFilters(skillFilter);
	form.onsubmit = event => {
		event.preventDefault();
		if (selected && actions.configure(index, selected, Number($('.shortcut-level select').value))) {
			updateSlotLabels();
			status(`已保存到位置 ${index + 1}`, 'success');
		} else {
			status('保存失败，技能或物品已变化，请重新选择。', 'error');
		}
	};
	$('[data-cancel-choice]').onclick = () => {
		cancelChoice();
		status('');
	};
	$('[data-clear-slot]').onclick = () => {
		const slotIndex = index;
		dismiss = confirmAction(
			body,
			`清空位置 ${slotIndex + 1} 的「${slots().find(slot => slot.index === slotIndex)?.name}」？`,
			() => {
				if (actions.configure(slotIndex, null)) {
					chooseSlot(slotIndex);
					status(`位置 ${slotIndex + 1} 已清空`, 'success');
				} else status('清空失败，请重新选择位置。', 'error');
			},
			{}
		);
	};
	chooseSlot(actions.index ?? slots()[0]?.index ?? 0);
	return {
		updateIcons(entries) {
			updateSlotLabels();
			const byKey = new Map(entries.map(entry => [`${entry.isSkill}:${entry.ID}`, entry]));
			for (const button of choices.children) {
				const entry = byKey.get(button.dataset.key);
				if (!entry) continue;
				const img = button.querySelector('img');
				if (entry.icon && img.getAttribute('src') !== entry.icon) img.src = entry.icon;
				setListItemText(button, entry.name, String(entry.amount));
				if (selected && button.dataset.key === `${selected.isSkill}:${selected.ID}` && entry.icon) {
					$('[data-choice-icon]').src = entry.icon;
					$('[data-choice-icon]').hidden = false;
				}
			}
		}
	};
}
