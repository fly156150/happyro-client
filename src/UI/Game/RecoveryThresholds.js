/** Compact recovery rule with independently validated percentage inputs. */
export function createRecoveryThresholds(key, settings, save) {
	const root = document.createElement('div');
	root.className = 'recovery-thresholds';
	const refreshers = [];
	function refresh() {
		refreshers.forEach(fn => fn());
	}
	for (const [field, caption] of [['trigger', '低于'], ['target', '恢复至']]) {
		const label = document.createElement('div');
		label.className = 'recovery-threshold-field';
		const text = document.createElement('span');
		text.textContent = `${caption}（%）`;
		const amount = document.createElement('span');
		amount.className = 'recovery-percentage';
		const number = document.createElement('input');
		number.type = 'number';
		number.inputMode = 'numeric';
		number.step = '1';
		number.setAttribute('aria-label', `${key.toUpperCase()} ${caption}百分比`);
		const min = () => field === 'trigger' ? 1 : settings.trigger + 1;
		const max = () => field === 'trigger' ? settings.target - 1 : 100;
		function update(value) {
			if (Number.isFinite(value)) settings[field] = Math.max(min(), Math.min(max(), Math.round(value)));
			refresh();
		}
		function commitNumber() {
			const previous = settings[field];
			update(number.valueAsNumber);
			if (settings[field] !== previous) save();
		}
		number.onchange = commitNumber;
		number.onblur = commitNumber;
		number.onkeydown = event => {
			if (event.key === 'Enter') { event.preventDefault(); number.blur(); }
		};
		const controls = document.createElement('div');
		controls.className = 'recovery-stepper';
		const nextTick = delta => delta > 0 ? (Math.floor(settings[field] / 5) + 1) * 5 : (Math.ceil(settings[field] / 5) - 1) * 5;
		function stepButton(symbol, delta) {
			const button = document.createElement('button');
			button.type = 'button';
			const glyph = document.createElement('span');
			glyph.textContent = symbol;
			button.append(glyph);
			button.setAttribute('aria-label', `${delta < 0 ? '减小' : '增大'}${key.toUpperCase()}${caption}比例`);
			button.onclick = () => {
				const next = nextTick(delta);
				if (next < min() || next > max()) return;
				update(next);
				save();
			};
			return button;
		}
		const minus = stepButton('−', -5), plus = stepButton('+', 5);
		refreshers.push(() => {
			number.min = String(min());
			number.max = String(max());
			number.value = String(settings[field]);
			minus.disabled = nextTick(-5) < min();
			plus.disabled = nextTick(5) > max();
		});
		amount.append(number);
		controls.append(minus, amount, plus);
		label.append(text, controls);
		root.append(label);
	}
	refresh();
	return root;
}
