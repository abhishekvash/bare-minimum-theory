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
	const card = target.querySelector<HTMLElement>('[role="button"][tabindex="0"]');
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
