/**
 * Tests for the live-audition transaction owned by the progression store:
 * staging, commit, revert, and how the record follows progression mutations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Chord, ChordDuration } from '$lib/utils/theory-engine';
import { QUALITIES, VOICING_PRESETS } from '$lib/utils/theory-engine';
import {
	progressionState,
	addChord,
	clearBuilderState,
	clearChordAt,
	clearProgression,
	insertChordAt,
	insertSlot,
	insertSlotWithChord,
	loadProgressionToCanvas,
	moveChord,
	removeSlot,
	updateChord,
	commitAudition,
	revertAudition,
	stageCandidate
} from '$lib/stores/progression.svelte';
import { uiState, selectSlot, resetUIState } from '$lib/stores/ui.svelte';

function createTestChord(
	root = 60,
	quality: keyof typeof QUALITIES = 'maj7',
	inversion = 0,
	voicing: keyof typeof VOICING_PRESETS = 'close',
	octave = 0,
	duration: ChordDuration = '1m'
): Chord {
	return { root, quality, inversion, voicing, octave, duration };
}

describe('Live audition transaction', () => {
	beforeEach(() => {
		clearProgression();
		clearBuilderState();
		resetUIState();
	});

	describe('stageCandidate', () => {
		it('should capture the baseline harmony and apply the candidate', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);

			stageCandidate(0, createTestChord(67, 'm9'));

			expect(progressionState.audition).toEqual({
				slotIndex: 0,
				baselineRoot: 60,
				baselineQuality: 'maj7',
				clampedInversion: null
			});
			expect(progressionState.progression[0]?.root).toBe(67);
			expect(progressionState.progression[0]?.quality).toBe('m9');
		});

		it('should resolve the transaction when browsing returns to the baseline harmony', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);

			stageCandidate(0, createTestChord(60, 'm9'));
			stageCandidate(0, createTestChord(60, 'maj7'));

			expect(progressionState.audition).toBeNull();
			expect(progressionState.progression[0]?.quality).toBe('maj7');
		});

		it('should capture the baseline only once per transaction', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);

			stageCandidate(0, createTestChord(62, 'm'));
			stageCandidate(0, createTestChord(64, '7'));
			stageCandidate(0, createTestChord(65, 'dim'));

			expect(progressionState.audition).toEqual({
				slotIndex: 0,
				baselineRoot: 60,
				baselineQuality: 'maj7',
				clampedInversion: null
			});
			expect(progressionState.progression[0]?.quality).toBe('dim');
		});

		it('should replace harmony only, keeping the slot performance settings', () => {
			const existing: Chord = createTestChord(60, 'maj7', 2, 'drop2', -1, '2n.');
			addChord(existing);
			selectSlot(0);

			stageCandidate(0, createTestChord(67, 'm9', 0, 'close', 0, '1m'));

			expect(progressionState.progression[0]).toEqual({
				...existing,
				root: 67,
				quality: 'm9'
			});
		});

		it('should start a fresh transaction when staging onto a different slot', () => {
			addChord(createTestChord(60, 'maj7'));
			addChord(createTestChord(62, 'm'));

			stageCandidate(0, createTestChord(60, 'm9'));
			stageCandidate(1, createTestChord(62, '7'));

			expect(progressionState.audition).toEqual({
				slotIndex: 1,
				baselineRoot: 62,
				baselineQuality: 'm',
				clampedInversion: null
			});
			// The first slot's candidate was committed by the target switch
			expect(progressionState.progression[0]?.quality).toBe('m9');
		});

		it('should place the chord but start no transaction on an empty slot', () => {
			const candidate = createTestChord(67, '7');

			stageCandidate(1, candidate);

			expect(progressionState.progression[1]).toEqual(candidate);
			expect(progressionState.audition).toBeNull();
		});

		it('should ignore slots outside the progression', () => {
			stageCandidate(-1, createTestChord(60, 'maj7'));
			stageCandidate(progressionState.progression.length, createTestChord(60, 'maj7'));

			expect(progressionState.audition).toBeNull();
			expect(progressionState.progression.every((c) => c === null)).toBe(true);
		});
	});

	describe('commitAudition', () => {
		it('should keep the candidate and clear the record', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(67, 'm9'));

			commitAudition();

			expect(progressionState.audition).toBeNull();
			expect(progressionState.progression[0]?.root).toBe(67);
			expect(progressionState.progression[0]?.quality).toBe('m9');
		});

		it('should be safe with nothing pending', () => {
			expect(() => commitAudition()).not.toThrow();
			expect(progressionState.audition).toBeNull();
		});
	});

	describe('revertAudition', () => {
		it('should restore the baseline harmony and clear the record', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(67, 'm9'));

			revertAudition();

			expect(progressionState.audition).toBeNull();
			expect(progressionState.progression[0]?.root).toBe(60);
			expect(progressionState.progression[0]?.quality).toBe('maj7');
		});

		it('should restore the first baseline after browsing several candidates', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(62, 'm'));
			stageCandidate(0, createTestChord(64, '7'));

			revertAudition();

			expect(progressionState.progression[0]?.root).toBe(60);
			expect(progressionState.progression[0]?.quality).toBe('maj7');
		});

		it('should not undo performance edits made during the audition', () => {
			addChord(createTestChord(60, 'maj7', 0, 'close', 0, '1m'));
			stageCandidate(0, createTestChord(67, 'm9'));

			// An inspector edit while auditioning
			const audited = progressionState.progression[0]!;
			progressionState.progression[0] = { ...audited, voicing: 'drop2', octave: 1 };

			revertAudition();

			expect(progressionState.progression[0]).toEqual({
				root: 60,
				quality: 'maj7',
				inversion: 0,
				voicing: 'drop2',
				octave: 1,
				duration: '1m'
			});
		});

		it('should restore an inversion a smaller candidate clamped to root position', () => {
			addChord(createTestChord(60, 'maj7', 3));
			stageCandidate(0, createTestChord(62, 'm'));
			expect(progressionState.progression[0]?.inversion).toBe(0);
			stageCandidate(0, createTestChord(64, '7'));

			revertAudition();

			expect(progressionState.progression[0]).toMatchObject({
				root: 60,
				quality: 'maj7',
				inversion: 3
			});
		});

		it('should keep an inversion the user set while auditioning', () => {
			addChord(createTestChord(60, 'maj7', 3));
			stageCandidate(0, createTestChord(62, 'm'));
			progressionState.progression[0] = { ...progressionState.progression[0]!, inversion: 1 };

			revertAudition();

			expect(progressionState.progression[0]?.inversion).toBe(1);
		});

		it('should leave the selection in place', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			stageCandidate(0, createTestChord(67, 'm9'));

			revertAudition();

			expect(uiState.selectedSlot).toBe(0);
		});

		it('should be safe with nothing pending', () => {
			addChord(createTestChord(60, 'maj7'));

			revertAudition();

			expect(progressionState.progression[0]?.quality).toBe('maj7');
		});
	});

	// ==========================================================================
	// Record Integrity Hooks
	// ==========================================================================

	describe('audition record integrity', () => {
		it('should follow the chord when the audited slot moves onto an empty slot', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			stageCandidate(0, createTestChord(67, 'm9'));

			moveChord(0, 2);

			expect(progressionState.audition?.slotIndex).toBe(2);
			expect(uiState.selectedSlot).toBe(2);

			revertAudition();
			expect(progressionState.progression[2]?.quality).toBe('maj7');
			expect(progressionState.progression[0]).toBeNull();
		});

		it('should follow the chord when the audited slot is swapped', () => {
			addChord(createTestChord(60, 'maj7'));
			addChord(createTestChord(62, 'm'));
			stageCandidate(1, createTestChord(62, '7'));

			moveChord(0, 1);

			expect(progressionState.audition?.slotIndex).toBe(0);
		});

		it('should shift the record when a slot is inserted before it', () => {
			addChord(createTestChord(60, 'maj7'));
			addChord(createTestChord(62, 'm'));
			selectSlot(1);
			stageCandidate(1, createTestChord(62, '7'));

			insertSlot(0);

			expect(progressionState.audition?.slotIndex).toBe(2);
			expect(uiState.selectedSlot).toBe(2);
		});

		it('should shift the record when a filled slot is inserted before it', () => {
			addChord(createTestChord(60, 'maj7'));
			addChord(createTestChord(62, 'm'));
			stageCandidate(1, createTestChord(62, '7'));

			insertSlotWithChord(0, createTestChord(64, 'dim'));

			expect(progressionState.audition?.slotIndex).toBe(2);
		});

		it('should discard the record when the audited slot is cleared', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(67, 'm9'));

			clearChordAt(0);

			expect(progressionState.audition).toBeNull();
		});

		it('should keep the record when a different slot is cleared', () => {
			addChord(createTestChord(60, 'maj7'));
			addChord(createTestChord(62, 'm'));
			stageCandidate(1, createTestChord(62, '7'));

			clearChordAt(0);

			expect(progressionState.audition?.slotIndex).toBe(1);
		});

		it('should discard the record when the audited slot is removed', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(67, 'm9'));

			removeSlot(0);

			expect(progressionState.audition).toBeNull();
			expect(uiState.selectedSlot).toBeNull();
		});

		it('should shift the record when an earlier slot is removed', () => {
			addChord(createTestChord(60, 'maj7'));
			addChord(createTestChord(62, 'm'));
			selectSlot(1);
			stageCandidate(1, createTestChord(62, '7'));

			removeSlot(0);

			expect(progressionState.audition?.slotIndex).toBe(0);
			expect(uiState.selectedSlot).toBe(0);
		});

		it('should discard the record when the audited slot is overwritten by another action', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(67, 'm9'));

			insertChordAt(0, createTestChord(70, 'sus4')); // e.g. a drop onto the slot

			expect(progressionState.audition).toBeNull();
			expect(progressionState.progression[0]?.root).toBe(70);
		});

		it('should discard the record when the audited slot is replaced via updateChord', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(67, 'm9'));

			updateChord(0, createTestChord(70, 'sus4'));

			expect(progressionState.audition).toBeNull();
		});

		it('should discard the record when the progression is cleared', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			stageCandidate(0, createTestChord(67, 'm9'));

			clearProgression();

			expect(progressionState.audition).toBeNull();
			expect(uiState.selectedSlot).toBeNull();
		});

		it('should discard the record when a saved progression is loaded', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			stageCandidate(0, createTestChord(67, 'm9'));

			loadProgressionToCanvas([createTestChord(62, 'm'), null, null, null]);

			expect(progressionState.audition).toBeNull();
			expect(uiState.selectedSlot).toBeNull();
		});
	});
});
