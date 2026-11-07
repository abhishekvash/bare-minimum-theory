/** ChordBuilder production wiring: target-aware previews and truthful live staging. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import ChordBuilder from '#lib/components/ChordBuilder.svelte';
import { auditionChord, resolveTargetSlot } from '#lib/utils/audition-controller.ts';
import type { Chord } from '#lib/utils/theory-engine/index.ts';
import {
	addChord,
	clearBuilderState,
	commitAudition,
	clearProgression,
	progressionState,
	selectQuality
} from '#lib/stores/progression.svelte.ts';
import { resetUIState, selectSlot, setTransportActive } from '#lib/stores/ui.svelte.ts';

vi.mock('#lib/utils/audition-controller.ts', () => ({
	auditionChord: vi.fn(() => 'played'),
	auditionNotes: vi.fn(() => 'played'),
	cancelAudition: vi.fn(),
	isTransportActive: vi.fn(() => false),
	resolveTargetSlot: vi.fn(() => 2)
}));

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

function chord(overrides: Partial<Chord> = {}): Chord {
	return {
		root: 60,
		quality: 'maj7',
		inversion: 0,
		voicing: 'close',
		octave: 0,
		duration: '1m',
		...overrides
	};
}

function renderBuilder(): void {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(ChordBuilder, { target });
	flushSync();
}

describe('ChordBuilder candidate wiring', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearProgression();
		clearBuilderState();
		resetUIState();
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
	});

	it('should pass the selected-or-first-empty target when a root completes the chord', () => {
		renderBuilder();
		selectQuality('m7');
		flushSync();

		target.querySelector<HTMLButtonElement>('[data-root="62"]')?.click();
		flushSync();

		expect(resolveTargetSlot).toHaveBeenCalledTimes(1);
		expect(auditionChord).toHaveBeenCalledWith(
			expect.objectContaining({ root: 62, quality: 'm7' }),
			{ mode: 'click', targetSlot: 2 }
		);
	});

	it('should preview an occupied target with its performance settings', () => {
		addChord(chord({ inversion: 2, voicing: 'drop2', octave: -1, duration: '2n.' }));
		selectSlot(0);
		vi.mocked(resolveTargetSlot).mockReturnValue(0);
		renderBuilder();

		target.querySelector<HTMLButtonElement>('[data-quality="m9"]')?.click();
		flushSync();

		expect(auditionChord).toHaveBeenCalledWith(
			chord({ quality: 'm9', inversion: 2, voicing: 'drop2', octave: -1, duration: '2n.' }),
			{ mode: 'click', targetSlot: 0 }
		);
	});

	it('should stage a live root change so keeping it keeps exactly the built chord', () => {
		addChord(chord());
		selectSlot(0);
		vi.mocked(resolveTargetSlot).mockReturnValue(0);
		renderBuilder();
		setTransportActive(true);
		flushSync();

		// First stage Cm9 from the quality field.
		target.querySelector<HTMLButtonElement>('[data-quality="m9"]')?.click();
		flushSync();
		expect(progressionState.progression[0]).toMatchObject({ root: 60, quality: 'm9' });

		// Then change the displayed root. The production root handler must restage Dm9.
		target.querySelector<HTMLButtonElement>('[data-root="62"]')?.click();
		flushSync();
		expect(progressionState.progression[0]).toMatchObject({ root: 62, quality: 'm9' });
		expect(progressionState.audition?.baselineQuality).toBe('maj7');

		commitAudition();

		expect(progressionState.audition).toBeNull();
		expect(progressionState.progression[0]).toMatchObject({ root: 62, quality: 'm9' });
	});
});
