/** One labelled capsule switch shared by companion settings. */
export function createCompanionSwitch(text, accessibleLabel = text) {
	const control = document.createElement('label');
	control.className = 'companion-switch-control';
	const input = document.createElement('input');
	input.type = 'checkbox';
	input.setAttribute('role', 'switch');
	input.setAttribute('aria-label', accessibleLabel);
	const label = document.createElement('span');
	label.textContent = text;
	control.append(input, label);
	return control;
}

export function updateCompanionSwitch(input, { checked, disabled, text, title }) {
	input.checked = Boolean(checked);
	input.disabled = Boolean(disabled);
	if (input.nextElementSibling.textContent !== text) input.nextElementSibling.textContent = text;
	input.parentElement.title = title;
}
