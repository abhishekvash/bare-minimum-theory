/**
 * Drop highlight on a palette card: leaving the card for one of its own children must not clear it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import PaletteChordHarness from './PaletteChordHarness.svelte';
import type { Chord } from '#lib/utils/theory-engine/types.ts';

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

function renderCard(): { card: HTMLElement; onDragLeave: ReturnType<typeof vi.fn> } {
	const onDragLeave = vi.fn();
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(PaletteChordHarness, {
		target,
		props: { chord, inDialog: false, onPlace: vi.fn(), onDragLeave }
	});
	flushSync();
	const card = target.querySelector<HTMLElement>('[draggable="true"]');
	if (!card) throw new Error('Palette card was not rendered');
	return { card, onDragLeave };
}

/** jsdom has no DragEvent, so build a dragleave carrying the element being entered */
function fireDragLeave(card: HTMLElement, relatedTarget: EventTarget | null): void {
	const event = new MouseEvent('dragleave', { bubbles: true, cancelable: true, relatedTarget });
	card.dispatchEvent(event);
}

describe('PaletteChord drop highlight', () => {
	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target.remove();
	});

	it('keeps the highlight when the drag moves onto a child of the card', () => {
		const { card, onDragLeave } = renderCard();
		const child = card.querySelector('span');
		if (!child) throw new Error('Card has no child to enter');

		fireDragLeave(card, child);

		expect(onDragLeave).not.toHaveBeenCalled();
	});

	it('clears the highlight when the drag leaves the card', () => {
		const { card, onDragLeave } = renderCard();

		fireDragLeave(card, document.body);

		expect(onDragLeave).toHaveBeenCalledOnce();
	});

	it('clears the highlight when the browser reports no related target', () => {
		const { card, onDragLeave } = renderCard();

		fireDragLeave(card, null);

		expect(onDragLeave).toHaveBeenCalledOnce();
	});
});
