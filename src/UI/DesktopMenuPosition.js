import Platform from 'UI/Platform.js';
import Renderer from 'Renderer/Renderer.js';

const bindings = new Map();

function visible(component) {
	const host = component._host;
	return !!host?.isConnected && getComputedStyle(host).display !== 'none';
}

function place(component) {
	if (Platform.isMobile || !visible(component)) return;
	const host = component._host;
	const rect = host.getBoundingClientRect();
	const content = component.getRoot().querySelector('.ui-component-root');
	const width = Math.max(rect.width, content?.scrollWidth || 0);
	const height = Math.max(rect.height, content?.scrollHeight || 0);
	const viewportWidth = Renderer.width;
	const viewportHeight = Renderer.height;
	const gap = 8;
	const restored = component._restoreDragPosition();
	const clampLeft = (value) => Math.max(0, Math.min(Math.max(gap, value), viewportWidth - width - gap));
	const clampTop = (value) => Math.max(0, Math.min(Math.max(gap, value), viewportHeight - height - gap));
	let left = clampLeft(restored ? parseFloat(host.style.left) : (viewportWidth - width) / 2);
	let top = clampTop(restored ? parseFloat(host.style.top) : (viewportHeight - height) * 0.4);
	if (!restored && width < viewportWidth * 0.9 && height < viewportHeight * 0.9) {
		const others = [...bindings.keys()]
			.filter((other) => other !== component && visible(other))
			.map((other) => other._host.getBoundingClientRect());
		// Keep nearby title bars visible without moving windows the player already placed.
		for (let step = 0; step < others.length; step++) {
			const overlapsTitle = others.some((other) =>
				Math.abs(other.top - top) < 28 && left < other.right && left + width > other.left
			);
			if (!overlapsTitle) break;
			const nextLeft = clampLeft(left + 28);
			const nextTop = clampTop(top + 28);
			if (nextTop === top) break;
			left = nextLeft;
			top = nextTop;
		}
	}
	host.style.left = `${left}px`;
	host.style.top = `${top}px`;
	component.focus();
}

/** Apply one placement policy to direct and server-confirmed menu openings. */
export function prepareDesktopMenuPosition(component) {
	if (Platform.isMobile || !component) return () => {};
	let binding = bindings.get(component);
	if (!binding) {
		binding = { frame: 0 };
		const onAppend = component.onAppend;
		component.onAppend = function (...args) {
			const result = onAppend?.apply(this, args);
			schedule();
			return result;
		};
		bindings.set(component, binding);
	}
	const wasVisible = visible(component);
	function schedule() {
		cancelAnimationFrame(binding.frame);
		binding.frame = requestAnimationFrame(() => place(component));
	}
	return () => {
		if (!wasVisible) schedule();
	};
}
