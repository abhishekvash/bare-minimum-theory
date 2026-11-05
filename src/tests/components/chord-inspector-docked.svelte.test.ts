/** Mounted inspector: a placeholder until a chord is selected, then that chord's controls. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import ChordInspectorHarness from './ChordInspectorHarness.svelte';
import type { Chord } from '$lib/utils/theory-engine';
import {
	addChord,
	clearProgression,
	progressionState,
	selectQuality
} from '$lib/stores/progression.svelte';
import { deselectSlot, resetUIState, selectSlot, setTransportActive } from '$lib/stores/ui.svelte';

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

function chord(root: number, quality: Chord['quality'] = 'maj7'): Chord {
	return { root, quality, inversion: 0, voicing: 'close', octave: 0, duration: '1m' };
}

function render(): void {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(ChordInspectorHarness, { target });
	flushSync();
}

const inspector = () => target.querySelector('[data-slot="chord-inspector"]');
const placeholder = () => target.querySelector('[data-slot="chord-inspector-placeholder"]');

describe('ChordInspector placeholder', () => {
	beforeEach(() => {
		clearProgression();
		resetUIState();
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
	});

	it('shows an add-then-select placeholder on an empty progression', () => {
		render();

		expect(inspector()).toBeNull();
		expect(placeholder()?.textContent).toContain('No chord selected');
		expect(placeholder()?.textContent).toContain('Add a chord to the progression');
	});

	it('shows a select placeholder when chords exist but none is selected', () => {
		addChord(chord(60));
		render();

		expect(inspector()).toBeNull();
		expect(placeholder()?.textContent).toContain('Select a chord in the progression');
	});

	it('swaps to the selected chord and back to the placeholder on deselect', () => {
		addChord(chord(60));
		addChord(chord(67, '7'));
		render();

		selectSlot(1);
		flushSync();
		expect(placeholder()).toBeNull();
		expect(inspector()?.textContent).toContain('Slot 2');
		expect(inspector()?.textContent).toContain('G7');

		deselectSlot();
		flushSync();
		expect(inspector()).toBeNull();
		expect(placeholder()).not.toBeNull();
	});

	it('offers Replace only once the builder holds different harmony, while stopped', () => {
		addChord({ ...chord(60), voicing: 'drop2' });
		selectSlot(0);
		render();
		const replace = () => target.querySelector<HTMLButtonElement>('[data-inspector-replace]');

		// Selecting syncs the builder to the slot, so there is nothing to replace yet
		expect(replace()).toBeNull();

		selectQuality('m7');
		flushSync();
		expect(replace()?.textContent).toContain('Replace with Cm7');

		setTransportActive(true);
		flushSync();
		expect(replace()).toBeNull();

		setTransportActive(false);
		flushSync();
		replace()?.click();
		flushSync();
		expect(progressionState.progression[0]).toMatchObject({ quality: 'm7', voicing: 'drop2' });
		expect(replace()).toBeNull();
	});
});
