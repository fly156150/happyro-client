/** Inline status descriptions; never opens a menu or blocks scene input. */
export function createStatusIconsView(root) {
 const icons = root.querySelector('[data-status-icons]');
 const tooltip = document.createElement('div');
 tooltip.className = 'status-description';
 tooltip.id = 'hud-status-description';
 tooltip.setAttribute('role', 'tooltip');
 tooltip.hidden = true;
 root.append(tooltip);
 const abort = new AbortController();
 let statuses = [], selected = null;
 function hide() {
  selected = null;
  tooltip.hidden = true;
  for (const button of icons.children) button.removeAttribute('aria-describedby');
 }
 function show() {
  const status = statuses.find(item => String(item.id) === selected);
  const button = [...icons.children].find(item => item.dataset.effect === selected);
  if (!status || !button) return hide();
  for (const node of icons.children) node.removeAttribute('aria-describedby');
  button.setAttribute('aria-describedby', tooltip.id);
  tooltip.textContent = [status.title, status.description, status.seconds == null ? '' : `${status.seconds}秒`].filter(Boolean).join('\n');
  tooltip.hidden = false;
  const rect = button.getBoundingClientRect();
  const width = tooltip.offsetWidth, height = tooltip.offsetHeight;
  tooltip.style.left = `${Math.max(8, Math.min(rect.left - width - 5, window.innerWidth - width - 8))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - height - 8))}px`;
 }
 document.addEventListener('pointerdown', event => {
  const path = event.composedPath();
  if (!path.includes(icons) && !path.includes(tooltip)) hide();
 }, { signal: abort.signal });
 root.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); }, { signal: abort.signal });
 window.addEventListener('resize', hide, { signal: abort.signal });
 icons.addEventListener('scroll', hide, { signal: abort.signal });
 return {
  update(next) {
   statuses = next;
   const ids = new Set(statuses.map(status => String(status.id)));
   for (const node of [...icons.children]) if (!ids.has(node.dataset.effect)) node.remove();
   for (const [index, status] of statuses.entries()) {
    const id = String(status.id);
    let button = [...icons.children].find(node => node.dataset.effect === id);
    if (!button) {
     button = document.createElement('button');
     button.type = 'button';
     button.className = 'status-effect';
     button.dataset.effect = id;
     button.onclick = () => { if (selected === id) hide(); else { selected = id; show(); } };
    }
    button.setAttribute('aria-label', `${status.title}${status.seconds == null ? '' : ` · ${status.seconds}秒`}`);
    if (button.dataset.icon !== (status.icon || '')) {
     button.dataset.icon = status.icon || '';
     button.replaceChildren();
     if (status.icon) {
      const img = document.createElement('img');
      img.src = status.icon;
      img.alt = '';
      button.append(img);
     }
    }
    if (icons.children[index] !== button) icons.insertBefore(button, icons.children[index] || null);
   }
   if (selected !== null) show();
  },
  hide,
  destroy() { abort.abort(); tooltip.remove(); }
 };
}
