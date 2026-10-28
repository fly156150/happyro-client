/** Keep desktop and touch dialogs within their owner and visible viewport. */
export function bindDialogBounds(dialog, container, { bounds, desktopOwner } = {}) {
 const mobileOwner = container.getRootNode().host?.hasAttribute('data-menu-density') ? container.closest('.panel, .mobile-adventure') : null;
 bounds ||= mobileOwner;
 if (mobileOwner) dialog.dataset.mobileBounded = '';
	const owner = bounds || desktopOwner;
	if (!owner) return () => {};
 if (desktopOwner) dialog.dataset.desktopBounded = '';
	const resize = new ResizeObserver(fitBounds);
	function fitBounds() {
		if (!bounds && !desktopOwner) return;
		const ownerRect = (bounds || desktopOwner).getBoundingClientRect();
		const visual = window.visualViewport;
		const top = (mobileOwner || desktopOwner) ? Math.max(ownerRect.top, visual?.offsetTop || 0) : ownerRect.top;
		const left = (mobileOwner || desktopOwner) ? Math.max(ownerRect.left, visual?.offsetLeft || 0) : ownerRect.left;
		const bottom = (mobileOwner || desktopOwner) ? Math.min(ownerRect.bottom, (visual?.offsetTop || 0) + (visual?.height || window.innerHeight)) : ownerRect.bottom;
		const right = (mobileOwner || desktopOwner) ? Math.min(ownerRect.right, (visual?.offsetLeft || 0) + (visual?.width || window.innerWidth)) : ownerRect.right;
		const rect = { top, left, bottom, right, width: Math.max(0, right-left), height: Math.max(0, bottom-top) };
		dialog.style.setProperty('--confirm-center-x', `${rect.left + rect.width / 2}px`);
		dialog.style.setProperty('--confirm-center-y', `${rect.top + rect.height / 2}px`);
		if (desktopOwner) {
			dialog.style.setProperty(
				'--confirm-owner-clip',
				`inset(${rect.top}px ${Math.max(0, window.innerWidth - rect.right)}px ${Math.max(0, window.innerHeight - rect.bottom)}px ${rect.left}px)`
			);
		}
		dialog.style.setProperty('--confirm-max-width', `${rect.width}px`);
		dialog.style.setProperty('--confirm-max-height', `${rect.height}px`);
	}
 if (mobileOwner || desktopOwner) {
  window.addEventListener('resize', fitBounds);
  window.visualViewport?.addEventListener('resize', fitBounds);
  window.visualViewport?.addEventListener('scroll', fitBounds);
 }
 fitBounds();
 resize.observe(owner);
 const removal = new MutationObserver(() => { if (!dialog.isConnected) dispose(); });
 const tree = container.getRootNode();
 removal.observe(tree, { childList: true, subtree: true });
 if (tree !== document) removal.observe(document.body, { childList: true, subtree: true });
 function dispose() {
  removal.disconnect();
  resize.disconnect();
  window.removeEventListener('resize', fitBounds);
  window.visualViewport?.removeEventListener('resize', fitBounds);
  window.visualViewport?.removeEventListener('scroll', fitBounds);
 }
 return dispose;
}
