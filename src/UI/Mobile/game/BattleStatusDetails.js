/** A non-modal, viewport-clamped explanation of the compact battle hint. */
export function createBattleStatusDetails(root, onOpen) {
 const button = root.querySelector('[data-target]');
 const status = button.closest('.battle-status');
 const tooltip = document.createElement('div');
 tooltip.className = 'battle-description';
 tooltip.id = 'hud-battle-description';
 tooltip.setAttribute('role', 'tooltip');
 tooltip.hidden = true;
 root.append(tooltip);
 const abort = new AbortController();
 let message = button.textContent;
 button.setAttribute('aria-expanded', 'false');
 function hide() {
  tooltip.hidden = true;
  button.setAttribute('aria-expanded', 'false');
  button.removeAttribute('aria-describedby');
 }
 function show() {
  if (status.hidden || !message) return hide();
  tooltip.textContent = message;
  tooltip.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  button.setAttribute('aria-describedby', tooltip.id);
  const rect = button.getBoundingClientRect();
  const width = tooltip.offsetWidth, height = tooltip.offsetHeight;
  tooltip.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(rect.top - height - 8, window.innerHeight - height - 8))}px`;
 }
 button.addEventListener('click', () => {
  if (tooltip.hidden) { onOpen(); show(); } else hide();
 }, {signal: abort.signal});
 document.addEventListener('pointerdown', event => {
  const path = event.composedPath();
  if (!path.includes(button) && !path.includes(tooltip)) hide();
 }, {capture: true, signal: abort.signal});
 root.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); }, {signal: abort.signal});
 window.addEventListener('resize', hide, {signal: abort.signal});
 return {
  update(text) {
   message = text;
   button.title = text;
   button.setAttribute('aria-label', `${text}，点击查看完整提示`);
   if (!tooltip.hidden) show();
  },
  hide,
  destroy() { abort.abort(); tooltip.remove(); }
 };
}
