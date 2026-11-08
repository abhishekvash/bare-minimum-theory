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

	// init runs before hydration, so a failure here must not stop the app from starting: without
	// the polyfill, touch users lose dragging but keep everything else (click-to-place included)
	try {
		// Dynamic imports: desktop never downloads the polyfill (and it is CommonJS)
		const { polyfill } = await import('mobile-drag-drop');
		const { scrollBehaviourDragImageTranslateOverride } =
			await import('mobile-drag-drop/scroll-behaviour');

		polyfill({
			dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
			// Allow dragging to start after a short press
			holdToDrag: 200
		});
	} catch (error) {
		console.warn('Touch drag-and-drop polyfill failed to load:', error);
		return;
	}

	// The polyfill needs a non-passive touchmove listener so it can prevent scrolling mid-drag.
	// It lives for the whole page, so there is nothing to remove.
	window.addEventListener('touchmove', () => {}, { passive: false });
};
