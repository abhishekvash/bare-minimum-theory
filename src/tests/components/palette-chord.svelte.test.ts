/**
 * Keyboard placement of a palette card: Enter always places it, Space only inside a dialog (the
 * mobile library drawer), because everywhere else Space is the global transport toggle.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import PaletteChordHarness from './PaletteChordHarness.svelte';
import type { Chord } from '$lib/utils/theory-engine/types';

const chord: Chord = {
	root: 60,
	quality: 'maj7',
	inversion: 0,
	voicing: 'close',
	octave: 0,
	duration: '1m'
};

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

function renderCard(inDialog: boolean): { card: HTMLElement; onPlace: ReturnType<typeof vi.fn> } {
	const onPlace = vi.fn();
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(PaletteChordHarness, { target, props: { chord, inDialog, onPlace } });
	flushSync();
	// The place action is the card's real button; keyboard placement goes through it
	const card = target.querySelector<HTMLElement>('button[data-palette-place]');
	if (!card) throw new Error('Palette card was not rendered');
	return { card, onPlace };
}

function press(card: HTMLElement, key: string): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
	card.dispatchEvent(event);
	return event;
}

describe('PaletteChord keyboard placement', () => {
	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target.remove();
	});

	it('places the card on Enter outside a dialog', () => {
		const { card, onPlace } = renderCard(false);
		press(card, 'Enter');
		expect(onPlace).toHaveBeenCalledExactlyOnceWith(chord);
	});

	it('leaves Space to the transport outside a dialog', () => {
		const { card, onPlace } = renderCard(false);
		const event = press(card, ' ');
		expect(onPlace).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it('places the card on Space inside a dialog', () => {
		const { card, onPlace } = renderCard(true);
		const event = press(card, ' ');
		expect(onPlace).toHaveBeenCalledExactlyOnceWith(chord);
		expect(event.defaultPrevented).toBe(true);
	});
});

describe('PaletteChord structure', () => {
	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target.remove();
	});

	it('keeps the action buttons as siblings of the place button, not inside a button role', () => {
		const { card } = renderCard(false);
		const wrapper = card.closest<HTMLElement>('[draggable="true"]');

		expect(target.querySelector('[role="button"]')).toBeNull();
		expect(card.querySelector('button, [role="button"]')).toBeNull();
		expect(wrapper?.getAttribute('tabindex')).toBeNull();
		expect(wrapper?.querySelectorAll('button')).toHaveLength(3);
	});

	it('places from a click anywhere on the card, once, but not from the action buttons', () => {
		const { card, onPlace } = renderCard(false);
		const wrapper = card.closest<HTMLElement>('[draggable="true"]');

		card.click();
		expect(onPlace).toHaveBeenCalledOnce();

		wrapper?.click();
		expect(onPlace).toHaveBeenCalledTimes(2);

		target.querySelector<HTMLButtonElement>('button[aria-label^="Play"]')?.click();
		target.querySelector<HTMLButtonElement>('button[aria-label^="Delete"]')?.click();
		expect(onPlace).toHaveBeenCalledTimes(2);
	});
});
