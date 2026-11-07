import type { ClientInit } from '@sveltejs/kit/hooks';

/**
 * Runs once in the browser before the app hydrates.
 *
 * Touch devices have no native HTML5 drag and drop, so they get the mobile-drag-drop
 * polyfill. Its CSS is imported by the root layout.
 */
export const init: ClientInit = async () => {
	const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	if (!isTouchDevice) return;

	// Dynamic imports: desktop never downloads the polyfill (and it is CommonJS)
	const { polyfill } = await import('mobile-drag-drop');
	const { scrollBehaviourDragImageTranslateOverride } =
		await import('mobile-drag-drop/scroll-behaviour');

	polyfill({
		dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
		// Allow dragging to start after a short press
		holdToDrag: 200
	});

	// The polyfill needs a non-passive touchmove listener so it can prevent scrolling mid-drag.
	// It lives for the whole page, so there is nothing to remove.
	window.addEventListener('touchmove', () => {}, { passive: false });
};
