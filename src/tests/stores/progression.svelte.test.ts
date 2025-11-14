/**
 * Tests for progression state management
 * These tests verify the reactive state patterns work correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Chord } from '$lib/utils/theory-engine';
import { QUALITIES, VOICING_PRESETS } from '$lib/utils/theory-engine';
import {
	progressionState,
	setScale,
	clearScale,
	toggleScaleFilter,
	setScaleFilterEnabled,
	selectRoot,
	selectQuality,
	clearBuilderState,
	addChord,
	insertChordAt,
	removeChord,
	updateChord,
	clearProgression,
	cycleInversion,
	randomizeVoicing,
	moveChord,
	isProgressionFull,
	MAX_PROGRESSION_SLOTS
} from '$lib/stores/progression.svelte';

// Helper function to create a test chord
function createTestChord(
	root: number = 60,
	quality: keyof typeof QUALITIES = 'maj7',
	inversion: number = 0,
	voicing: keyof typeof VOICING_PRESETS = 'close'
): Chord {
	return { root, quality, inversion, voicing };
}

describe('Progression State Management', () => {
	// Reset state before each test
	beforeEach(() => {
		clearScale();
		setScaleFilterEnabled(false);
		clearBuilderState();
		clearProgression();
	});

	// ============================================================================
	// Scale Management Tests
	// ============================================================================

	describe('Scale Management', () => {
		describe('setScale', () => {
			it('should set scale with key and mode', () => {
				setScale('C', 'major');
				expect(progressionState.scale).toEqual({ key: 'C', mode: 'major' });
			});

			it('should update existing scale', () => {
				setScale('C', 'major');
				setScale('D', 'minor');
				expect(progressionState.scale).toEqual({ key: 'D', mode: 'minor' });
			});

			it('should handle different modes', () => {
				setScale('G', 'dorian');
				expect(progressionState.scale).toEqual({ key: 'G', mode: 'dorian' });
			});
		});

		describe('clearScale', () => {
			it('should clear the scale to null', () => {
				setScale('C', 'major');
				clearScale();
				expect(progressionState.scale).toBeNull();
			});

			it('should work when scale is already null', () => {
				clearScale();
				expect(progressionState.scale).toBeNull();
			});
		});

		describe('toggleScaleFilter', () => {
			it('should toggle from false to true', () => {
				expect(progressionState.scaleFilterEnabled).toBe(false);
				toggleScaleFilter();
				expect(progressionState.scaleFilterEnabled).toBe(true);
			});

			it('should toggle from true to false', () => {
				setScaleFilterEnabled(true);
				toggleScaleFilter();
				expect(progressionState.scaleFilterEnabled).toBe(false);
			});

			it('should toggle multiple times', () => {
				toggleScaleFilter(); // false → true
				expect(progressionState.scaleFilterEnabled).toBe(true);
				toggleScaleFilter(); // true → false
				expect(progressionState.scaleFilterEnabled).toBe(false);
				toggleScaleFilter(); // false → true
				expect(progressionState.scaleFilterEnabled).toBe(true);
			});
		});

		describe('setScaleFilterEnabled', () => {
			it('should set filter to true', () => {
				setScaleFilterEnabled(true);
				expect(progressionState.scaleFilterEnabled).toBe(true);
			});

			it('should set filter to false', () => {
				setScaleFilterEnabled(true);
				setScaleFilterEnabled(false);
				expect(progressionState.scaleFilterEnabled).toBe(false);
			});

			it('should be idempotent', () => {
				setScaleFilterEnabled(true);
				setScaleFilterEnabled(true);
				expect(progressionState.scaleFilterEnabled).toBe(true);
			});
		});
	});

	// ============================================================================
	// Builder State Tests
	// ============================================================================

	describe('Builder State Management', () => {
		describe('selectRoot', () => {
			it('should set selected root note', () => {
				selectRoot(60);
				expect(progressionState.builderState.selectedRoot).toBe(60);
			});

			it('should update existing root selection', () => {
				selectRoot(60);
				selectRoot(64);
				expect(progressionState.builderState.selectedRoot).toBe(64);
			});

			it('should accept different MIDI note numbers', () => {
				selectRoot(72); // C5
				expect(progressionState.builderState.selectedRoot).toBe(72);
			});
		});

		describe('selectQuality', () => {
			it('should set selected quality', () => {
				selectQuality('maj7');
				expect(progressionState.builderState.selectedQuality).toBe('maj7');
			});

			it('should update existing quality selection', () => {
				selectQuality('maj7');
				selectQuality('m');
				expect(progressionState.builderState.selectedQuality).toBe('m');
			});

			it('should handle major triad (empty string)', () => {
				selectQuality('');
				expect(progressionState.builderState.selectedQuality).toBe('');
			});
		});

		describe('clearBuilderState', () => {
			it('should clear root and quality selections', () => {
				selectRoot(60);
				selectQuality('maj7');
				clearBuilderState();
				expect(progressionState.builderState.selectedRoot).toBeNull();
				expect(progressionState.builderState.selectedQuality).toBeNull();
			});

			it('should work when builder state is already clear', () => {
				clearBuilderState();
				expect(progressionState.builderState.selectedRoot).toBeNull();
				expect(progressionState.builderState.selectedQuality).toBeNull();
			});
		});
	});

	// ============================================================================
	// Progression Management Tests
	// ============================================================================

	describe('Progression Management', () => {
		describe('addChord', () => {
			it('should add a chord to empty progression', () => {
				const chord = createTestChord(60, 'maj7');
				addChord(chord);
				expect(progressionState.progression).toHaveLength(1);
				expect(progressionState.progression[0]).toEqual(chord);
			});

			it('should add multiple chords in order', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				const chord3 = createTestChord(65, '7');

				addChord(chord1);
				addChord(chord2);
				addChord(chord3);

				expect(progressionState.progression).toHaveLength(3);
				expect(progressionState.progression[0]).toEqual(chord1);
				expect(progressionState.progression[1]).toEqual(chord2);
				expect(progressionState.progression[2]).toEqual(chord3);
			});

			it('should maintain deep reactivity on added chords', () => {
				const chord = createTestChord(60, 'maj7');
				addChord(chord);
				progressionState.progression[0].inversion = 1;
				expect(progressionState.progression[0].inversion).toBe(1);
			});

			it('should not exceed maximum slot count', () => {
				for (let i = 0; i < MAX_PROGRESSION_SLOTS + 2; i++) {
					addChord(createTestChord(60 + i, 'maj7'));
				}

				expect(progressionState.progression).toHaveLength(MAX_PROGRESSION_SLOTS);
			});
		});

		describe('insertChordAt', () => {
			it('should insert at the beginning when index is 0', () => {
				addChord(createTestChord(62, 'm'));
				insertChordAt(0, createTestChord(60, 'maj7'));

				expect(progressionState.progression[0].root).toBe(60);
			});

			it('should insert at the end when index exceeds length', () => {
				addChord(createTestChord(60, 'maj7'));
				insertChordAt(3, createTestChord(67, '7'));

				expect(progressionState.progression).toHaveLength(2);
				expect(progressionState.progression[1].root).toBe(67);
			});

			it('should replace target slot when progression is full', () => {
				for (let i = 0; i < MAX_PROGRESSION_SLOTS; i++) {
					addChord(createTestChord(60 + i, 'maj7'));
				}

				insertChordAt(2, createTestChord(72, 'm'));

				expect(progressionState.progression[2].root).toBe(72);
				expect(progressionState.progression).toHaveLength(MAX_PROGRESSION_SLOTS);
			});

			it('should ignore negative indices', () => {
				addChord(createTestChord(60, 'maj7'));
				insertChordAt(-1, createTestChord(65, '7'));

				expect(progressionState.progression).toHaveLength(1);
				expect(progressionState.progression[0].root).toBe(60);
			});
		});

		describe('removeChord', () => {
			it('should remove chord at valid index', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				const chord3 = createTestChord(65, '7');

				addChord(chord1);
				addChord(chord2);
				addChord(chord3);

				removeChord(1);

				expect(progressionState.progression).toHaveLength(2);
				expect(progressionState.progression[0]).toEqual(chord1);
				expect(progressionState.progression[1]).toEqual(chord3);
			});

			it('should remove first chord', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');

				addChord(chord1);
				addChord(chord2);

				removeChord(0);

				expect(progressionState.progression).toHaveLength(1);
				expect(progressionState.progression[0]).toEqual(chord2);
			});

			it('should remove last chord', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');

				addChord(chord1);
				addChord(chord2);

				removeChord(1);

				expect(progressionState.progression).toHaveLength(1);
				expect(progressionState.progression[0]).toEqual(chord1);
			});

			it('should handle invalid negative index gracefully', () => {
				const chord = createTestChord(60, 'maj7');
				addChord(chord);

				removeChord(-1);

				expect(progressionState.progression).toHaveLength(1);
			});

			it('should handle out-of-bounds index gracefully', () => {
				const chord = createTestChord(60, 'maj7');
				addChord(chord);

				removeChord(5);

				expect(progressionState.progression).toHaveLength(1);
			});
		});

		describe('updateChord', () => {
			it('should update chord at valid index', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				const newChord = createTestChord(65, '7');

				addChord(chord1);
				addChord(chord2);

				updateChord(1, newChord);

				expect(progressionState.progression[1]).toEqual(newChord);
			});

			it('should not affect other chords', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				const newChord = createTestChord(65, '7');

				addChord(chord1);
				addChord(chord2);

				updateChord(1, newChord);

				expect(progressionState.progression[0]).toEqual(chord1);
			});

			it('should handle invalid index gracefully', () => {
				const chord = createTestChord(60, 'maj7');
				const newChord = createTestChord(65, '7');

				addChord(chord);
				updateChord(5, newChord);

				expect(progressionState.progression[0]).toEqual(chord);
			});
		});

		describe('clearProgression', () => {
			it('should clear all chords from progression', () => {
				addChord(createTestChord(60, 'maj7'));
				addChord(createTestChord(57, 'm'));
				addChord(createTestChord(65, '7'));

				clearProgression();

				expect(progressionState.progression).toHaveLength(0);
				expect(progressionState.progression).toEqual([]);
			});

			it('should work when progression is already empty', () => {
				clearProgression();
				expect(progressionState.progression).toEqual([]);
			});
		});

		describe('cycleInversion', () => {
			it('should cycle from 0 to 1', () => {
				const chord = createTestChord(60, 'maj7', 0);
				addChord(chord);

				cycleInversion(0);

				expect(progressionState.progression[0].inversion).toBe(1);
			});

			it('should cycle through all inversions', () => {
				const chord = createTestChord(60, 'maj7', 0);
				addChord(chord);

				const numNotes = QUALITIES['maj7'].length;

				// Cycle through all inversions
				for (let i = 1; i < numNotes; i++) {
					cycleInversion(0);
					expect(progressionState.progression[0].inversion).toBe(i);
				}

				// Cycle back to root position
				cycleInversion(0);
				expect(progressionState.progression[0].inversion).toBe(0);
			});

			it('should wrap around to 0 after max inversion', () => {
				const chord = createTestChord(60, 'maj7', 3);
				addChord(chord);

				cycleInversion(0);

				expect(progressionState.progression[0].inversion).toBe(0);
			});

			it('should handle invalid index gracefully', () => {
				const chord = createTestChord(60, 'maj7', 0);
				addChord(chord);

				cycleInversion(5);

				expect(progressionState.progression[0].inversion).toBe(0);
			});

			it('should not affect other chords', () => {
				addChord(createTestChord(60, 'maj7', 0));
				addChord(createTestChord(57, 'm', 0));

				cycleInversion(0);

				expect(progressionState.progression[0].inversion).toBe(1);
				expect(progressionState.progression[1].inversion).toBe(0);
			});
		});

		describe('randomizeVoicing', () => {
			it('should change voicing to a different preset', () => {
				const chord = createTestChord(60, 'maj7', 0, 'close');
				addChord(chord);

				const originalVoicing = progressionState.progression[0].voicing;
				randomizeVoicing(0);
				const newVoicing = progressionState.progression[0].voicing;

				expect(newVoicing).not.toBe(originalVoicing);
			});

			it('should select from valid voicing presets', () => {
				const chord = createTestChord(60, 'maj7', 0, 'close');
				addChord(chord);

				randomizeVoicing(0);

				const validVoicings = Object.keys(VOICING_PRESETS);
				expect(validVoicings).toContain(progressionState.progression[0].voicing);
			});

			it('should handle invalid index gracefully', () => {
				const chord = createTestChord(60, 'maj7', 0, 'close');
				addChord(chord);

				randomizeVoicing(5);

				expect(progressionState.progression[0].voicing).toBe('close');
			});

			it('should not affect other chords', () => {
				addChord(createTestChord(60, 'maj7', 0, 'close'));
				addChord(createTestChord(57, 'm', 0, 'close'));

				randomizeVoicing(0);

				expect(progressionState.progression[1].voicing).toBe('close');
			});
		});

		describe('moveChord', () => {
			it('should move chord to new position', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				const chord3 = createTestChord(65, '7');

				addChord(chord1);
				addChord(chord2);
				addChord(chord3);

				moveChord(0, 2); // Move first to last

				expect(progressionState.progression[0]).toEqual(chord2);
				expect(progressionState.progression[1]).toEqual(chord3);
				expect(progressionState.progression[2]).toEqual(chord1);
			});

			it('should move chord forward', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				const chord3 = createTestChord(65, '7');

				addChord(chord1);
				addChord(chord2);
				addChord(chord3);

				moveChord(0, 1);

				expect(progressionState.progression[0]).toEqual(chord2);
				expect(progressionState.progression[1]).toEqual(chord1);
				expect(progressionState.progression[2]).toEqual(chord3);
			});

			it('should move chord backward', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				const chord3 = createTestChord(65, '7');

				addChord(chord1);
				addChord(chord2);
				addChord(chord3);

				moveChord(2, 0);

				expect(progressionState.progression[0]).toEqual(chord3);
				expect(progressionState.progression[1]).toEqual(chord1);
				expect(progressionState.progression[2]).toEqual(chord2);
			});

			it('should handle same position gracefully', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');

				addChord(chord1);
				addChord(chord2);

				moveChord(0, 0);

				expect(progressionState.progression[0]).toEqual(chord1);
				expect(progressionState.progression[1]).toEqual(chord2);
			});

			it('should handle invalid fromIndex gracefully', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');

				addChord(chord1);
				addChord(chord2);

				moveChord(5, 0);

				expect(progressionState.progression[0]).toEqual(chord1);
				expect(progressionState.progression[1]).toEqual(chord2);
			});

			it('should handle invalid toIndex gracefully', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');

				addChord(chord1);
				addChord(chord2);

				moveChord(0, 5);

				expect(progressionState.progression[0]).toEqual(chord1);
				expect(progressionState.progression[1]).toEqual(chord2);
			});
		});

		describe('isProgressionFull', () => {
			it('should be false when empty', () => {
				expect(isProgressionFull()).toBe(false);
			});

			it('should be true when reaching max slots', () => {
				for (let i = 0; i < MAX_PROGRESSION_SLOTS; i++) {
					addChord(createTestChord(60 + i, 'maj7'));
				}
				expect(isProgressionFull()).toBe(true);
			});

			it('should remain true after attempting to overfill', () => {
				for (let i = 0; i < MAX_PROGRESSION_SLOTS + 1; i++) {
					addChord(createTestChord(60 + i, 'maj7'));
				}

				expect(isProgressionFull()).toBe(true);
				expect(progressionState.progression).toHaveLength(MAX_PROGRESSION_SLOTS);
			});
		});
	});

	// ============================================================================
	// Integration Tests
	// ============================================================================

	describe('Integration Scenarios', () => {
		it('should handle complete workflow: build and add chord', () => {
			selectRoot(60);
			selectQuality('maj7');

			expect(progressionState.builderState.selectedRoot).toBe(60);
			expect(progressionState.builderState.selectedQuality).toBe('maj7');

			const chord = createTestChord(
				progressionState.builderState.selectedRoot!,
				progressionState.builderState.selectedQuality! as 'maj7'
			);
			addChord(chord);

			expect(progressionState.progression).toHaveLength(1);
			expect(progressionState.progression[0].root).toBe(60);
			expect(progressionState.progression[0].quality).toBe('maj7');
		});

		it('should handle setting scale and filter together', () => {
			setScale('C', 'major');
			setScaleFilterEnabled(true);

			expect(progressionState.scale).toEqual({ key: 'C', mode: 'major' });
			expect(progressionState.scaleFilterEnabled).toBe(true);
		});

		it('should handle building progression with modifications', () => {
			// Add chords
			addChord(createTestChord(60, 'maj7', 0, 'close'));
			addChord(createTestChord(57, 'm', 0, 'close'));
			addChord(createTestChord(65, '7', 0, 'close'));

			// Modify them
			cycleInversion(0);
			randomizeVoicing(1);
			removeChord(2);

			expect(progressionState.progression).toHaveLength(2);
			expect(progressionState.progression[0].inversion).toBe(1);
		});

		it('should maintain state isolation between different concerns', () => {
			// Set up scale
			setScale('G', 'major');
			setScaleFilterEnabled(true);

			// Set up builder
			selectRoot(67);
			selectQuality('m');

			// Add to progression
			addChord(createTestChord(60, 'maj7'));

			// Verify isolation
			expect(progressionState.scale?.key).toBe('G');
			expect(progressionState.builderState.selectedRoot).toBe(67);
			expect(progressionState.progression[0].root).toBe(60);
		});
	});
});
