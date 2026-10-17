/** Native top-layer dialogs own focus, including dialogs inside UI shadow roots. */
export function getFocusedNativeModal(root = document) {
	let element = root.activeElement;
	while (element) {
		const dialog = element.closest('dialog:modal');
		if (dialog) return dialog;
		element = element.shadowRoot?.activeElement;
	}
	return null;
}

let cursorDialog = null;

/** A manual, noninteractive popover paints the existing cursor above the modal. */
export function syncModalCursorLayer(cursor, dialog) {
	if (dialog === cursorDialog) return;
	if (cursor.matches(':popover-open')) cursor.hidePopover();
	if (dialog) cursor.showPopover();
	cursorDialog = dialog;
}

export function isTextCursorTarget(element) {
	return element?.matches('textarea, input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), [contenteditable="true"]') ?? false;
}
