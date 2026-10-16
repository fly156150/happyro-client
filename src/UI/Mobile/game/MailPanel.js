import { createMenuField } from './MenuFormControls.js';
import { createFeedback } from 'UI/Components/Feedback.js';
import { confirmAction } from 'UI/Components/Confirmation.js';
import { createQuantityStepper } from 'UI/Components/QuantityStepper.js';
import ItemType from 'DB/Items/ItemType.js';
import { setListItemText, setListItemIcon } from './ListItemText.js';
import { toPlainRagnarokText } from 'Utils/RagnarokText.js';

/** Mail owns its layout; the service owns server state and transaction validation. */
export function createMailPanel(body, service) {
	let version = -1,
		tab = 0,
		page = 0,
		term = '',
		review = null;
	let dismiss,
		quantityDialog = null,
		itemCategory = 'all',
		itemTerm = '';
	const controls = new Map();
	const node = (parent, tag, className, text) => {
		const element = ['input', 'select'].includes(tag) ? createMenuField(tag) : document.createElement(tag);
		element.className = className;
		if (text !== undefined) element.textContent = text;
		parent.append(element);
		return element;
	};
	body.replaceChildren();
	const feedback = createFeedback(body);
	const toolbar = node(body, 'div', 'mail-toolbar menu-form-row');
	const layout = node(body, 'div', 'mail-layout');
	layout.dataset.menuLayout = 'split';
	const list = node(layout, 'section', 'mail-browser');
	const pane = node(layout, 'section', 'mail-pane');
	const detail = node(pane, 'div', 'mail-detail');
	const footer = node(body, 'div', 'mail-footer menu-footer');
	const pagination = node(footer, 'div', 'mail-pagination menu-action-group');
	const detailFooter = node(footer, 'div', 'mail-actions mail-footer-actions menu-footer--portrait menu-form-row');
	const para = (parent, text, className = 'mail-note') => node(parent, 'p', className, text);
	const heading = (parent, text) => node(parent, 'h3', 'mail-heading', text);
	const actions = parent => node(parent, 'div', 'mail-actions menu-form-row');
	const button = (parent, label, action, disabled = false) => {
		const element = node(parent, 'button', '', label);
		element.type = 'button';
		controls.set(element, disabled);
		element.onclick = () => {
			action();
			update();
		};
		return element;
	};
	const clearReview = () => {
		review = null;
		dismiss?.();
		dismiss = null;
	};
	const field = (parent, label, value, oninput, type = 'text') => {
		const row = node(parent, 'label', 'mail-field menu-form-row');
		node(row, 'span', '', label);
		const input = node(row, type === 'textarea' ? 'textarea' : 'input', '');
		if (type !== 'textarea') input.type = type;
		input.value = value;
		input.oninput = () => {
			clearReview();
			oninput(type === 'number' ? Number(input.value) : input.value);
		};
		controls.set(input, false);
		return input;
	};
	const mailKey = mail => `${mail.openType}:${mail.MailID}`;
	function attachmentRow(parent, item, remove) {
		const card = node(parent, 'div', 'mail-attachment');
		const summary = node(card, 'div', 'mail-attachment-summary');
		summary.dataset.attachmentId = item.ID;
		setListItemIcon(summary, item);
		node(summary, 'span', 'mail-attachment-name', item.name);
		node(summary, 'span', 'mail-attachment-count', `×${item.count}`);
		if (remove) button(summary, '移除', remove);

	}
	function addAttachment(item) {
		const capacity = state => {
			const current = state.inventory.find(entry => entry.index === item.index && entry.ID === item.ID);
			const attached = state.attachments.find(entry => entry.index === item.index);
			return state.allowed && state.writing && current && (attached || state.attachments.length < 5)
				? Math.max(0, Math.min(32767, current.count - (attached?.count || 0)))
				: 0;
		};
		const max = capacity(service.snapshot());
		if (!max) {
			feedback('无法继续添加该物品', 'error');
			return;
		}
		const stepper = createQuantityStepper({
			label: '附件数量',
			min: 1,
			max,
			beforeStep: () => {
				update();
				return Boolean(quantityDialog);
			}
		});
		const finish = () => {
			quantityDialog = null;
			dismiss = null;
		};
		dismiss = confirmAction(
			body,
			`添加「${item.name}」`,
			() => {
				finish();
				const count = Number(stepper.input.value);
				if (!Number.isInteger(count) || count < 1 || count > capacity(service.snapshot())) {
					feedback('数量或物品状态已变化，请重新选择', 'error');
					return;
				}
				service.add(item.index, item.ID, count);
				update();
			},
			{ content: stepper.element, cancelled: finish }
		);
		quantityDialog = { stepper, capacity };
		stepper.input.addEventListener('keydown', event => {
			if (event.key === 'Enter' && !event.isComposing) {
				event.preventDefault();
				body.querySelector('dialog [data-confirm]')?.click();
			}
		});
	}
	function renderCompose(state) {
		button(detailFooter, '取消', () => {
			service.cancelCompose();
			clearReview();
		});
		const filters = node(list, 'div', 'mail-item-filters menu-form-row');
		const search = node(filters, 'input', 'mail-item-search');
		search.type = 'search';
		search.placeholder = '搜索物品名称或 ID';
		search.setAttribute('aria-label', '搜索附件物品');
		search.value = itemTerm;
		search.oninput = () => { itemTerm = search.value; };
		search.onchange = () => {
			list.querySelector('.mail-item-list')?.scrollTo(0, 0);
			render();
			update();
		};
		controls.set(search, false);
		const category = node(filters, 'select', '');
		category.setAttribute('aria-label', '附件物品分类');
		for (const [value, label] of [
			['all', '全部'],
			['usable', '消耗品'],
			['equipment', '装备'],
			['card', '卡片'],
			['other', '其他']
		])
			category.add(new Option(label, value));
		category.value = itemCategory;
		controls.set(category, false);
		category.onchange = () => {
			itemCategory = category.value;
			list.querySelector('.mail-item-list')?.scrollTo(0, 0);
			render();
			update();
		};
		const inventory = node(list, 'div', 'mail-rows mail-item-list');
		const query = itemTerm.trim().toLocaleLowerCase();
		const items = state.inventory.filter(
			item =>
				(!query || item.name.toLocaleLowerCase().includes(query) || String(item.ID).includes(query)) &&
				(itemCategory === 'all' ||
				(itemCategory === 'card'
					? item.type === ItemType.CARD
					: itemCategory === 'other'
						? item.category === 'other' && item.type !== ItemType.CARD
						: item.category === itemCategory))
		);
		for (const item of items) {
			const row = button(inventory, '', () => addAttachment(item));
			row.className = 'inventory-item mail-item';
			row.dataset.itemIndex = item.index;
			row.dataset.itemId = item.ID;
			setListItemIcon(row, item);
			setListItemText(row, item.name, `×${item.count}`);
		}
		if (!items.length) para(inventory, query ? '没有匹配的物品' : '该分类暂无可添加物品', 'mail-empty');
		const form = node(detail, 'div', 'mail-form');
		field(form, '收件人', state.draft.receiver, value => service.change('receiver', value));
		button(form.lastElementChild, '校验', () => service.validate());
		field(form, '标题', state.draft.title, value => service.change('title', value));
		field(form, '正文', state.draft.body, value => service.change('body', value), 'textarea');
		const amount = field(form, 'Zeny', state.draft.zeny, value => service.change('zeny', value), 'number');
		amount.min = 0;
		amount.max = 2147483647;
		amount.inputMode = 'numeric';
		const attachments = node(detail, 'section', 'mail-attachments');
		heading(attachments, `附件（${state.attachments.length}）`);
		const attachmentList = node(attachments, 'div', 'mail-attachment-list');
		for (const item of state.attachments) {
			attachmentRow(attachmentList, item, () => service.remove(item.index, item.count));
		}
		if (!state.attachments.length) para(attachmentList, '暂无附件', 'mail-empty');


		button(detailFooter, '发送邮件', () => {
			review = service.review();
			if (review.error) {
				feedback(review.error, 'error');
				review = null;
				return;
			}
			const requested = review;
			dismiss = confirmAction(
				body,
				`确认发送邮件给「${review.receiver}」？`,
				() => {
					dismiss = null;
					service.send(requested);
					review = null;
					update();
				},
				{}
			);
		});
	}
	function renderInbox(state) {
		const search = node(toolbar, 'input', 'mail-search');
		search.type = 'search';
		search.placeholder = '搜索标题或寄件人';
		search.setAttribute('aria-label', '搜索标题或寄件人');
		search.value = term;
		search.oninput = () => {
			term = search.value;
			page = 0;
		};
		search.onchange = () => {
			render();
			update();
		};
		controls.set(search, false);
		const tools = actions(toolbar);
		const category = node(tools, 'select', 'mail-category');
		category.setAttribute('aria-label', '邮箱分类');
		for (const [value, label] of [
			[0, '个人'],
			[1, '账号'],
			[2, '退回']
		])
			category.add(new Option(label, String(value)));
		category.value = String(tab);
		category.onchange = () => {
			tab = Number(category.value);
			page = 0;
			render();
			update();
		};
		controls.set(category, false);
		button(tools, '刷新', () => {
			clearReview();
			service.refresh();
		});
		const writeRow = node(toolbar, 'div', 'mail-write-row');
		button(writeRow, '写信', () => service.compose()).className = 'mail-primary';
		search.onkeydown = event => {
			if (event.key === 'Enter' && !event.isComposing) {
				event.preventDefault();
				render();
				update();
			}
		};
		const rows = state.list.filter(
			mail => mail.openType === tab && `${mail.title} ${mail.SenderName}`.includes(term)
		);
		const pages = Math.max(1, Math.ceil(rows.length / 8));
		page = Math.min(page, pages - 1);
		const messages = node(list, 'div', 'mail-rows');
		for (const mail of rows.slice(page * 8, page * 8 + 8)) {
			const row = button(messages, '', () => {
				clearReview();
				service.read(mailKey(mail));
			});
			row.className = 'mail-row';
			row.setAttribute('aria-pressed', String(state.selected === mailKey(mail)));
			setListItemText(
				row,
				mail.title || '（无标题）',
				`${mail.Isread ? '' : '未读 · '}${mail.SenderName}${mail.deleting ? ' · 删除中' : ''}`
			);
		}
		if (!rows.length) para(messages, term ? '没有匹配的邮件' : '暂无邮件', 'mail-empty');
		pagination.hidden = false;
		const previous = button(
			pagination,
			'‹',
			() => {
				page--;
				render();
			},
			page === 0
		);
		previous.setAttribute('aria-label', '上一页');

		const next = button(
			pagination,
			'›',
			() => {
				page++;
				render();
			},
			page >= pages - 1
		);
		next.setAttribute('aria-label', '下一页');
		const mail = state.detail;
		if (!mail || mail.openType !== tab) {
			heading(detail, '邮件详情');
			para(detail, '请选择一封邮件查看内容。', 'mail-empty');
			for (const label of ['领取金额', '领取物品', '删除邮件']) button(detailFooter, label, () => {}, true);
			return;
		}
		heading(detail, mail.title || '（无标题）');
		para(detail, `寄件人：${mail.SenderName}`);
		para(detail, toPlainRagnarokText(mail.Textcontent), 'mail-content');
		const attachments = node(detail, 'section', 'mail-attachments');
		heading(attachments, '附加金额与物品');
		para(attachments, `${mail.zeny} Zeny`, 'mail-attachment-name');
		const attachmentList = node(attachments, 'div', 'mail-attachment-list');
		for (const item of mail.describedItems) {
			attachmentRow(attachmentList, item);
		}
		if (!mail.describedItems.length) para(attachmentList, '暂无附件', 'mail-empty');
		if (mail.zeny || mail.ItemList.length) para(attachments, '领取前请预留背包容量和负重。');
		const footer = detailFooter;
		button(footer, '领取金额', () => service.claim('zeny'), !mail.zeny);
		button(footer, '领取物品', () => service.claim('items'), !mail.ItemList.length);
		{
			button(
				footer,
				'删除邮件',
				() => {
					const selected = state.selected;
					dismiss = confirmAction(
						body,
						'确定删除这封邮件？',
						() => {
							dismiss = null;
							if (service.snapshot().selected !== selected) {
								feedback('邮件已变化，请重新确认', 'error');
								return;
							}
							service.delete();
							update();
						},
						{}
					);
				},
				Boolean(mail.zeny || mail.ItemList.length)
			);
		}
	}
	function render() {
		const state = service.snapshot();
		const keepComposeScroll = state.writing && body.dataset.mailWriting === 'true';
		const detailScroll = keepComposeScroll ? detail.scrollTop : 0;
		const inventoryScroll = keepComposeScroll ? list.querySelector('.mail-item-list')?.scrollTop || 0 : 0;
		version = state.revision;
		layout.dataset.writing = String(state.writing);
		body.dataset.mailWriting = String(state.writing);
		controls.clear();
		clearReview();
		toolbar.replaceChildren();
		list.replaceChildren();
		detail.replaceChildren();
		detailFooter.replaceChildren();
		pagination.replaceChildren();
		pagination.hidden = true;
		if (state.writing) renderCompose(state);
		else renderInbox(state);
		// Server replies rebuild compose content; retain both independently scrolled panels.
		detail.scrollTop = detailScroll;
		const inventory = list.querySelector('.mail-item-list');
		if (inventory) inventory.scrollTop = inventoryScroll;
	}
	function update() {
		const state = service.snapshot();
		if (version !== state.revision) render();
		if (quantityDialog) {
			const max = quantityDialog.capacity(state);
			if (!max) clearReview();
			else quantityDialog.stepper.setBounds({ min: 1, max });
		}
		for (const row of list.querySelectorAll('[data-item-index]')) {
			const item = state.inventory.find(
				item => item.index === Number(row.dataset.itemIndex) && item.ID === Number(row.dataset.itemId)
			);
			if (item) setListItemIcon(row, item);
		}
		for (const row of detail.querySelectorAll('[data-attachment-id]')) {
			const item = [...state.attachments, ...(state.detail?.describedItems || [])].find(item => item.ID === Number(row.dataset.attachmentId));
			if (item) setListItemIcon(row, item);
		}
		for (const [control, disabled] of controls) control.disabled = disabled || !state.allowed;
		feedback.update(state.message, state.messageKind);
	}
	render();
	update();
	return { update };
}
