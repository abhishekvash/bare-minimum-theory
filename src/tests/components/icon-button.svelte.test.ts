/** IconButton keeps the tooltip trigger's own click handling alongside the consumer's. */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import IconButtonHarness from './IconButtonHarness.svelte';

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

// The open tooltip measures itself; jsdom has no ResizeObserver
class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}

beforeAll(() => {
	vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterAll(() => {
	vi.unstubAllGlobals();
});

afterEach(() => {
	if (component) unmount(component);
	component = null;
	target?.remove();
});

describe('IconButton', () => {
	it('runs the consumer handler and still closes the tooltip on click', () => {
		const onclick = vi.fn();
		target = document.createElement('div');
		document.body.appendChild(target);
		component = mount(IconButtonHarness, { target, props: { onclick } });
		flushSync();

		const button = target.querySelector<HTMLButtonElement>('button[aria-label="Do the thing"]');
		if (!button) throw new Error('IconButton was not rendered');

		button.focus();
		flushSync();
		expect(button.getAttribute('data-state')).not.toBe('closed');

		button.click();
		flushSync();
		expect(onclick).toHaveBeenCalledOnce();
		expect(button.getAttribute('data-state')).toBe('closed');
	});
});
