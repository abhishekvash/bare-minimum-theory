/** IconButton keeps the tooltip trigger's own click handling alongside the consumer's. */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import IconButtonHarness from './IconButtonHarness.svelte';

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

afterEach(() => {
	if (component) unmount(component);
	component = null;
	target?.remove();
});

describe('IconButton', () => {
	it('runs the consumer handler and still closes the tooltip on click', () => {
		// The consumer runs first, while the tooltip is still open; the trigger's own handler closes it
		let stateDuringConsumer: string | undefined;
		const onclick = vi.fn((event: MouseEvent) => {
			// Flush so a close the trigger already made would show in the DOM
			flushSync();
			stateDuringConsumer = (event.currentTarget as HTMLElement).dataset.state;
		});
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
		expect(stateDuringConsumer).toBeDefined();
		expect(stateDuringConsumer).not.toBe('closed');
		expect(button.getAttribute('data-state')).toBe('closed');
	});
});
