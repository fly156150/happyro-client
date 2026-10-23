import { getClientDefaults } from 'Core/ClientDefaults.js';

/** Contrast correction for script text. Call after inserting into the styled document. */
const minimumContrast = getClientDefaults('scriptText').minContrast;
const cache = new Map();
const originalColors = new WeakMap();

export function contrastRatio(a, b) {
	const luminance = channels =>
		channels
			.slice(0, 3)
			.map(c => {
				c /= 255;
				return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
			})
			.reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
	const x = luminance(a),
		y = luminance(b);
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Mix toward white/black only as far as necessary, retaining the RGB hue. */
export function readableColor(color, background) {
	const key = `${color}|${background}`;
	if (cache.has(key)) return cache.get(key);
	let result = color.slice(0, 3);
	if (contrastRatio(result, background) < minimumContrast) {
		const end = contrastRatio([255, 255, 255], background) >= contrastRatio([0, 0, 0], background) ? 255 : 0;
		const mix = amount => color.slice(0, 3).map(c => c + (end - c) * amount);
		let low = 0,
			high = 1;
		for (let i = 0; i < 24; i++) {
			const mid = (low + high) / 2;
			if (contrastRatio(mix(mid), background) < minimumContrast) low = mid;
			else high = mid;
		}
		result = mix(high).map(c => (end === 255 ? Math.ceil(c) : Math.floor(c)));
	}
	if (cache.size >= 512) cache.clear();
	cache.set(key, result);
	return result;
}

function rgb(value) {
	// Computed styles serialize the existing hex/named script colors as rgb()/rgba().
	const values = value.match(/[\d.]+/g)?.map(Number);
	return values?.length >= 3 ? [...values.slice(0, 3), values[3] ?? 1] : [0, 0, 0, 0];
}

function parent(element) {
	return element.parentElement || element.getRootNode().host;
}

function backgroundAt(element) {
	const layers = [];
	for (let node = element; node; node = parent(node)) {
		const color = rgb(getComputedStyle(node).backgroundColor);
		layers.push(color);
		if (color[3] === 1) break;
	}
	// The document canvas is white when no ancestor supplies an opaque background.
	return layers
		.reverse()
		.reduce((under, layer) => under.map((c, i) => layer[i] * layer[3] + c * (1 - layer[3])), [255, 255, 255]);
}

function adapt(element, source) {
	const background = backgroundAt(element);
	const color = source.slice(0, 3).map((c, i) => c * source[3] + background[i] * (1 - source[3]));
	const result = readableColor(color, background);
	element.style.color = `rgb(${result.join(', ')})`;
}

export function ensureReadableText(container) {
	if (!container.isConnected) return;
	for (const element of container.querySelectorAll('[style*="color"], font[color], .item-link, .navi-link')) {
		// Reset spans must inherit the theme, not capture a fixed color.
		if (element.style.color === 'inherit') continue;
		if (!originalColors.has(element)) {
			originalColors.set(element, rgb(getComputedStyle(element).color));
			if (element.matches('.item-link, .navi-link')) {
				const refresh = () => {
					element.style.removeProperty('color');
					adapt(element, rgb(getComputedStyle(element).color));
				};
				for (const event of ['pointerenter', 'pointerleave', 'focus', 'blur'])
					element.addEventListener(event, refresh);
			}
		}
		adapt(element, originalColors.get(element));
	}
}
