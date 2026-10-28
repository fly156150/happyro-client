import css from './QuantityStepper.css?raw';

/** Integer editor only: the caller owns confirmation, permissions and submission.
 * beforeStep can refresh live limits and return false if the operation is no longer available.
 * setBounds preserves the draft so validation can report a newly invalid quantity.
 */
export function createQuantityStepper({ label, value = 1, min = 1, max, stepMin, stepButtons = [-10, -1, 1, 10].map(delta => ({ delta })), beforeStep = () => true }) {
	const element = document.createElement('div');
	element.className = 'quantity-stepper';
	element.classList.toggle('quantity-stepper--named', stepButtons.some(button => button.label));
	const style = document.createElement('style');
	style.textContent = css;
	const input = document.createElement('input');
	input.className = 'quantity-stepper-control';
	Object.assign(input, { type: 'number', inputMode: 'numeric', step: '1', required: true, min, max, value });
	input.setAttribute('aria-label', label);
	const decreases = document.createElement('div');
	const increases = document.createElement('div');
	decreases.className = increases.className = 'quantity-stepper-buttons';
	const buttons = stepButtons.map(({ delta, label: buttonLabel }) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'quantity-stepper-control';
		button.textContent = buttonLabel ?? (delta > 0 ? `+${delta}` : String(delta));
		button.addEventListener('click', () => {
			if (beforeStep() === false) return;
			const current = Number(input.value);
			input.value = String(Math.max(stepMin ?? Number(input.min), Math.min(Number(input.max),
				(Number.isInteger(current) ? current : 0) + delta)));
			input.dispatchEvent(new Event('input', { bubbles: true }));
		});
		(delta < 0 ? decreases : increases).append(button);
		return { button, delta };
	});
	function update() {
		const current = Number(input.value);
		for (const { button, delta } of buttons)
			button.disabled = delta < 0 ? current <= (stepMin ?? Number(input.min)) : current >= Number(input.max);
	}
	input.addEventListener('input', update);
	element.append(style, decreases, input, increases);
	update();
	return {
		element, input,
		setBounds({ min: nextMin, max: nextMax }) {
			input.min = String(nextMin);
			input.max = String(nextMax);
			update();
		}
	};
}
