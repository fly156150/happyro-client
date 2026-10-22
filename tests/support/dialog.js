import { afterEach } from 'vitest';

// Node-only suites have no DOM; renderer suites may replace document with a stub.
const body = globalThis.document?.body;
if (body) {
 // jsdom omits media-query and scrolling APIs supplied by browsers.
 window.matchMedia = query => Object.assign(new EventTarget(), {
  media: query, matches: false, onchange: null,
  addListener(listener) { this.addEventListener('change', listener); },
  removeListener(listener) { this.removeEventListener('change', listener); }
 });
 HTMLElement.prototype.scrollTo = function (left, top) {
  if (typeof left === 'object') { top = left.top; left = left.left; }
  if (left !== undefined) this.scrollLeft = left;
  if (top !== undefined) this.scrollTop = top;
 };
 // jsdom has no top layer; native focus/inert behavior is checked in real browsers.
 HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
 HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
 HTMLElement.prototype.showPopover = function () { this.setAttribute('data-test-popover-open', ''); };
 HTMLElement.prototype.hidePopover = function () { this.removeAttribute('data-test-popover-open'); };
 afterEach(() => body.replaceChildren());
}
