import { showToast, clearToast } from 'UI/Components/Toast.js';
import Session from 'Engine/SessionStorage.js';
import EntityManager from 'Renderer/EntityManager.js';
import Network from 'Network/NetworkManager.js';
import PACKET from 'Network/PacketStructure.js';
import Emotions from 'DB/Emotions.js';
import StatusState from 'DB/Status/StatusState.js';
import { loadCurrentCharacter, maintainCurrentCharacter } from 'UI/Components/GameTools/AdventureControlService.js';
import { chatEmotions } from './ChatEmotions.js';
import css from './SelfActions.css?raw';
import desktopThemeCSS from 'UI/Components/DesktopLightTheme.css?raw';
import { ridingReason } from 'UI/Components/GameTools/CharacterRiding.js';

const mountMask = ['RIDING', 'DRAGON1', 'DRAGON2', 'DRAGON3', 'DRAGON4', 'DRAGON5', 'WUGRIDER', 'MADOGEAR'].reduce((mask, name) => mask | StatusState.EffectState[name], 0);
const actionIcons = {
 sit: '<circle cx="8" cy="4" r="2"/><path d="m8 8-1 8a3 3 0 0 0 3 3h4l3-6 4 6h2M8 9l4 4h4M6 11l-3 8H1"/>',
 stand: '<circle cx="12" cy="4" r="2"/><path d="M12 8v6m-5-3 5-3 5 3m-5 3-4 7m4-7 4 7"/>',
 emotions: '<circle cx="12" cy="12" r="9"/><path d="M8 14c2 4 6 4 8 0M8 9h.01M16 9h.01"/>',
 mount: '<path d="m6 21 2-7-3-3 5-7 3 2 3-3 1 6 3 4-2 3-5-1-1 6M9 8h.01"/>',
 dismount: '<path d="m6 21 2-7-3-3 5-7 3 2 3-3 1 6 3 4-2 3-5-1-1 6M9 8h.01M15 20h7m-3-3 3 3-3 3"/>'
};
const mounts = ['peco', 'dragon', 'gryphon', 'mado', 'warg_rider'];

/** Map-scoped self controls shared by desktop and mobile. */
export function createSelfActions(parent, stop, { desktop = false } = {}) {
 const host = document.createElement('div');
 host.className = 'self-actions-host';
 host.hidden = true;
 host.toggleAttribute('data-desktop', desktop);
 const root = host.attachShadow({ mode: 'open' });
 root.innerHTML = `<style>${desktop ? desktopThemeCSS : ''}${css}</style><div class="actions"><button data-emotions aria-expanded="false">表情</button><button data-sit>坐下</button><button data-mount hidden>骑乘</button></div><div class="emotions" hidden aria-label="选择表情"><div class="emotion-list"></div></div>`;
 parent.append(host);
 const $ = selector => root.querySelector(selector);
 const abort = new AbortController();
 let owner, selected = false, disposed = false, pending = false, loading = false, ready = false, version = 0, row = null, paletteLoaded = false, ridingSignature;
 const alive = () => Session.Playing && Session.Entity && Session.Entity.action !== Session.Entity.ACTION.DIE;
 const current = () => !disposed && alive() && Session.Entity === owner && (desktop || EntityManager.getFocusEntity() === owner);
 const allowed = () => current() && !Session.FreezeUI;
 function message(text = '') {
  if (text) showToast(host, text, 'error');
  else clearToast(host);
 }
 function closePalette() { $('.emotions').hidden = true; $('[data-emotions]').setAttribute('aria-expanded', 'false'); }
 function accept(snapshot) {
  const rows = (snapshot.riding || []).filter(entry => mounts.includes(entry.kind));
  row = rows.find(entry => entry.active) || rows.find(entry => !entry.reason) || rows[0] || null;
 }
 function labelButton(selector, label, icon, active = false) {
  const button = $(selector);
  button.title = label;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(active));
  if (!desktop) { button.textContent = label; return; }
  if (button.dataset.icon !== icon) {
   button.dataset.icon = icon;
   button.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${actionIcons[icon]}</svg><span class="action-label" aria-hidden="true">${label}</span>`;
  }
 }
 function render() {
  if (!current()) return;
  host.hidden = !ready;
  const sitting = owner.action === owner.ACTION.SIT;
  labelButton('[data-sit]', sitting ? '站起' : '坐下', sitting ? 'stand' : 'sit', sitting);
  labelButton('[data-emotions]', '表情', 'emotions', !$('.emotions').hidden);
  $('[data-mount]').hidden = !row;
  const mountButton = $('[data-mount]');
  const label = row?.active ? '下骑' : '骑乘';
  labelButton('[data-mount]', label, row?.active ? 'dismount' : 'mount', Boolean(row?.active));
  const unavailable = !allowed();
  // Busy requests retain their appearance and focus; the click handler rejects duplicates.
  mountButton.disabled = unavailable;
  mountButton.setAttribute('aria-disabled', String(unavailable || pending || loading));
  mountButton.setAttribute('aria-busy', String(pending || loading));
  for (const button of root.querySelectorAll('[data-sit], [data-emotions]')) button.disabled = !allowed();
  if (!allowed()) closePalette();
 }
 async function load() {
  const token = ++version;
  let failure = '';
  loading = true;
  render();
  try {
   const snapshot = await loadCurrentCharacter();
   if (token !== version || !current()) return;
   accept(snapshot);
  } catch (error) {
   if (token === version && current()) failure = error.message;
  }
  if (token === version) { loading = false; ready = true; render(); if (failure) message(failure); }
 }
 function update() {
  const visible = Boolean(!disposed && alive() && (desktop || EntityManager.getFocusEntity() === Session.Entity));
  if (!visible || owner !== Session.Entity) {
   if (selected) { version++; closePalette(); message(); row = null; }
   selected = false;
   ready = false;
  }
  host.hidden = !visible || !ready;
  if (visible && !selected) {
   owner = Session.Entity;
   selected = true;
   ridingSignature = `${owner._job}:${owner.effectState & mountMask}`;
   void load();
  }
  if (visible && !pending) {
   const signature = `${owner._job}:${owner.effectState & mountMask}`;
   if (signature !== ridingSignature) { ridingSignature = signature; void load(); }
  }
  render();
 }
 $('[data-sit]').addEventListener('click', () => {
  if (!allowed()) return;
  stop();
  const packet = new PACKET.CZ.REQUEST_ACT2();
  packet.action = owner.action === owner.ACTION.SIT ? 3 : 2;
  Network.sendPacket(packet);
 }, { signal: abort.signal });
 $('[data-mount]').addEventListener('click', async () => {
  if (!allowed() || pending || loading || !row) return;
  const chosen = { ...row }, token = version;
  pending = true;
  stop();
  message();
  render();
  try {
   // Re-read eligibility and fee; never apply an old click to a changed mount state.
   const snapshot = await loadCurrentCharacter();
   if (token !== version || !allowed()) return;
   accept(snapshot);
   if (!row || row.kind !== chosen.kind || row.active !== chosen.active) {
    message('坐骑状态已变化，请重新选择');
    return;
   }
   if (row.reason) { message(ridingReason(row)); return; }
   const result = await maintainCurrentCharacter('character.riding.update', {
    kind: row.kind, enabled: !row.active, fee: row.fee, ticket: row.ticket
   });
   if (token === version && current()) accept(result);
  } catch (error) {
   if (token === version && current()) { message(error.message); void load(); }
  } finally { pending = false; render(); }
 }, { signal: abort.signal });
 $('[data-emotions]').addEventListener('click', async () => {
  if (!allowed()) return;
  const palette = $('.emotions');
  if (!palette.hidden) { closePalette(); return; }
  palette.hidden = false;
  $('[data-emotions]').setAttribute('aria-expanded', 'true');
  if (paletteLoaded) return;
  paletteLoaded = true;
  for (const [command, label] of chatEmotions) {
   const button = document.createElement('button');
   button.dataset.emotion = command;
   button.textContent = label;
   button.title = label;
   button.setAttribute('aria-label', label);
   $('.emotion-list').append(button);
  }
  try {
   const { loadChatEmotionImages } = await import('./ChatEmotionImages.js');
   const images = await loadChatEmotionImages();
   if (disposed) return;
   for (const button of $('.emotion-list').children) {
    if (!images[button.dataset.emotion]) continue;
    const img = document.createElement('img');
    img.src = images[button.dataset.emotion]; img.alt = '';
    button.replaceChildren(img);
   }
  } catch { /* Named buttons remain usable when sprite loading fails. */ }
 }, { signal: abort.signal });
 $('.emotions').addEventListener('click', event => {
  const button = event.target.closest('[data-emotion]');
  if (!button || !allowed()) return;
  const packet = new PACKET.CZ.REQ_EMOTION();
  packet.type = Emotions.commands[button.dataset.emotion];
  Network.sendPacket(packet);
  closePalette();
 }, { signal: abort.signal });
 for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'click']) {
  root.addEventListener(type, event => event.stopPropagation(), { signal: abort.signal });
 }
 document.addEventListener('pointerdown', event => {
  if (!event.composedPath().includes(host)) closePalette();
 }, { signal: abort.signal });
 return {
  update,
  destroy() { disposed = true; version++; abort.abort(); clearToast(host); host.remove(); }
 };
}
