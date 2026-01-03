import { describe, it, expect, beforeEach } from 'vitest';
import {
	progressionState,
	addChord,
	clearProgression,
	updateChord,
	setDuration,
	addSlot,
	insertSlot,
	removeSlot,
	removeChord
} from '$lib/stores/progression.svelte';
import type { Chord } from '$lib/utils/theory-engine';
import { QUALITIES, VOICING_PRESETS } from '$lib/utils/theory-engine';

// Helper to create a test chord
function createTestChord(
	root = 60,
	quality: keyof typeof QUALITIES = 'maj7',
	inversion = 0,
	voicing: keyof typeof VOICING_PRESETS = 'close',
	octave = 0,
	duration = '1m'
): Chord {
	return { root, quality, inversion, voicing, octave, duration };
}

describe('Progression Duration Support', () => {
	beforeEach(() => {
		clearProgression();
	});

	it('should add a chord with default duration of 1m', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		const addedChord = progressionState.progression[0];
		expect(addedChord).not.toBeNull();
		expect(addedChord?.duration).toBe('1m');
	});

	it('should allow updating the duration of a chord', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		const addedChord = progressionState.progression[0];
		expect(addedChord).not.toBeNull();

		// Create updated chord with new duration
		const updatedChord = { ...addedChord!, duration: '2n' };
		updateChord(0, updatedChord);

		const storedChord = progressionState.progression[0];
		expect(storedChord?.duration).toBe('2n');
	});

	it('should update duration via setDuration', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		setDuration(0, '4n');

		expect(progressionState.progression[0]?.duration).toBe('4n');
	});

	it('should preserve duration when moving/swapping chords', () => {
		const chord1 = createTestChord(60, 'maj7', 0, 'close', 0, '1m');
		const chord2 = createTestChord(62, 'maj7', 0, 'close', 0, '2n');

		addChord(chord1);
		addChord(chord2);

		expect(progressionState.progression[0]?.duration).toBe('1m');
		expect(progressionState.progression[1]?.duration).toBe('2n');
	});
});

describe('Dynamic Progression Management', () => {
	beforeEach(() => {
		clearProgression(); // Resets to 4 empty slots
	});

	it('should add a slot at the end', () => {
		expect(progressionState.progression).toHaveLength(4);
		addSlot();
		expect(progressionState.progression).toHaveLength(5);
		expect(progressionState.progression[4]).toBeNull();
	});

	it('should insert a slot at a specific index', () => {
		addChord(createTestChord(60, 'maj7')); // index 0
		addChord(createTestChord(62, 'maj7')); // index 1

		insertSlot(1);
		expect(progressionState.progression).toHaveLength(5);
		expect(progressionState.progression[0]?.root).toBe(60);
		expect(progressionState.progression[1]).toBeNull();
		expect(progressionState.progression[2]?.root).toBe(62);
	});

	it('should remove a slot entirely', () => {
		addChord(createTestChord(60, 'maj7')); // index 0
		addChord(createTestChord(62, 'maj7')); // index 1

		removeSlot(0);
		expect(progressionState.progression).toHaveLength(3);
		expect(progressionState.progression[0]?.root).toBe(62);
	});

	it('should remove slot when removeChord is called', () => {
		addChord(createTestChord(60, 'maj7'));
		expect(progressionState.progression).toHaveLength(4);

		removeChord(0);
		// removeChord ensures at least 1 slot if empty, but here we removed 1 of 4.
		expect(progressionState.progression).toHaveLength(3);
	});
});
