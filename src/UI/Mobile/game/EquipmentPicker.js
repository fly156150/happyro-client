import { confirmAction } from 'UI/Components/Confirmation.js';

/** One query lifecycle per dialog; obsolete responses cannot restore stale choices. */
export function createEquipmentPicker(body, slot, actions, describe, equip, initialState) {
 const content = document.createElement('div');
 content.className = 'equipment-picker-layout';
 const list = document.createElement('div');
 list.className = 'equipment-picker-list';
 list.setAttribute('aria-label', '可更换装备');
 const preview = document.createElement('div');
 preview.className = 'equipment-picker-preview';
 preview.setAttribute('aria-label', '装备说明');
 content.append(list, preview);
 let choice = null, blocked = false, closed = false, generation = 0, controller, timer;
 let state = initialState, signature = null;
 const dismiss = confirmAction(body, `选择${slot.label}装备`, () => {
  const selected = choice;
  dispose();
  if (selected && !blocked) equip(selected);
 }, { content, bounds: body.closest('.panel'), cancelled: dispose });
 const dialog = content.closest('dialog');
 dialog.setAttribute('aria-label', `选择${slot.label}装备`);
 const confirm = dialog.querySelector('[data-confirm]');
 confirm.disabled = true;
 const retryButton = document.createElement('button');
 retryButton.type = 'button';
 retryButton.className = 'equipment-picker-retry';
 retryButton.textContent = '重试';
 retryButton.hidden = true;
 retryButton.onclick = () => refresh(actions.snapshot(), true);
 dialog.querySelector('.ui-confirm-actions').prepend(retryButton);

 function dispose() {
  closed = true;
  ++generation;
  clearTimeout(timer);
  controller?.abort();
 }
 function message(text, retry = false, target = preview) {
  const label = document.createElement('p');
  label.className = 'equipment-picker-message';
  label.setAttribute('role', 'status');
  label.textContent = text;
  target.replaceChildren(label);
  retryButton.hidden = !retry;
 }
 function select(item, node) {
  choice = item;
  if (blocked) message('当前暂时无法更换装备，请稍后重试', true);
  else preview.replaceChildren(...describe(item, slot, true));
  preview.scrollTop = 0;
  for (const candidate of list.querySelectorAll('.equipment-candidate'))
   candidate.setAttribute('aria-pressed', String(candidate === node));
  confirm.disabled = blocked || Boolean(item.reason);
 }
 function show(items, isBlocked, previous) {
  list.replaceChildren();
  preview.replaceChildren();
  choice = null;
  blocked = isBlocked;
  confirm.disabled = true;
  if (blocked) message('当前暂时无法更换装备，请稍后重试', true);
  else if (!items.length) message('没有符合穿戴条件的装备');
  for (const item of items) {
   const candidate = document.createElement('button');
   candidate.type = 'button';
   candidate.className = 'equipment-candidate';
   candidate.dataset.index = item.index;
   candidate.dataset.id = item.ID;
   const icon = document.createElement('img');
   icon.alt = '';
   icon.hidden = !item.icon;
   if (item.icon) icon.src = item.icon;
   const label = document.createElement('span');
   label.textContent = item.name;
   candidate.append(icon, label);
   candidate.onclick = () => select(item, candidate);
   list.append(candidate);
  }
  const preferred = items.find(item => item.index === previous?.index && item.ID === previous.ID) || items[0];
  if (preferred) [...list.querySelectorAll('.equipment-candidate')]
   .find(node => Number(node.dataset.index) === preferred.index)?.click();
 }
 async function query(items, version, previous) {
  controller = new AbortController();
  try {
   const result = await actions.checkCandidates(slot.key, items, controller.signal);
   if (closed || generation !== version || !dialog.isConnected) return;
   // Snapshot may have changed between frames while the reply was in flight.
   const current = actions.snapshot();
   if (key(current) !== signature) { refresh(current); return; }
   if (result.available.length !== items.length) throw new Error('Incomplete equipment result');
   content.setAttribute('aria-busy', 'false');
   show(items.filter((_, index) => result.available[index]), result.blocked, previous);
  } catch (error) {
   if (closed || generation !== version || !dialog.isConnected) return;
   content.setAttribute('aria-busy', 'false');
   list.replaceChildren();
   message('查询失败，请重试', true);
  }
 }
 function candidates(snapshot) {
  return snapshot.slots.find(entry => entry.key === slot.key)?.candidates || [];
 }
 function key(snapshot) {
  return JSON.stringify([snapshot.eligibilityKey, candidates(snapshot).map(item =>
   [item.index, item.ID, item.count, item.identified, item.damaged, item.reason, item.location, item.sockets])]);
 }
 function refresh(snapshot, force = false) {
  if (closed || !dialog.isConnected) return;
  state = snapshot;
  const next = key(state);
  if (!force && next === signature) {
   const current = candidates(state);
   for (const node of list.querySelectorAll('.equipment-candidate')) {
    const item = current.find(item => item.index === Number(node.dataset.index) && item.ID === Number(node.dataset.id));
    if (!item) continue;
    const icon = node.querySelector('img');
    icon.hidden = !item.icon;
    if (item.icon && icon.getAttribute('src') !== item.icon) icon.src = item.icon;
   }
   return;
  }
  const first = signature === null;
  signature = next;
  const version = ++generation;
  clearTimeout(timer);
  controller?.abort();
  const previous = choice;
  choice = null;
  confirm.disabled = true;
  retryButton.hidden = true;
  list.replaceChildren();
  preview.replaceChildren();
  const items = candidates(state);
  content.setAttribute('aria-busy', String(items.length > 0));
  if (!items.length) { show([], false); return; }
  message('正在检查可穿戴装备…', false, list);
  // Coalesce inventory/status bursts; never query during ordinary HUD redraws.
  if (first || force) void query(items, version, previous);
  else timer = setTimeout(() => void query(items, version, previous), 150);
 }
 refresh(state);
 return { refresh, close() { dispose(); dismiss(); } };
}
