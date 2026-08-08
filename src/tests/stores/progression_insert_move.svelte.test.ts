/**
 * Tests for the atomic move-to-insertion-point mutation and the padded-slot materialization it
 * relies on. Both exist because inserting and clearing as two steps could lose the chord outright
 * and left the selection and audition record on the rest instead of the chord that moved.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Chord } from '$lib/utils/theory-engine';
import {
	progressionState,
	addChord,
	clearProgression,
	materializeSlotsUpTo,
	moveChordToNewSlot,
	removeSlot,
	MAX_PROGRESSION_SLOTS
} from '$lib/stores/progression.svelte';
import { resetUIState, selectSlot, stageCandidate, uiState } from '$lib/stores/ui.svelte';

function createTestChord(root: number, quality: Chord['quality'] = 'maj7'): Chord {
	return { root, quality, inversion: 0, voicing: 'close', octave: 0, duration: '1m' };
}

/** Roots of the current progression, with nulls for rests */
function roots(): (number | null)[] {
	return progressionState.progression.map((chord) => chord?.root ?? null);
}

/** Shrink the canvas below its minimum display size, so padded positions exist */
function compactTo(length: number): void {
	while (progressionState.progression.length > length) {
		removeSlot(progressionState.progression.length - 1);
	}
}

describe('materializeSlotsUpTo', () => {
	beforeEach(() => {
		clearProgression();
		resetUIState();
	});

	it('should leave an index the array already covers alone', () => {
		expect(materializeSlotsUpTo(2)).toBe(true);
		expect(progressionState.progression.length).toBe(4);
	});

	it('should create the slots a padded index implies', () => {
		addChord(createTestChord(60));
		compactTo(1);

		expect(materializeSlotsUpTo(3)).toBe(true);
		expect(roots()).toEqual([60, null, null]);
	});

	it('should refuse a negative index', () => {
		expect(materializeSlotsUpTo(-1)).toBe(false);
		expect(progressionState.progression.length).toBe(4);
	});

	it('should refuse an index past the slot cap', () => {
		expect(materializeSlotsUpTo(MAX_PROGRESSION_SLOTS)).toBe(false);
		expect(progressionState.progression.length).toBe(4);
	});

	it('should refuse once the progression is full of slots', () => {
		for (let i = 0; i < MAX_PROGRESSION_SLOTS; i++) addChord(createTestChord(60 + i));

		expect(materializeSlotsUpTo(2)).toBe(false);
		expect(progressionState.progression.length).toBe(MAX_PROGRESSION_SLOTS);
	});
});

describe('moveChordToNewSlot', () => {
	beforeEach(() => {
		clearProgression();
		resetUIState();
	});

	it('should insert the chord and leave a rest behind', () => {
		addChord(createTestChord(60));
		addChord(createTestChord(62, 'm'));

		expect(moveChordToNewSlot(0, 2)).toBe(true);
		expect(roots()).toEqual([null, 62, 60, null, null]);
	});

	it('should move a chord backwards past earlier slots', () => {
		addChord(createTestChord(60));
		addChord(createTestChord(62, 'm'));
		addChord(createTestChord(64, '7'));

		expect(moveChordToNewSlot(2, 1)).toBe(true);
		expect(roots()).toEqual([60, 64, 62, null, null]);
	});

	it('should create the padded slots a display-only insertion point implies', () => {
		addChord(createTestChord(60));
		addChord(createTestChord(62, 'm'));
		compactTo(2);

		expect(moveChordToNewSlot(0, 3)).toBe(true);
		expect(roots()).toEqual([null, 62, null, 60]);
	});

	it('should copy the chord rather than share the source object', () => {
		addChord(createTestChord(60));
		const original = progressionState.progression[0];

		moveChordToNewSlot(0, 2);

		expect(progressionState.progression[2]).not.toBe(original);
		expect(progressionState.progression[2]?.root).toBe(60);
	});

	it('should keep the slot performance settings the chord was carrying', () => {
		const shaped: Chord = { ...createTestChord(60), inversion: 2, voicing: 'drop2', octave: -1 };
		addChord(shaped);

		moveChordToNewSlot(0, 2);

		expect(progressionState.progression[2]).toEqual(shaped);
	});

	it('should do nothing for the insertion points touching its own block', () => {
		addChord(createTestChord(60));
		addChord(createTestChord(62, 'm'));
		const before = roots();

		expect(moveChordToNewSlot(1, 1)).toBe(false);
		expect(moveChordToNewSlot(1, 2)).toBe(false);
		expect(roots()).toEqual(before);
	});

	it('should refuse a source slot that holds no chord', () => {
		addChord(createTestChord(60));
		const before = roots();

		expect(moveChordToNewSlot(1, 3)).toBe(false);
		expect(roots()).toEqual(before);
	});

	it('should refuse a source index outside the progression', () => {
		addChord(createTestChord(60));
		const before = roots();

		expect(moveChordToNewSlot(-1, 2)).toBe(false);
		expect(moveChordToNewSlot(progressionState.progression.length, 2)).toBe(false);
		expect(roots()).toEqual(before);
	});

	it('should never clear the source when the insertion is refused at the cap', () => {
		for (let i = 0; i < MAX_PROGRESSION_SLOTS; i++) addChord(createTestChord(60 + i));
		const before = roots();

		expect(moveChordToNewSlot(0, 4)).toBe(false);
		expect(roots()).toEqual(before);
	});

	it('should carry the selection and the audition record to the chord new home', () => {
		addChord(createTestChord(60));
		addChord(createTestChord(62, 'm'));
		selectSlot(0);
		stageCandidate(0, createTestChord(67, 'm9'));

		moveChordToNewSlot(0, 2);

		expect(uiState.selectedSlot).toBe(2);
		expect(uiState.audition).toEqual({
			slotIndex: 2,
			baselineRoot: 60,
			baselineQuality: 'maj7'
		});
	});

	it('should shift a selection the insertion pushed right', () => {
		addChord(createTestChord(60));
		addChord(createTestChord(62, 'm'));
		addChord(createTestChord(64, '7'));
		selectSlot(2);

		// Slot 2's chord is untouched, but the new slot appears before it
		moveChordToNewSlot(0, 2);

		expect(uiState.selectedSlot).toBe(3);
		expect(progressionState.progression[3]?.root).toBe(64);
	});
});
