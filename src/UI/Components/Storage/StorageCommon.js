/**
 * UI/Components/Storage/StorageCommon.js
 *
 * Shared factory for the Character Storage windows.
 *
 * Collapses the Storage version siblings (V0, V3) into a single
 * createStorage(config) factory. Each version file passes its own
 * htmlText/cssText plus capability flags describing its real differences:
 *   - V0 : basic storage window.
 *   - V3 : expanded storage with per-tab filter windows, a search tab and
 *          an order-by selector (PACKETVER >= 20181219).
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import DB from 'DB/DBManager.js';
import ItemType from 'DB/Items/ItemType.js';
import Client from 'Core/Client.js';
import Preferences from 'Core/Preferences.js';
import Renderer from 'Renderer/Renderer.js';
import { bindStorageResize } from './StorageResize.js';
import KEYS from 'Controls/KeyEventHandler.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import 'UI/Elements/Elements.js';
import InputBox from 'UI/Components/InputBox/InputBox.js';
import ItemInfo from 'UI/Components/ItemInfo/ItemInfo.js';
import CartItems from 'UI/Components/CartItems/CartItems.js';
import Inventory from 'UI/Components/Inventory/Inventory.js';
import { mountGameSelects } from 'UI/Components/GameTools/GameSelect.js';

export function createStorage(config) {
	const {
		name,
		htmlText,
		cssText,
		StorageFilter = null,
		hasFilters = false,
		hasSearch = false,
		hasOrderBy = false,
		asyncDragImage = false
	} = config;

	const Component = new GUIComponent(name, cssText);

	Component.render = () => htmlText;

	Component.TAB = {
		ITEM: 0,
		KAFRA: 1,
		ARMOR: 2,
		ARMS: 3,
		AMMO: 4,
		CARD: 5,
		ETC: 6
	};

	const _list = [];
	let capacity = { current: 0, limit: 0 };
	Component.getItems = () => _list.map(item => ({ ...item }));
	Component.getCapacity = () => ({ ...capacity });
	Component.clearItems = () => {
		_list.length = 0;
		capacity = { current: 0, limit: 0 };
		const content = Component.getRoot().querySelector('.container .content');
		if (content) content.replaceChildren();
	};

	let _openFilters = {};
	let _searchTerm = '';

	const _preferences = Preferences.get(
		'Storage',
		{
			x: 200,
			y: 500,
			height: 8,
			tab: Component.TAB.ITEM
		},
		1.0
	);

	function getItemTab(item) {
		switch (item.type) {
			case ItemType.HEALING:
			case ItemType.USABLE:
			case ItemType.DELAYCONSUME:
				return Component.TAB.ITEM;
			case ItemType.CASH:
				return Component.TAB.KAFRA;
			case ItemType.ARMOR:
			case ItemType.SHADOWGEAR:
			case ItemType.PETEGG:
				return Component.TAB.ARMOR;
			case ItemType.WEAPON:
			case ItemType.PETARMOR:
				return Component.TAB.ARMS;
			case ItemType.AMMO:
				return Component.TAB.AMMO;
			case ItemType.CARD:
				return Component.TAB.CARD;
			default:
				return Component.TAB.ETC;
		}
	}

	Component.init = function init() {
		const root = this.getRoot();

		const tabButtons = root.querySelectorAll('.tabs button');
		tabButtons.forEach((btn, idx) => {
			btn.addEventListener('mousedown', () => onSwitchTab(idx));
			btn.classList.toggle('active', idx === _preferences.tab);
		});

		const extendBtn = root.querySelector('.footer .extend');
		if (extendBtn) {
			bindStorageResize(extendBtn, {
				getRows: () => Math.round(parseFloat(root.querySelector('.container .content').style.height) / 32),
				resize: resizeHeight, minimum: 8, maximum: 17
			});
		}

		const closeBtn = root.querySelector('.footer .close');
		if (closeBtn) {
			closeBtn.addEventListener('mousedown', e => e.stopImmediatePropagation());
			closeBtn.addEventListener('click', () => {
				if (typeof Component.onClosePressed === 'function') {
					Component.onClosePressed();
				}
			});
		}

		if (hasFilters) {
			const filterButtons = root.querySelectorAll('.filter-buttons > button');
			filterButtons.forEach(btn => {
				btn.addEventListener('mousedown', e => e.stopImmediatePropagation());
				btn.addEventListener('click', () => onFilterWindowOpen(btn));
				btn.addEventListener('mouseover', () => onFilterWindowHover(btn, root));
				btn.addEventListener('mouseout', () => onFilterWindowHoverOut(root));
			});
		}

		if (hasSearch) {
			const searchBtn = root.querySelector('.search-button');
			if (searchBtn) {
				searchBtn.addEventListener('mousedown', e => e.stopImmediatePropagation());
				searchBtn.addEventListener('click', () => Component.onSearch());
			}
		}

		if (hasOrderBy) {
			mountGameSelects(root);
			const orderBySelect = root.querySelector('.storage-order-by');
			if (orderBySelect) {
				orderBySelect.addEventListener('change', () => requestFilter());
			}
		}

		resizeHeight(_preferences.height);

		const content = root.querySelector('.container .content');
		if (content) {
			content.addEventListener('wheel', e => onScroll(e, content));
			content.addEventListener('mouseover', e => {
				const itemEl = e.target.closest('.item');
				if (itemEl) {
					onItemOver(itemEl, root);
				}
			});
			content.addEventListener('mouseout', e => {
				const itemEl = e.target.closest('.item');
				if (itemEl) {
					onItemOut(root);
				}
			});
			content.addEventListener('dragstart', e => {
				const itemEl = e.target.closest('.item');
				if (itemEl) {
					onItemDragStart(e, itemEl);
					onItemOut(root);
				}
			});
			content.addEventListener('dragend', e => {
				const itemEl = e.target.closest('.item');
				if (itemEl) {
					onItemDragEnd();
				}
			});
			content.addEventListener('contextmenu', e => {
				const itemEl = e.target.closest('.item');
				if (itemEl) {
					e.preventDefault();
					onItemInfo(e, itemEl);
				}
			});
		}

		this._host.addEventListener('drop', e => onDrop(e));
		this._host.addEventListener('dragover', e => {
			e.stopImmediatePropagation();
			e.preventDefault();
		});

		this.draggable('.titlebar');
		this.ui.hide();
	};

	Component.onAppend = function onAppend() {
		this.ui.show();
		const rect = this._host.getBoundingClientRect();
		const left = Math.max(0, (Renderer.width - rect.width) / 2);
		const top = Math.max(0, (Renderer.height - rect.height) / 2);
		this._host.style.left = `${left}px`;
		this._host.style.top = `${top}px`;

		const inventory = Inventory.getUI();
		if (!inventory.__active) inventory.append();
		inventory._host.style.display = '';
		const inventoryRect = inventory._host.getBoundingClientRect();
		inventory._host.style.left = `${Math.max(0, left - inventoryRect.width - 8)}px`;
		inventory._host.style.top = `${top}px`;
	};

	Component.onRemove = function onRemove() {
		const root = this.getRoot();
		const content = root.querySelector('.container .content');
		if (content) {
			content.innerHTML = '';
		}
		_list.length = 0;

		_preferences.y = parseInt(this._host.style.top, 10);
		_preferences.x = parseInt(this._host.style.left, 10);
		_preferences.height = Math.round(parseFloat(root.querySelector('.container .content').style.height) / 32);
		_preferences.save();

		if (hasFilters) {
			for (const tabId in _openFilters) {
				if (_openFilters.hasOwnProperty(tabId)) {
					_openFilters[tabId].remove();
				}
			}
			_openFilters = {};
		}

		if (hasSearch) {
			const searchInput = root.querySelector('#storage-search-input');
			if (searchInput) {
				searchInput.value = '';
			}
		}
	};

	Component.setItems = function setItems(items) {
		for (let i = 0, count = items.length; i < count; ++i) {
			if (this.addItemSub(items[i])) {
				_list.push(items[i]);
			}
		}
		reorderVisibleItems();
	};

	Component.addItem = function addItem(item) {
		const i = getItemIndexById(item.index);

		if (hasFilters) {
			const itemTab = getItemTab(item);
			if (_openFilters[itemTab]) {
				_openFilters[itemTab].addItem(item);
			}
		}

		if (hasSearch && _openFilters[ItemType.SEARCH] && DB.getItemName(item).toLowerCase().includes(_searchTerm)) {
			_openFilters[ItemType.SEARCH].addItem(item);
		}

		if (i > -1) {
			_list[i].count += item.count;
			const root = this.getRoot();
			const countEl = root.querySelector(`.item[data-index="${item.index}"] .count`);
			if (countEl) {
				countEl.textContent = _list[i].count;
			}
			return;
		}

		if (this.addItemSub(item)) {
			_list.push(item);
		}
		reorderVisibleItems();
	};

	Component.addItemSub = function addItemSub(item) {
		const tab = getItemTab(item);

		if (tab === _preferences.tab) {
			const it = DB.getItemInfo(item.ITID);
			const root = this.getRoot();
			const content = root.querySelector('.container .content');

			const itemEl = document.createElement('div');
			itemEl.className = 'item';
			itemEl.setAttribute('data-index', item.index);
			itemEl.setAttribute('draggable', 'true');

			const iconDiv = document.createElement('div');
			iconDiv.className = 'icon';
			itemEl.appendChild(iconDiv);

			const amountDiv = document.createElement('div');
			amountDiv.className = 'amount';
			if (item.count) {
				const countSpan = document.createElement('span');
				countSpan.className = 'count';
				countSpan.textContent = item.count;
				amountDiv.appendChild(countSpan);
				amountDiv.appendChild(document.createTextNode(' '));
			}
			itemEl.appendChild(amountDiv);

			const nameSpan = document.createElement('span');
			nameSpan.className = 'name';
			nameSpan.innerHTML = DB.getItemName(item);
			itemEl.appendChild(nameSpan);

			if (content) {
				content.appendChild(itemEl);
			}

			Client.loadFile(
				`${DB.INTERFACE_PATH}item/${item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName}.bmp`,
				data => {
					const icon = root.querySelector(`.item[data-index="${item.index}"] .icon`);
					if (icon) {
						icon.style.backgroundImage = `url(${data})`;
					}
				}
			);
		}

		return true;
	};

	Component.removeItem = function removeItem(index, count) {
		const i = getItemIndexById(index);

		if (i < 0) {
			return null;
		}

		if (hasFilters) {
			for (const tabId in _openFilters) {
				if (_openFilters.hasOwnProperty(tabId)) {
					_openFilters[tabId].removeItem(index, count);
				}
			}
		}

		const root = this.getRoot();
		if (_list[i].count) {
			_list[i].count -= count;

			if (_list[i].count > 0) {
				const countEl = root.querySelector(`.item[data-index="${index}"] .count`);
				if (countEl) {
					countEl.textContent = _list[i].count;
				}
				return _list[i];
			}
		}

		const item = _list[i];
		_list.splice(i, 1);
		const el = root.querySelector(`.item[data-index="${index}"]`);
		if (el) {
			el.remove();
		}

		if (hasFilters) {
			const overlay = root.querySelector('.overlay');
			if (overlay) {
				overlay.style.display = 'none';
			}
		}

		return item;
	};

	Component.setItemInfo = function setItemInfo(current, limit) {
		capacity = { current, limit };
		const root = this.getRoot();
		const currentEl = root.querySelector('.footer .current');
		const limitEl = root.querySelector('.footer .limit');
		if (currentEl) {
			currentEl.textContent = current;
		}
		if (limitEl) {
			limitEl.textContent = limit;
		}
	};

	Component.onKeyDown = function onKeyDown(event) {
		if (this._host.style.display === 'none') {
			return;
		}

		if (event.which === KEYS.ESCAPE || event.key === 'Escape') {
			if (typeof Component.onClosePressed === 'function') {
				Component.onClosePressed();
			}
		}

		if (hasSearch && (event.which === KEYS.ENTER || event.key === 'Enter')) {
			if (this.getRoot().activeElement?.id === 'storage-search-input') {
				event.preventDefault();
				Component.onSearch();
			}
		}
	};

	if (hasSearch) {
		Component.onSearch = function onSearch() {
			const root = this.getRoot();
			const searchInput = root.querySelector('#storage-search-input');
			if (!searchInput) {
				return;
			}
			_searchTerm = searchInput.value.trim().toLowerCase();

			const filteredItems = orderedItems().filter(item => {
				return DB.getItemName(item).toLowerCase().indexOf(_searchTerm) > -1;
			});

			if (!_openFilters[ItemType.SEARCH]) {
				const newFilter = UIManager.addComponent(new StorageFilter(ItemType.SEARCH));
				_openFilters[ItemType.SEARCH] = newFilter;

				newFilter.onCloseCallback = function () {
					if (_openFilters[ItemType.SEARCH]) {
						delete _openFilters[ItemType.SEARCH];
					}
				};

				newFilter.onTransferItemToOtherUI = function (item) {
					Component.transferItemToOtherUI(item);
				};

				newFilter.onStorageDrop = onDrop;
				newFilter.append();
				positionFilterWindow(newFilter);
				newFilter.setItems('搜索结果', filteredItems, ItemType.SEARCH);
			} else {
				_openFilters[ItemType.SEARCH].setItems('搜索结果', filteredItems, ItemType.SEARCH);
				_openFilters[ItemType.SEARCH].focus();
			}
		};
	}

	function resizeHeight(height) {
		height = Math.min(Math.max(height, 8), 17);

		const root = Component.getRoot();
		const content = root.querySelector('.container .content');
		if (content) {
			content.style.height = `${height * 32}px`;
		}
		Component._host.style.height = `${31 + 19 + height * 32}px`;
	}

	function onSwitchTab(idx) {
		_preferences.tab = idx;
		const root = Component.getRoot();
		root.querySelectorAll('.tabs button').forEach((button, buttonIndex) => {
			button.classList.toggle('active', buttonIndex === idx);
		});
		requestFilter();
	}

	function onDrop(event) {
		event.preventDefault();
		let data;

		try {
			data = JSON.parse(event.dataTransfer.getData('Text'));
		} catch (_e) {
			// Ignore parsing error
		}

		event.stopImmediatePropagation();

		if (!data || data.type !== 'item' || (data.from !== 'Inventory' && data.from !== 'CartItems')) {
			return false;
		}

		const item = data.data;

		if (item.count > 1) {
			InputBox.append();
			InputBox.setType('number', false, item.count);
			InputBox.onSubmitRequest = function OnSubmitRequest(count) {
				InputBox.remove();

				if (data.from === 'CartItems') {
					Component.reqAddItemFromCart(item.index, parseInt(count, 10));
				} else {
					Component.reqAddItem(item.index, parseInt(count, 10));
				}
			};

			return false;
		}

		if (data.from === 'CartItems') {
			Component.reqAddItemFromCart(item.index, 1);
		} else {
			Component.reqAddItem(item.index, 1);
		}

		return false;
	}

	function requestFilter() {
		const root = Component.getRoot();
		const content = root.querySelector('.container .content');
		if (content) {
			content.innerHTML = '';
		}

		const list = orderedItems();
		for (const item of list) Component.addItemSub(item);
		sortFilterWindows(list);
	}

	function orderedItems() {
		const order = hasOrderBy ? Component.getRoot().querySelector('.storage-order-by').value : 'BASE';
		if (order === 'BASE') return _list;
		return _list.slice().sort((a, b) => {
			const comparison = DB.getItemName(a).localeCompare(DB.getItemName(b));
			return order === 'NAME_DESC' ? -comparison : comparison;
		});
	}

	function sortFilterWindows(items) {
		for (const filter of Object.values(_openFilters)) filter.orderItems(items);
	}

	function reorderVisibleItems() {
		const items = orderedItems();
		const content = Component.getRoot().querySelector('.container .content');
		for (const item of items) {
			const element = content.querySelector(`.item[data-index="${item.index}"]`);
			if (element) content.appendChild(element);
		}
		sortFilterWindows(items);
	}

	function getItemIndexById(index) {
		for (let i = 0, count = _list.length; i < count; ++i) {
			if (_list[i].index === index) {
				return i;
			}
		}
		return -1;
	}

	function onScroll(event, contentEl) {
		let delta;

		if (event.wheelDelta) {
			delta = event.wheelDelta / 120;
		} else if (event.detail) {
			delta = -event.detail;
		} else if (event.deltaY) {
			delta = -event.deltaY / 100;
		}

		contentEl.scrollTop = Math.floor(contentEl.scrollTop / 32) * 32 - delta * 32;
		event.preventDefault();
	}

	function positionFilterWindow(filter) {
		const anchor = Component._host.getBoundingClientRect();
		const rect = filter._host.getBoundingClientRect();
		const gap = 8;
		let left = anchor.right + gap;
		if (left + rect.width > Renderer.width) {
			left = anchor.left - rect.width - gap;
			if (left < 0) left = anchor.left + 24;
		}
		const offset = (Object.keys(_openFilters).length - 1) * 24;
		filter._host.style.left = `${Math.max(0, Math.min(left, Renderer.width - rect.width))}px`;
		filter._host.style.top = `${Math.max(0, Math.min(anchor.top + offset, Renderer.height - rect.height))}px`;
	}

	function onFilterWindowOpen(button) {
		const tabId = parseInt(button.getAttribute('data-tab-id'), 10);
		const title = button.getAttribute('data-title') || '物品';

		button.classList.toggle('active');

		if (_openFilters[tabId]) {
			_openFilters[tabId].remove();
			delete _openFilters[tabId];
			return;
		}

		const filtered_list = orderedItems().filter(item => getItemTab(item) === tabId);

		const newFilter = UIManager.addComponent(new StorageFilter(tabId));
		_openFilters[tabId] = newFilter;

		newFilter.onCloseCallback = function () {
			button.classList.remove('active');

			if (_openFilters[tabId]) {
				delete _openFilters[tabId];
			}
		};

		newFilter.onTransferItemToOtherUI = function (item) {
			Component.transferItemToOtherUI(item);
		};

		newFilter.onStorageDrop = onDrop;
		newFilter.append();
		positionFilterWindow(newFilter);
		newFilter.setItems(title, filtered_list, tabId);
	}

	function onFilterWindowHover(button, root) {
		const title = button.getAttribute('data-title');
		const overlay = root.querySelector('.overlay');
		if (overlay) {
			overlay.textContent = title;
			const height = Component._host.getBoundingClientRect().height;
			overlay.style.top = `${height - 50}px`;
			overlay.style.left = `${button.offsetLeft}px`;
			overlay.style.display = '';
		}
	}

	function onFilterWindowHoverOut(root) {
		const overlay = root.querySelector('.overlay');
		if (overlay) {
			overlay.style.display = 'none';
		}
	}

	function onItemOver(itemEl, root) {
		const idx = parseInt(itemEl.getAttribute('data-index'), 10);
		const i = getItemIndexById(idx);

		if (i < 0) {
			return;
		}

		const item = _list[i];
		const overlay = root.querySelector('.overlay');

		if (overlay) {
			overlay.style.display = '';
			overlay.style.top = `${itemEl.offsetTop - 10}px`;
			overlay.style.left = `${itemEl.offsetLeft + 35}px`;
			overlay.innerHTML = `${DB.getItemName(item)} ${item.count || 1} 个`;

			if (item.IsIdentified) {
				overlay.classList.remove('grey');
			} else {
				overlay.classList.add('grey');
			}
		}
	}

	function onItemOut(root) {
		const overlay = root.querySelector('.overlay');
		if (overlay) {
			overlay.style.display = 'none';
		}
	}

	function onItemDragStart(event, itemEl) {
		const index = parseInt(itemEl.getAttribute('data-index'), 10);
		const i = getItemIndexById(index);

		if (i === -1) {
			return;
		}

		const img = new Image();
		let url = itemEl.firstChild.style.backgroundImage.match(/\(([^)]+)/)[1];
		url = url.replace(/^"/, '').replace(/"$/, '');
		if (asyncDragImage) {
			img.decoding = 'async';
		}
		img.src = url;

		event.dataTransfer.setDragImage(img, 12, 12);
		event.dataTransfer.setData(
			'Text',
			JSON.stringify(
				(window._OBJ_DRAG_ = {
					type: 'item',
					from: 'Storage',
					data: _list[i]
				})
			)
		);
	}

	function onItemDragEnd() {
		delete window._OBJ_DRAG_;
	}

	function onItemInfo(event, itemEl) {
		event.stopImmediatePropagation();

		const index = parseInt(itemEl.getAttribute('data-index'), 10);
		const i = getItemIndexById(index);

		if (i === -1) {
			return false;
		}

		if (event.altKey && event.which === 3) {
			event.stopImmediatePropagation();
			Component.transferItemToOtherUI(_list[i]);
			return false;
		}

		if (ItemInfo.uid === _list[i].ITID) {
			ItemInfo.remove();
		}

		ItemInfo.append();
		ItemInfo.uid = _list[i].ITID;
		ItemInfo.setItem(_list[i]);

		return false;
	}

	Component.transferItemToOtherUI = function transferItemToOtherUI(item) {
		const isInventoryOpen = Inventory.getUI().ui ? Inventory.getUI().ui.is(':visible') : false;
		const isCartOpen = CartItems.ui ? CartItems.ui.is(':visible') : false;

		if (!item) {
			return false;
		}

		const count = item.count || 1;

		if (isInventoryOpen) {
			Component.reqRemoveItem(item.index, count);
		} else if (isCartOpen) {
			Component.reqMoveItemToCart(item.index, count);
		}

		return true;
	};

	Component.onClosePressed = function onClosedPressed() {};
	Component.reqAddItem = function reqAddItem() {};
	Component.reqAddItemFromCart = function reqAddItemFromCart() {};
	Component.reqRemoveItem = function reqRemoveItem() {};
	Component.reqMoveItemToCart = function reqMoveItemToCart() {};

	Component.mouseMode = GUIComponent.MouseMode.STOP;

	return UIManager.addComponent(Component);
}
