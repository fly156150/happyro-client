import { requestGameToolsNumber } from './GameToolsNumberPrompt.js';
import { createItemDropSources } from './ItemDropSources.js';
import Client from 'Core/Client.js';
import DB from 'DB/DBManager.js';
import { showToast } from 'UI/Components/Toast.js';
import {
	grantAdventureItem,
	grantAdventureZeny,
	loadAdventureAsset,
	searchAdventureItems
} from './AdventureControlService.js';
import { escapeCatalogHtml } from './CatalogData.js';
import { toPlainRagnarokText } from '../../../Utils/RagnarokText.js';
import { requestConfirmation } from 'UI/Components/Confirmation.js';
import { renderGameSelect, setGameSelectOptions } from './GameSelect.js';
import { mountRemoteCatalogBrowser } from './RemoteCatalogBrowser.js';

const typeNames = {
	Healing: '恢复品',
	Usable: '消耗品',
	Etc: '其他',
	Weapon: '武器',
	Armor: '防具',
	Card: '卡片',
	PetEgg: '宠物蛋',
	PetArmor: '宠物装备',
	Ammo: '弹药',
	Cash: '商城物品'
};
const weaponSubtypeNames = {
	Dagger: '短剑',
	'1hSword': '单手剑',
	'2hSword': '双手剑',
	'1hSpear': '单手矛',
	'2hSpear': '双手矛',
	'1hAxe': '单手斧',
	'2hAxe': '双手斧',
	Mace: '钝器',
	Staff: '单手杖',
	'2hStaff': '双手杖',
	Bow: '弓',
	Katar: '拳刃',
	Book: '书',
	Knuckle: '拳套',
	Musical: '乐器',
	Whip: '鞭子',
	Huuma: '风魔飞镖',
	Revolver: '左轮手枪',
	Rifle: '步枪',
	Gatling: '加特林机枪',
	Shotgun: '霰弹枪',
	Grenade: '榴弹发射器'
};
const armorSlotNames = {
	Head_Top: '头上',
	Head_Mid: '头中',
	Head_Low: '头下',
	Head: '头部',
	Armor: '衣服',
	Garment: '披肩',
	Shoes: '鞋子',
	Shield: '盾',
	Accessory: '饰品',
	Right_Accessory: '右饰品',
	Left_Accessory: '左饰品',
	Costume_Head_Top: '时装头上',
	Costume_Head_Mid: '时装头中',
	Costume_Head_Low: '时装头下',
	Costume_Head: '时装头部',
	Costume_Garment: '时装披肩'
};
const cardSubtypeNames = {
	Enchant: '附魔',
	...armorSlotNames,
	Weapon: '武器',
	Any: '任意部位'
};

function subtypeOptions(type, available = []) {
	const names =
		type === 'Weapon'
			? weaponSubtypeNames
			: type === 'Armor'
				? armorSlotNames
				: type === 'Card'
					? cardSubtypeNames
					: null;
	if (!names || !available.length) {
		return { disabled: true, options: [{ value: '', label: '子类' }] };
	}
	return {
		disabled: false,
		options: [
			{ value: '', label: '全部子类' },
			...Object.entries(names).filter(([value]) => available.includes(value)).map(([value, label]) => ({ value, label }))
		]
	};
}
const errorMessages = {
	inventory_full: '背包空间不足',
	inventory_overweight: '背包负重不足',
	item_amount_exceeded: '数量超过堆叠上限',
	item_not_found: '物品不存在或当前服务端不可用',
	item_not_grantable: '该特殊物品暂不支持直接发放',
	character_offline: '当前角色不在线'
};
function loadImage(element, path, assetUrls) {
	const frame = element.parentElement;
	if (!path) {
		frame?.classList.add('no-image');
		return;
	}
	const cached = assetUrls.get(path);
	if (cached) {
		frame?.classList.remove('no-image');
		element.src = cached;
		return;
	}
	loadAdventureAsset(path.replace('/api/adventure-tools', ''))
		.then(url => {
			assetUrls.set(path, url);
			if (element.isConnected) {
				frame?.classList.remove('no-image');
				element.src = url;
			}
		})
		.catch(() => frame?.classList.add('no-image'));
}

function renderDescription(value) {
	const lines = Array.isArray(value) ? value : [value];
	return (
		lines
			.filter(Boolean)
			.map(line => `<p>${escapeCatalogHtml(toPlainRagnarokText(line))}</p>`)
			.join('') || '<p>暂无说明</p>'
	);
}

function mount(container, context = {}) {
	container.classList.add('world-catalog-tab', 'item-catalog-tab');
	const assetUrls = new Map();
	const dropSources = createItemDropSources(context);
	const availableSubtypes = new Map();
	let pending = null;
	let amountValue = '1';
	let active = true;
	let browserApi;
	const clearFeedback = () => browserApi?.refreshDetail();
	function loadPortrait(element, item) {
		const ordinaryImage = () => {
			if (active && element.isConnected) loadImage(element, item.illustration || item.icon, assetUrls);
		};
		const illustration = item.Type === 'Card' && DB.getItemInfo(item.Id).illustResourcesName;
		if (!illustration) {
			ordinaryImage();
			return;
		}
		Client.loadFile(`${DB.INTERFACE_PATH}cardbmp/${illustration}.bmp`, url => {
			if (active && element.isConnected) {
				element.parentElement.classList.add('has-card-art');
				element.src = url;
			}
		}, ordinaryImage);
	}
	function updateSubtypeOptions(type) {
		const root = container.querySelector('.item-subtype-filter[data-game-select]');
		const current = root.querySelector('.game-select-value').value;
		const { disabled, options } = subtypeOptions(type, availableSubtypes.get(type));
		const keep = !disabled && options.some(option => option.value === current);
		setGameSelectOptions(root, {
			options,
			value: keep ? current : '',
			disabled,
			ariaLabel: '子类'
		});
	}
	function renderActions(detail, item) {
		const allowed = Boolean(context.capabilities?.itemGrantAllowed);
		const panel = document.createElement('div');
		panel.className = 'catalog-action-panel item-grant-panel';
		panel.innerHTML = `<label class="item-grant-quantity"><span aria-hidden="true">数量</span><input aria-label="数量" class="item-grant-amount" type="number" inputmode="numeric" min="1" max="2147483647" step="1"></label><button class="zeny-grant-open" type="button">发放 Zeny</button><button class="item-grant" type="button">发放物品</button><span class="catalog-status error" role="status" aria-live="polite"></span>`;
		const input = panel.querySelector('.item-grant-amount');
		if (context.mobile) input.closest('label').remove();
		input.value = amountValue;
		input.disabled = Boolean(pending);
		input.addEventListener('input', () => {
			amountValue = input.value;
		});
		const zeny = panel.querySelector('.zeny-grant-open');
		const grant = panel.querySelector('.item-grant');
		zeny.disabled = Boolean(pending) || !allowed;
		grant.disabled = Boolean(pending) || !allowed || !item?.grantable;
		panel.querySelector('.catalog-status').textContent = !allowed
			? '当前账号没有发放权限'
			: item && !item.grantable
				? '该特殊物品暂不支持直接发放'
				: '';
		zeny.addEventListener('click', () => void grantAmount('zeny', item, input));
		grant.addEventListener('click', () => void grantAmount('item', item, input));
		detail.append(panel);
	}
	async function grantAmount(kind, item, input) {
		if (pending || !active || !context.capabilities?.itemGrantAllowed || (kind === 'item' && !item?.grantable))
			return;
		if (!context.mobile) amountValue = input.value;
		let amount = Number(amountValue);
		const max = kind === 'zeny' ? 2147483647 : 30000;
		if (!context.mobile && (!Number.isInteger(amount) || amount < 1 || amount > max)) {
			showToast(container, `请输入 1 至 ${max} 的整数${kind === 'zeny' ? '金额' : '数量'}`, 'error');
			return;
		}
		const name = item?.names?.['zh-CN'] || item?.names?.['en-US'] || item?.AegisName;
		const message =
			kind === 'zeny'
				? `确认向当前角色发放 ${amount.toLocaleString()} Zeny？`
				: `确认向当前角色发放 ${amount} 个“${name}”到背包？`;
		pending = kind;
		browserApi.refreshDetail();
		try {
			if (context.mobile) {
				amount = await requestGameToolsNumber(container, {
					title: kind === 'zeny' ? '发放 Zeny' : `发放“${name}”到背包`,
					label: '数量', value: Math.min(max, Math.max(1, Number(amountValue) || 1)),
					min: 1, max, steps: true
				});
				if (amount === null || !active) return;
				amountValue = String(amount);
			} else if (!(await requestConfirmation(container, message)) || !active) return;
			if (kind === 'zeny') await grantAdventureZeny(amount);
			else await grantAdventureItem(item.Id, amount);
			if (active)
				showToast(
					container,
					kind === 'zeny' ? `已发放 ${amount.toLocaleString()} Zeny` : `已发放 ${amount} 个${name}`,
					'success'
				);
		} catch (error) {
			if (active)
				showToast(
					container,
					error.code === 'zeny_amount_exceeded'
						? '发放后会超过角色 Zeny 持有上限'
						: errorMessages[error.code] || error.message,
					'error'
				);
		} finally {
			pending = null;
			if (active) browserApi.refreshDetail();
		}
	}
	container.addEventListener('game-tools-reset-feedback', clearFeedback);
	return mountRemoteCatalogBrowser(container, {
		placeholder: '搜索中文名、英文名、Aegis 名或 ID',
		searchLabel: '搜索物品',
		filterHtml:
			renderGameSelect({
				name: 'type',
				className: 'catalog-filter',
				ariaLabel: '物品类型',
				value: '',
				options: [
					{ value: '', label: '全部类型' },
					...Object.entries(typeNames).map(([value, label]) => ({ value, label }))
				]
			}) +
			renderGameSelect({
				name: 'subtype',
				className: 'catalog-filter item-subtype-filter',
				ariaLabel: '子类',
				value: '',
				disabled: true,
				options: subtypeOptions('').options
			}) + renderGameSelect({
				name: 'dropKind', className: 'catalog-filter item-drop-filter', ariaLabel: '掉落来源', value: 'all',
				options: [{ value: 'all', label: '全部来源' }, { value: 'normal', label: '普通魔物' }, { value: 'mvp', label: 'MVP' }, { value: 'mini', label: 'Mini' }]
			}),
		emptyDetail: '选择一个物品查看详情',
		pageSize: 30,
		key: item => item.Id,
		async load(query) {
			const result = await searchAdventureItems({
				...query,
				type: query.filters.type,
				subtype: query.filters.subtype,
				dropKind: query.filters.dropKind
			});
			if (active) {
				availableSubtypes.set(query.filters.type, result.subtypes);
				if (container.querySelector('[name=type]').value === query.filters.type) updateSubtypeOptions(query.filters.type);
			}
			return { items: result.data, total: result.total };
		},
		onFiltersChange(filters) {
			updateSubtypeOptions(filters.type);
		},
		onReady(api) {
			browserApi = api;
			api.refreshDetail();
		},
		renderEmptyDetail(detail) {
			detail.innerHTML = '<div class="empty-detail">选择一个物品查看详情</div>';
			renderActions(detail, null);
		},
		renderRow(item, selected) {
			return `<button class="catalog-row${selected?.Id === item.Id ? ' selected' : ''}" type="button" data-catalog-key="${item.Id}">
				<span class="catalog-thumb item-thumb"><img data-item-icon="${item.Id}" alt=""></span>
				<span class="catalog-row-text"><strong>${escapeCatalogHtml(item.names?.['zh-CN'] || item.AegisName)}</strong><small>${escapeCatalogHtml(typeNames[item.Type] || item.Type || '其他')} · ID ${item.Id}</small></span>
			</button>`;
		},
		onListRendered(list, items) {
			list.querySelectorAll('[data-item-icon]').forEach(image => {
				const item = items.find(candidate => candidate.Id === Number(image.dataset.itemIcon));
				loadImage(image, item?.icon, assetUrls);
			});
		},
		renderDetail(detail, item) {
			const name = item.names?.['zh-CN'] || item.names?.['en-US'] || item.AegisName;
			const type = typeNames[item.Type] || item.Type || '其他';
			const weight = Number(item.Weight || 0) / 10;
			const metadata = context.mobile
				? [
						['名称', name],
						['英文名', item.AegisName],
						['编号', item.Id],
						['类型', type],
						['买价', item.Buy ?? '-'],
						['卖价', item.Sell ?? '-'],
						['重量', weight],
						['洞数', item.Slots ?? 0]
					]
				: [
						['类型', type],
						['重量', weight],
						['买 / 卖', `${item.Buy ?? '-'} / ${item.Sell ?? '-'}`],
						['洞数', item.Slots ?? 0]
					];
			detail.innerHTML = `<div class="item-detail-content"><div class="item-overview"><div class="catalog-heading item-heading"><span class="catalog-portrait item-portrait"><img alt="${escapeCatalogHtml(name)}"></span>${context.mobile ? '' : `<div><h3>${escapeCatalogHtml(name)}</h3><p>${escapeCatalogHtml(item.AegisName)} · ID ${item.Id}</p></div>`}</div>
			<div class="catalog-metadata">${metadata.map(([label, value]) => `<div><span>${label}</span><strong>${escapeCatalogHtml(value)}</strong></div>`).join('')}</div>
			</div><div class="item-description">${renderDescription(item.description)}</div><section class="item-drop-sources" aria-label="掉落来源"><div class="item-source-list"></div></section></div>`;
			dropSources.render(detail.querySelector('.item-source-list'), item.Id);
			renderActions(detail, item);
			loadPortrait(detail.querySelector('.item-portrait img'), item);
		},
		cleanup() {
			active = false;
			dropSources.destroy();
			container.removeEventListener('game-tools-reset-feedback', clearFeedback);
			assetUrls.forEach(url => URL.revokeObjectURL(url));
			assetUrls.clear();
		}
	});
}

export default { id: 'items', label: '物品图鉴', capability: 'adminAvailable', mount };
