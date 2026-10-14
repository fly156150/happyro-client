import { createQuantityStepper } from '../QuantityStepper.js';
import { confirmAction } from 'UI/Components/Confirmation.js';

export function requestGameToolsNumber(container, { title, label, value, min, max, steps = false }) {
	return new Promise(resolve => {
		let content, input;
		if (steps) {
			const stepper = createQuantityStepper({ label: title, value, min, max });
			content = stepper.element;
			input = stepper.input;
		} else {
			content = document.createElement('label');
			content.className = 'ui-confirm-field';
			const caption = document.createElement('span');
			caption.className = 'game-tools-number-label';
			caption.textContent = label;
			input = document.createElement('input');
			Object.assign(input, { type: 'number', min, max, value, required: true });
			input.setAttribute('aria-label', title);
			content.append(caption, input);
		}
		input.addEventListener('keydown', event => {
			if (event.key === 'Enter') {
				event.preventDefault();
				input.closest('dialog').querySelector('[data-confirm]').click();
			}
		});
		confirmAction(container, title, () => resolve(Number(input.value)), {
			content,
			cancelled: () => resolve(null)
		});
	});
}
