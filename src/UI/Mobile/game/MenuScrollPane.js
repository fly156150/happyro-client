/** Keep the content node stable: selection, listeners and scroll restoration own it. */
export function frameMenuScroll(area, { kind = '', borderless = false } = {}) {
 const frame = document.createElement('div');
 frame.className = 'menu-scroll-frame';
 if (kind) frame.dataset.paneKind = kind;
 if (borderless) frame.classList.add('menu-scroll-frame--inset');
 area.before(frame);
 frame.append(area);
 area.classList.add('menu-scroll-area');
 return frame;
}

export function frameMenuSplit(body) {
 for (const [selector, kind] of [['.inventory-layout > .inventory-list', 'list'], ['.inventory-layout > .inventory-detail', 'detail']]) {
  for (const area of body.querySelectorAll(selector)) frameMenuScroll(area, { kind });
 }
}
