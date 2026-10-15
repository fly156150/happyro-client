/** Drag an inner desktop dialog without moving its full-screen backdrop. */
export function bindDesktopDialogDrag(dialog, header, key, signal) {
 let position;
 try { const value = JSON.parse(localStorage.getItem(key)); if (Number.isFinite(value?.x) && Number.isFinite(value?.y)) position = value; } catch {}
 function restore() {
  if (!position || !dialog.getClientRects().length) return;
  const rect = dialog.getBoundingClientRect();
  const x = Math.max(0, Math.min(position.x, window.innerWidth - rect.width));
  const y = Math.max(0, Math.min(position.y, window.innerHeight - rect.height));
  Object.assign(dialog.style, { position: 'fixed', left: `${x}px`, top: `${y}px` });
 }
 let drag;
 header.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary || event.target.closest('button')) return;
  const rect = dialog.getBoundingClientRect();
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
  header.setPointerCapture(event.pointerId);
  event.preventDefault();
 }, { signal });
 header.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  if (event.clientX === drag.x && event.clientY === drag.y) return;
  position = { x: drag.left + event.clientX - drag.x, y: drag.top + event.clientY - drag.y };
  drag.moved = true;
  restore();
 }, { signal });
 const stop = event => {
  if (!drag || drag.id !== event.pointerId) return;
  if (drag.moved) {
   position = { x: parseFloat(dialog.style.left), y: parseFloat(dialog.style.top) };
   try { localStorage.setItem(key, JSON.stringify(position)); } catch {}
  }
  drag = null;
  if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
 };
 for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) header.addEventListener(type, stop, { signal });
 window.addEventListener('resize', restore, { signal });
 return restore;
}
