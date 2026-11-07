/**
 * Tests for the canvas vocabulary the inspector owns and the chord blocks reuse:
 * duration labelling, the customization marker, the control labels, and the delete action
 * both surfaces share.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Chord } from '#lib/utils/theory-engine/index.ts';
import { QUALITIES, VOICING_PRESETS } from '#lib/utils/theory-engine/index.ts';
import {
	progressionState,
	addChord,
	clearProgression,
	stageCandidate
} from '#lib/stores/progression.svelte.ts';
import { uiState, resetUIState, selectSlot, deleteChordFromSlot } from '#lib/stores/ui.svelte.ts';
import {
	DURATION_OPTIONS,
	INVERSION_LABELS,
	VOICING_LABELS
} from '#lib/components/ChordInspector.svelte';
import {
	DURATION_LABELS,
	formatDuration,
	isCustomizedChord
} from '#lib/utils/theory-engine/index.ts';

function createTestChord(overrides: Partial<Chord> = {}): Chord {
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

describe('Chord inspector vocabulary', () => {
	beforeEach(() => {
		clearProgression();
		resetUIState();
	});

	// ==========================================================================
	// Duration labelling
	// ==========================================================================

	describe('formatDuration', () => {
		it('should spell whole bars out', () => {
			expect(formatDuration('1m')).toBe('1 bar');
			expect(formatDuration('2m')).toBe('2 bars');
		});

		it('should leave fractional durations bare', () => {
			expect(formatDuration('2n')).toBe('1/2');
			expect(formatDuration('4n.')).toBe('3/8');
			expect(formatDuration('1:1:0')).toBe('1+1/4');
		});

		it('should pass an unknown duration through unchanged', () => {
			expect(formatDuration('16n')).toBe('16n');
		});
	});

	describe('control vocabularies', () => {
		it('should label every duration the stepper can reach', () => {
			for (const duration of DURATION_OPTIONS) {
				expect(DURATION_LABELS[duration]).toBeTruthy();
			}
		});

		it('should label every voicing preset', () => {
			for (const voicing of Object.keys(VOICING_PRESETS)) {
				expect(VOICING_LABELS[voicing]).toBeTruthy();
			}
		});

		it('should have an inversion label for the densest quality', () => {
			const mostNotes = Math.max(...Object.values(QUALITIES).map((notes) => notes.length));

			expect(INVERSION_LABELS.length).toBeGreaterThanOrEqual(mostNotes);
		});
	});

	// ==========================================================================
	// Customization marker
	// ==========================================================================

	describe('isCustomizedChord', () => {
		it('should be false for an untouched chord', () => {
			expect(isCustomizedChord(createTestChord())).toBe(false);
		});

		it('should be true once inversion, voicing or octave moves off the default', () => {
			expect(isCustomizedChord(createTestChord({ inversion: 2 }))).toBe(true);
			expect(isCustomizedChord(createTestChord({ voicing: 'drop2' }))).toBe(true);
			expect(isCustomizedChord(createTestChord({ octave: -1 }))).toBe(true);
		});

		it('should ignore duration, which the block already shows as a label', () => {
			expect(isCustomizedChord(createTestChord({ duration: '2n' }))).toBe(false);
		});
	});

	// ==========================================================================
	// Delete chord (block hover affordance and inspector action)
	// ==========================================================================

	describe('deleteChordFromSlot', () => {
		it('should empty the slot and leave the rest behind', () => {
			addChord(createTestChord());
			addChord(createTestChord({ root: 62, quality: 'm' }));
			const slotCount = progressionState.progression.length;

			deleteChordFromSlot(0);

			expect(progressionState.progression[0]).toBeNull();
			expect(progressionState.progression[1]?.root).toBe(62);
			expect(progressionState.progression.length).toBe(slotCount);
		});

		it('should close the inspector when the deleted slot was the selected one', () => {
			addChord(createTestChord());
			selectSlot(0);

			deleteChordFromSlot(0);

			expect(uiState.selectedSlot).toBeNull();
		});

		it('should leave a selection on another slot alone', () => {
			addChord(createTestChord());
			addChord(createTestChord({ root: 62, quality: 'm' }));
			selectSlot(1);

			deleteChordFromSlot(0);

			expect(uiState.selectedSlot).toBe(1);
		});

		it('should discard a pending audition on the deleted slot', () => {
			addChord(createTestChord());
			selectSlot(0);
			stageCandidate(0, createTestChord({ quality: 'm9' }));

			deleteChordFromSlot(0);

			expect(progressionState.audition).toBeNull();
			expect(uiState.selectedSlot).toBeNull();
		});
	});
});
