/**
 * Browser APIs jsdom does not implement, installed fresh before every test.
 * Tests that need a specific viewport override `window.matchMedia` themselves; the next test
 * starts from these defaults again.
 */

import { beforeEach } from 'vitest';

/** jsdom's default viewport width, used to answer min-width/max-width queries */
const VIEWPORT_WIDTH = 1024;

/** Evaluate the width queries the app uses; anything else (e.g. prefers-reduced-motion) is false */
function evaluate(query: string): boolean {
	const min = /min-width:\s*(\d+)px/.exec(query);
	const max = /max-width:\s*(\d+)px/.exec(query);
	if (!min && !max) return false;
	return (!min || VIEWPORT_WIDTH >= Number(min[1])) && (!max || VIEWPORT_WIDTH <= Number(max[1]));
}

function installMatchMedia(): void {
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		writable: true,
		value: (query: string): MediaQueryList =>
			({
				matches: evaluate(query),
				media: query,
				onchange: null,
				addEventListener() {},
				removeEventListener() {},
				addListener() {},
				removeListener() {},
				dispatchEvent: () => false
			}) as MediaQueryList
	});
}

/** Tooltips and popovers measure themselves */
class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}

// Also at load: svelte/motion builds its prefersReducedMotion query when first imported
installMatchMedia();

beforeEach(() => {
	installMatchMedia();
	globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
});
