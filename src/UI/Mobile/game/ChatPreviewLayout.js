/** Temporary tablet layout state; never writes the user's collapsed preference. */
export function bindChatPreviewLayout(root, changed) {
 const host = root.host;
 const preview = root.querySelector('.chat-preview');
 const dock = root.querySelector('.battle-dock');
 let frame;
 let cramped = false;
 const update = () => {
  const tablet = host.hasAttribute('data-menu-density') && !host.hasAttribute('data-phone-screen');
  let next = false;
  if (tablet) {
   const bounds = host.getBoundingClientRect();
   const left = preview.getBoundingClientRect().left;
   const dockBounds = dock.getBoundingClientRect();
   const right = dockBounds.width > 0 ? Math.min(bounds.right - 12, dockBounds.left - 12) : bounds.right - 12;
   const available = Math.max(0, Math.floor(right - left));
   preview.style.setProperty('--chat-preview-available-width', `${Math.min(420, available)}px`);
   // A small reopening margin prevents flicker around the readable-width threshold.
   next = available < (cramped ? 256 : 240);
  } else {
   preview.style.removeProperty('--chat-preview-available-width');
  }
  if (next !== cramped) {
   cramped = next;
   changed(cramped);
  }
 };
 const schedule = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(update);
 };
 const size = new ResizeObserver(schedule);
 size.observe(host);
 size.observe(dock);
 const layout = new MutationObserver(schedule);
 layout.observe(host, { attributes: true, attributeFilter: ['data-phone-screen', 'data-menu-density', 'data-menu-arrangement', 'style'] });
 schedule();
 return () => {
  cancelAnimationFrame(frame);
  size.disconnect();
  layout.disconnect();
 };
}
