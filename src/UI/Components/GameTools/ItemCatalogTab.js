import { ensureReadableText } from 'Utils/ReadableText.js';
import { weaponSubtypeNames, armorSlotNames, cardSubtypeNames } from 'UI/Game/ItemSubtypeNames.js';
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
import { formatRagnarokMarkup } from 'Utils/RagnarokText.js';
import { getNaviTarget, handleNaviClick, prepareNaviLinks } from 'UI/Components/Navigation/NaviActionService.js';
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
		return { disabled: true, options: [{ value: '', label: type ? '无子类' : '子类' }] };
	}
	return {
		disabled: false,
		options: [
			{ value: '', label: '子类' },
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
function prepareImage(element) {
 element.style.visibility = 'hidden';
 element.onload = () => {
  element.parentElement?.classList.remove('no-image');
  element.style.visibility = 'visible';
 };
 element.onerror = () => {
  element.style.visibility = 'hidden';
  element.parentElement?.classList.add('no-image');
 };
}
function loadImage(element, path, assetUrls) {
	prepareImage(element);
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
			if (!url) return;
			assetUrls.set(path, url);
			if (element.isConnected) {
				frame?.classList.remove('no-image');
				element.src = url;
			}
		})
		.catch(() => frame?.classList.add('no-image'));
}

function renderDescription(value) {
	// Format the entire description so RO colors continue across source lines.
	const html = formatRagnarokMarkup(value);
	return html.trim() ? `<p>${html}</p>` : '<p>暂无说明</p>';
}

function mount(container, context = {}) {
	const onNavi = event => handleNaviClick(event, (info, label) => {
		const target = getNaviTarget(info);
		if (target.kind === 'monster') context.openMonster(target.monsterId);
		else context.openMap({ id: target.mapName, mapName: target.mapName, x: target.x, y: target.y, name: label });
	});
	container.addEventListener('click', onNavi);
	container.addEventListener('keydown', onNavi);
	container.classList.add('world-catalog-tab', 'item-catalog-tab');
	const assetUrls = new Map();
	const dropSources = createItemDropSources(context);
	const availableSubtypes = new Map();
	const amounts = { item: '1', zeny: '' };
	const resetAmounts = () => { amounts.item = '1'; amounts.zeny = ''; };
	container.addEventListener('game-tools-close', resetAmounts);
	let pending = null;
	let active = true;
	let browserApi;
	const clearFeedback = () => browserApi?.refreshDetail();
	function loadPortrait(element, item) {
		prepareImage(element);
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
		panel.innerHTML = `<button class="zeny-grant-open" type="button">发放 Zeny</button><button class="item-grant" type="button">发放物品</button><span class="catalog-status error" role="status" aria-live="polite"></span>`;
		const zeny = panel.querySelector('.zeny-grant-open');
		const grant = panel.querySelector('.item-grant');
		zeny.disabled = Boolean(pending) || !allowed;
		grant.disabled = Boolean(pending) || !allowed || !item?.grantable;
		panel.querySelector('.catalog-status').textContent = !allowed
			? '当前账号没有发放权限'
			: item && !item.grantable
				? '该特殊物品暂不支持直接发放'
				: '';
		zeny.addEventListener('click', () => void grantAmount('zeny', item));
		grant.addEventListener('click', () => void grantAmount('item', item));
		detail.append(panel);
	}
	async function grantAmount(kind, item) {
		if (pending || !active || !context.capabilities?.itemGrantAllowed || (kind === 'item' && !item?.grantable))
			return;
		const max = kind === 'zeny' ? 2147483647 : 30000;
		const name = item?.names?.['zh-CN'] || item?.names?.['en-US'] || item?.AegisName;
		pending = kind;
		browserApi.refreshDetail();
		try {
			const amount = await requestGameToolsNumber(container, {
				title: kind === 'zeny' ? '向当前角色发放 Zeny' : `发放「${name}」到背包`,
				label: kind === 'zeny' ? '金额' : '数量', value: amounts[kind],
				min: 1, max, steps: true,
				stepMin: kind === 'zeny' ? 0 : 1,
				stepButtons: kind === 'zeny' ? [
					{ delta: -1000000, label: '-100万' }, { delta: -100000, label: '-10万' },
					{ delta: 100000, label: '+10万' }, { delta: 1000000, label: '+100万' }
				] : undefined,
				onChange: value => { amounts[kind] = value; }
			});
			if (amount === null || !active) return;
			amounts[kind] = String(amount);
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
				options: [{ value: 'all', label: '全部来源' }, { value: 'normal', label: '普通魔物来源' }, { value: 'mvp', label: 'MVP 来源' }, { value: 'mini', label: 'Mini 来源' }]
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
			prepareNaviLinks(detail.querySelector('.item-description'));
			queueMicrotask(() => ensureReadableText(detail));
			dropSources.render(detail.querySelector('.item-source-list'), item.Id);
			renderActions(detail, item);
			loadPortrait(detail.querySelector('.item-portrait img'), item);
		},
		cleanup() {
			container.removeEventListener('click', onNavi);
			container.removeEventListener('keydown', onNavi);
			active = false;
			container.removeEventListener('game-tools-close', resetAmounts);
			dropSources.destroy();
			container.removeEventListener('game-tools-reset-feedback', clearFeedback);
			assetUrls.forEach(url => URL.revokeObjectURL(url));
			assetUrls.clear();
		}
	});
}

export default { id: 'items', label: '物品图鉴', capability: 'adminAvailable', mount };
