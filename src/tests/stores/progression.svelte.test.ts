/**
 * Tests for progression state management
 * These tests verify the reactive state patterns work correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Chord } from '#lib/utils/theory-engine/index.ts';
import { QUALITIES, VOICING_PRESETS } from '#lib/utils/theory-engine/index.ts';
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
	insertSlotWithChord,
	clearChordAt,
	removeSlot,
	addSlot,
	insertSlot,
	canRemoveSlot,
	loadProgressionToCanvas,
	setInversion,
	updateChord,
	clearProgression,
	cycleInversion,
	randomizeVoicing,
	moveChord,
	transposeOctave,
	randomizeChord,
	isProgressionFull,
	MAX_PROGRESSION_SLOTS,
	MIN_PROGRESSION_SLOTS,
	revertAudition,
	stageCandidate
} from '#lib/stores/progression.svelte.ts';
import { setRandomizeOption, initRandomizeOptions } from '#lib/stores/settings.svelte.ts';
import { DEFAULT_RANDOMIZE_OPTIONS } from '#lib/utils/settings-persistence.ts';
import { resetUIState } from '#lib/stores/ui.svelte.ts';
import { isRenderableChord } from '#lib/utils/theory-engine/index.ts';
import { buildLoopTimeline } from '#lib/utils/theory-engine/duration.ts';

// Helper function to create a test chord
function createTestChord(
	root = 60,
	quality: keyof typeof QUALITIES = 'maj7',
	inversion = 0,
	voicing: keyof typeof VOICING_PRESETS = 'close',
	octave = 0
): Chord {
	return { root, quality, inversion, voicing, octave, duration: '1m' };
}

describe('Progression State Management', () => {
	// Reset state before each test
	beforeEach(() => {
		clearScale();
		setScaleFilterEnabled(false);
		clearBuilderState();
		clearProgression();
		initRandomizeOptions({ ...DEFAULT_RANDOMIZE_OPTIONS });
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
			it('should add a chord to first empty slot', () => {
				const chord = createTestChord(60, 'maj7');
				addChord(chord);
				expect(progressionState.progression).toHaveLength(4);
				expect(progressionState.progression[0]).toEqual(chord);
				expect(progressionState.progression[1]).toBeNull();
			});

			it('should add multiple chords in order to first available slots', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				const chord3 = createTestChord(65, '7');

				addChord(chord1);
				addChord(chord2);
				addChord(chord3);

				expect(progressionState.progression).toHaveLength(4);
				expect(progressionState.progression[0]).toEqual(chord1);
				expect(progressionState.progression[1]).toEqual(chord2);
				expect(progressionState.progression[2]).toEqual(chord3);
				expect(progressionState.progression[3]).toBeNull();
			});

			it('should maintain deep reactivity on added chords', () => {
				const chord = createTestChord(60, 'maj7');
				addChord(chord);
				const addedChord = progressionState.progression[0];
				if (addedChord) {
					addedChord.inversion = 1;
					expect(addedChord.inversion).toBe(1);
				}
			});

			it('should not add beyond maximum slot count', () => {
				for (let i = 0; i < MAX_PROGRESSION_SLOTS + 2; i++) {
					addChord(createTestChord(60 + i, 'maj7'));
				}

				expect(progressionState.progression).toHaveLength(MAX_PROGRESSION_SLOTS);
				// First 4 slots filled, extras ignored
				expect(progressionState.progression[0]).not.toBeNull();
				expect(progressionState.progression[3]).not.toBeNull();
			});

			it('should reuse the rest left behind by clearChordAt', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(62, 'm');
				addChord(chord1); // [c1, null, null, null]
				addChord(chord2); // [c1, c2, null, null]

				clearChordAt(0); // [null, c2, null, null]

				const chord3 = createTestChord(64, '7');
				addChord(chord3); // fills the rest at index 0

				expect(progressionState.progression[0]).toEqual(chord3);
				expect(progressionState.progression[1]).toEqual(chord2);
				expect(progressionState.progression).toHaveLength(4);
			});

			it('should append a new slot when every slot is filled but the cap allows more', () => {
				const filled = MIN_PROGRESSION_SLOTS;
				for (let i = 0; i < filled; i++) {
					addChord(createTestChord(60 + i, 'maj7'));
				}
				expect(isProgressionFull()).toBe(true);

				const extra = createTestChord(72, 'm7');
				addChord(extra);

				expect(progressionState.progression).toHaveLength(filled + 1);
				expect(progressionState.progression[filled]).toEqual(extra);
			});
		});

		describe('insertChordAt', () => {
			it('should replace chord at index 0', () => {
				addChord(createTestChord(62, 'm'));
				insertChordAt(0, createTestChord(60, 'maj7'));

				const chord = progressionState.progression[0];
				expect(chord).not.toBeNull();
				if (chord) {
					expect(chord.root).toBe(60);
				}
			});

			it('should insert at any valid index', () => {
				addChord(createTestChord(60, 'maj7'));
				insertChordAt(3, createTestChord(67, '7'));

				expect(progressionState.progression).toHaveLength(4);
				const chord = progressionState.progression[3];
				expect(chord).not.toBeNull();
				if (chord) {
					expect(chord.root).toBe(67);
				}
			});

			it('should replace existing chord at target slot', () => {
				// Fill first 4 slots
				addChord(createTestChord(60, 'maj7'));
				addChord(createTestChord(61, 'm'));
				addChord(createTestChord(62, '7'));
				addChord(createTestChord(63, 'dim'));

				insertChordAt(2, createTestChord(72, 'm'));

				const chord = progressionState.progression[2];
				expect(chord).not.toBeNull();
				if (chord) {
					expect(chord.root).toBe(72);
				}
				expect(progressionState.progression).toHaveLength(4);
			});

			it('should preserve slot settings when replacing an occupied slot', () => {
				const existingChord: Chord = {
					...createTestChord(60, 'maj7', 2, 'drop2', -1),
					duration: '2n.'
				};
				const incomingChord = createTestChord(72, 'm7', 0, 'close', 0);

				addChord(existingChord);
				insertChordAt(0, incomingChord);

				expect(progressionState.progression[0]).toEqual({
					...existingChord,
					root: 72,
					quality: 'm7'
				});
			});

			it('should reset inversion when replacing with a quality that cannot support it', () => {
				const existingChord = createTestChord(60, 'maj13', 5, 'open', 1);
				const incomingChord = createTestChord(65, 'm');

				addChord(existingChord);
				insertChordAt(0, incomingChord);

				expect(progressionState.progression[0]).toEqual({
					...existingChord,
					root: 65,
					quality: 'm',
					inversion: 0
				});
			});

			it('should keep the full incoming chord when inserting into an empty slot', () => {
				const incomingChord: Chord = {
					...createTestChord(67, '7', 2, 'drop3', 2),
					duration: '4n.'
				};

				insertChordAt(2, incomingChord);

				expect(progressionState.progression[2]).toEqual(incomingChord);
			});

			it('should ignore negative indices', () => {
				addChord(createTestChord(60, 'maj7'));
				insertChordAt(-1, createTestChord(65, '7'));

				expect(progressionState.progression).toHaveLength(4);
				const chord = progressionState.progression[0];
				expect(chord).not.toBeNull();
				if (chord) {
					expect(chord.root).toBe(60);
				}
			});

			it('should ignore indices beyond max slots', () => {
				addChord(createTestChord(60, 'maj7'));
				insertChordAt(10, createTestChord(65, '7'));

				const chord = progressionState.progression[0];
				expect(chord).not.toBeNull();
				if (chord) {
					expect(chord.root).toBe(60);
				}
			});
		});

		describe('insertSlotWithChord', () => {
			it('should insert a new slot holding the chord and shift later slots right', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				addChord(chord1);
				addChord(chord2);
				// [c1, c2, null, null]

				const inserted = createTestChord(65, '7');
				insertSlotWithChord(1, inserted);

				expect(progressionState.progression).toHaveLength(5);
				expect(progressionState.progression[0]).toEqual(chord1);
				expect(progressionState.progression[1]).toEqual(inserted);
				expect(progressionState.progression[2]).toEqual(chord2);
			});

			it('should keep every property of the inserted chord', () => {
				const inserted: Chord = {
					...createTestChord(67, '7', 2, 'drop3', 2),
					duration: '4n.'
				};

				insertSlotWithChord(0, inserted);

				expect(progressionState.progression[0]).toEqual(inserted);
			});

			it('should append when inserting at the end of the progression', () => {
				const inserted = createTestChord(65, '7');
				insertSlotWithChord(progressionState.progression.length, inserted);

				expect(progressionState.progression).toHaveLength(5);
				expect(progressionState.progression[4]).toEqual(inserted);
			});

			it('should do nothing at the slot cap', () => {
				progressionState.progression = Array.from({ length: MAX_PROGRESSION_SLOTS }, (_, i) =>
					createTestChord(60 + i, 'maj7')
				);

				insertSlotWithChord(0, createTestChord(72, 'm'));

				expect(progressionState.progression).toHaveLength(MAX_PROGRESSION_SLOTS);
				expect(progressionState.progression[0]?.root).toBe(60);
			});

			it('should ignore out-of-range indices', () => {
				insertSlotWithChord(-1, createTestChord(65, '7'));
				insertSlotWithChord(progressionState.progression.length + 1, createTestChord(65, '7'));

				expect(progressionState.progression).toHaveLength(4);
				expect(progressionState.progression.every((c) => c === null)).toBe(true);
			});
		});

		describe('clearChordAt', () => {
			it('should empty the slot without removing it', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				const chord3 = createTestChord(65, '7');

				addChord(chord1);
				addChord(chord2);
				addChord(chord3);
				// [c1, c2, c3, null]

				clearChordAt(1);

				expect(progressionState.progression).toHaveLength(4);
				expect(progressionState.progression[0]).toEqual(chord1);
				expect(progressionState.progression[1]).toBeNull();
				expect(progressionState.progression[2]).toEqual(chord3);
			});

			it('should leave a rest at the end of the progression', () => {
				const chord = createTestChord(60, 'maj7');
				addChord(chord);

				clearChordAt(0);

				expect(progressionState.progression).toHaveLength(4);
				expect(progressionState.progression[0]).toBeNull();
			});

			it('should be a no-op on an already empty slot', () => {
				const chord = createTestChord(60, 'maj7');
				addChord(chord);

				clearChordAt(2);

				expect(progressionState.progression).toHaveLength(4);
				expect(progressionState.progression[0]).toEqual(chord);
				expect(progressionState.progression[2]).toBeNull();
			});

			it('should handle invalid negative index gracefully', () => {
				const chord = createTestChord(60, 'maj7');
				addChord(chord);

				clearChordAt(-1);

				expect(progressionState.progression).toHaveLength(4);
				expect(progressionState.progression[0]).toEqual(chord);
			});

			it('should handle out-of-bounds index gracefully', () => {
				const chord = createTestChord(60, 'maj7');
				addChord(chord);

				clearChordAt(5);

				expect(progressionState.progression).toHaveLength(4);
				expect(progressionState.progression[0]).toEqual(chord);
			});

			it('should keep the only slot when clearing a single-slot progression', () => {
				progressionState.progression = [createTestChord(60, 'maj7')];

				clearChordAt(0);

				expect(progressionState.progression).toHaveLength(1);
				expect(progressionState.progression[0]).toBeNull();
			});
		});

		describe('removeSlot', () => {
			it('should remove the slot and compact later slots', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				const chord3 = createTestChord(65, '7');

				addChord(chord1);
				addChord(chord2);
				addChord(chord3);
				addSlot();
				// [c1, c2, c3, null, null]

				removeSlot(1);

				expect(progressionState.progression).toHaveLength(4);
				expect(progressionState.progression[0]).toEqual(chord1);
				expect(progressionState.progression[1]).toEqual(chord3);
			});

			it('should handle invalid indices gracefully', () => {
				const chord = createTestChord(60, 'maj7');
				addChord(chord);

				removeSlot(-1);
				removeSlot(5);

				expect(progressionState.progression).toHaveLength(4);
				expect(progressionState.progression[0]).toEqual(chord);
			});

			it('should refuse to shrink below the minimum slot count', () => {
				addChord(createTestChord(60, 'maj7'));
				expect(progressionState.progression).toHaveLength(MIN_PROGRESSION_SLOTS);
				expect(canRemoveSlot()).toBe(false);

				removeSlot(0);
				removeSlot(3);

				expect(progressionState.progression).toHaveLength(MIN_PROGRESSION_SLOTS);
				expect(progressionState.progression[0]).not.toBeNull();
			});

			it('should allow removal again once there are more slots than the minimum', () => {
				addSlot();
				expect(canRemoveSlot()).toBe(true);

				removeSlot(4);

				expect(progressionState.progression).toHaveLength(MIN_PROGRESSION_SLOTS);
				expect(canRemoveSlot()).toBe(false);
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

				const updated = progressionState.progression[1];
				expect(updated).not.toBeNull();
				expect(updated).toEqual(newChord);
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

		describe('loadProgressionToCanvas', () => {
			it('should not let in-place canvas edits reach the loaded source chords', () => {
				// Library entries live in state, so their chords are already proxies
				progressionState.savedProgressions.items = [
					{
						id: 'saved',
						name: 'Saved',
						tags: [],
						progression: [createTestChord(60, 'maj7'), createTestChord(62, 'm'), null, null],
						createdAt: 1
					}
				];
				const saved = progressionState.savedProgressions.items[0];

				loadProgressionToCanvas(saved.progression);
				setInversion(0, 2);

				expect(progressionState.progression[0]?.inversion).toBe(2);
				expect(saved.progression[0]?.inversion).toBe(0);
				progressionState.savedProgressions.items = [];
			});

			it('should keep a short saved progression at its saved length', () => {
				const saved = [createTestChord(60, 'maj7'), createTestChord(62, 'm')];
				loadProgressionToCanvas(saved);

				// Padding would add two silent bars to canvas playback and export
				expect(progressionState.progression).toEqual(saved);
				expect(buildLoopTimeline(progressionState.progression).totalEighths).toBe(
					buildLoopTimeline(saved).totalEighths
				);
				expect(buildLoopTimeline(progressionState.progression).totalEighths).toBe(16);
			});

			it('should not remove slots from a short loaded progression, but can still grow it', () => {
				loadProgressionToCanvas([createTestChord(60, 'maj7'), createTestChord(62, 'm')]);

				expect(canRemoveSlot()).toBe(false);
				removeSlot(0);
				expect(progressionState.progression).toHaveLength(2);

				addSlot();
				insertSlot(1);
				expect(progressionState.progression.map((chord) => chord?.root ?? null)).toEqual([
					60,
					null,
					62,
					null
				]);
			});
		});

		describe('clearProgression', () => {
			it('should set all slots to null', () => {
				addChord(createTestChord(60, 'maj7'));
				addChord(createTestChord(57, 'm'));
				addChord(createTestChord(65, '7'));

				clearProgression();

				expect(progressionState.progression).toHaveLength(4);
				expect(progressionState.progression.every((c) => c === null)).toBe(true);
			});

			it('should work when progression is already empty', () => {
				clearProgression();
				expect(progressionState.progression).toHaveLength(4);
				expect(progressionState.progression.every((c) => c === null)).toBe(true);
			});
		});

		describe('cycleInversion', () => {
			it('should cycle from 0 to 1', () => {
				const chord = createTestChord(60, 'maj7', 0);
				addChord(chord);

				cycleInversion(0);

				const updated = progressionState.progression[0];
				expect(updated).not.toBeNull();
				if (updated) {
					expect(updated.inversion).toBe(1);
				}
			});

			it('should cycle through all inversions', () => {
				const chord = createTestChord(60, 'maj7', 0);
				addChord(chord);

				const numNotes = QUALITIES['maj7'].length;

				// Cycle through all inversions
				for (let i = 1; i < numNotes; i++) {
					cycleInversion(0);
					const current = progressionState.progression[0];
					expect(current).not.toBeNull();
					if (current) {
						expect(current.inversion).toBe(i);
					}
				}

				// Cycle back to root position
				cycleInversion(0);
				const final = progressionState.progression[0];
				expect(final).not.toBeNull();
				if (final) {
					expect(final.inversion).toBe(0);
				}
			});

			it('should wrap around to 0 after max inversion', () => {
				const chord = createTestChord(60, 'maj7', 3);
				addChord(chord);

				cycleInversion(0);

				const updated = progressionState.progression[0];
				expect(updated).not.toBeNull();
				if (updated) {
					expect(updated.inversion).toBe(0);
				}
			});

			it('should handle invalid index gracefully', () => {
				const chord = createTestChord(60, 'maj7', 0);
				addChord(chord);

				cycleInversion(5);

				const unchanged = progressionState.progression[0];
				expect(unchanged).not.toBeNull();
				if (unchanged) {
					expect(unchanged.inversion).toBe(0);
				}
			});

			it('should not affect other chords', () => {
				addChord(createTestChord(60, 'maj7', 0));
				addChord(createTestChord(57, 'm', 0));

				cycleInversion(0);

				const chord1 = progressionState.progression[0];
				const chord2 = progressionState.progression[1];
				expect(chord1).not.toBeNull();
				expect(chord2).not.toBeNull();
				if (chord1 && chord2) {
					expect(chord1.inversion).toBe(1);
					expect(chord2.inversion).toBe(0);
				}
			});

			it('should do nothing when slot is null', () => {
				cycleInversion(0); // Try to cycle null slot
				expect(progressionState.progression[0]).toBeNull();
			});
		});

		describe('randomizeVoicing', () => {
			it('should change voicing to a different preset', () => {
				const chord = createTestChord(60, 'maj7', 0, 'close');
				addChord(chord);

				const original = progressionState.progression[0];
				expect(original).not.toBeNull();
				const originalVoicing = original?.voicing;

				randomizeVoicing(0);

				const updated = progressionState.progression[0];
				expect(updated).not.toBeNull();
				const newVoicing = updated?.voicing;

				expect(newVoicing).not.toBe(originalVoicing);
			});

			it('should select from valid voicing presets', () => {
				const chord = createTestChord(60, 'maj7', 0, 'close');
				addChord(chord);

				randomizeVoicing(0);

				const updated = progressionState.progression[0];
				expect(updated).not.toBeNull();
				if (updated) {
					const validVoicings = Object.keys(VOICING_PRESETS);
					expect(validVoicings).toContain(updated.voicing);
				}
			});

			it('should handle invalid index gracefully', () => {
				const chord = createTestChord(60, 'maj7', 0, 'close');
				addChord(chord);

				randomizeVoicing(5);

				const unchanged = progressionState.progression[0];
				expect(unchanged).not.toBeNull();
				if (unchanged) {
					expect(unchanged.voicing).toBe('close');
				}
			});

			it('should not affect other chords', () => {
				addChord(createTestChord(60, 'maj7', 0, 'close'));
				addChord(createTestChord(57, 'm', 0, 'close'));

				randomizeVoicing(0);

				const chord2 = progressionState.progression[1];
				expect(chord2).not.toBeNull();
				if (chord2) {
					expect(chord2.voicing).toBe('close');
				}
			});

			it('should do nothing when slot is null', () => {
				randomizeVoicing(0); // Try to randomize null slot
				expect(progressionState.progression[0]).toBeNull();
			});
		});

		describe('moveChord', () => {
			it('should swap two chords', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				const chord3 = createTestChord(65, '7');

				addChord(chord1);
				addChord(chord2);
				addChord(chord3);

				moveChord(0, 2); // Swap first and third

				expect(progressionState.progression[0]).toEqual(chord3);
				expect(progressionState.progression[1]).toEqual(chord2);
				expect(progressionState.progression[2]).toEqual(chord1);
			});

			it('should swap adjacent chords', () => {
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

			it('should swap in reverse order', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				const chord3 = createTestChord(65, '7');

				addChord(chord1);
				addChord(chord2);
				addChord(chord3);

				moveChord(2, 0);

				expect(progressionState.progression[0]).toEqual(chord3);
				expect(progressionState.progression[1]).toEqual(chord2);
				expect(progressionState.progression[2]).toEqual(chord1);
			});

			it('should move onto an empty slot, leaving a rest behind', () => {
				const chord1 = createTestChord(60, 'maj7');
				addChord(chord1);

				moveChord(0, 2); // Target is empty → move, not swap

				expect(progressionState.progression[0]).toBeNull();
				expect(progressionState.progression[2]).toEqual(chord1);
			});

			it('should move backwards onto an empty slot', () => {
				const chord1 = createTestChord(60, 'maj7');
				const chord2 = createTestChord(57, 'm');
				addChord(chord1);
				addChord(chord2);
				clearChordAt(0);
				// [null, c2, null, null]

				moveChord(1, 0);

				expect(progressionState.progression[0]).toEqual(chord2);
				expect(progressionState.progression[1]).toBeNull();
			});

			it('should not change the slot count when moving or swapping', () => {
				addChord(createTestChord(60, 'maj7'));
				addChord(createTestChord(57, 'm'));

				moveChord(0, 1); // swap
				moveChord(1, 3); // move

				expect(progressionState.progression).toHaveLength(4);
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

			it('should handle negative fromIndex gracefully', () => {
				const chord1 = createTestChord(60, 'maj7');
				addChord(chord1);

				moveChord(-1, 0);

				expect(progressionState.progression[0]).toEqual(chord1);
			});

			it('should handle negative toIndex gracefully', () => {
				const chord1 = createTestChord(60, 'maj7');
				addChord(chord1);

				moveChord(0, -1);

				expect(progressionState.progression[0]).toEqual(chord1);
			});
		});

		describe('isProgressionFull', () => {
			it('should be false when all slots are null', () => {
				expect(isProgressionFull()).toBe(false);
			});

			it('should be true when all slots have chords', () => {
				for (let i = 0; i < MAX_PROGRESSION_SLOTS; i++) {
					addChord(createTestChord(60 + i, 'maj7'));
				}
				expect(isProgressionFull()).toBe(true);
			});

			it('should be false when some slots are null', () => {
				addChord(createTestChord(60, 'maj7'));
				addChord(createTestChord(62, 'm'));
				// Slots 2 and 3 are null

				expect(isProgressionFull()).toBe(false);
			});

			it('should stay true after removing a slot if no nulls remain', () => {
				// Fill progression completely
				clearProgression();
				// Five chords: four is the minimum, and removeSlot is a no-op there
				for (let i = 0; i < 5; i++) {
					addChord(createTestChord(60 + i, 'maj7'));
				}
				expect(progressionState.progression).toHaveLength(5);
				expect(isProgressionFull()).toBe(true);

				removeSlot(1);

				expect(progressionState.progression.map((chord) => chord?.root)).toEqual([60, 62, 63, 64]);
				expect(isProgressionFull()).toBe(true);
			});

			it('should be false after clearing a chord, since the rest is an empty slot', () => {
				clearProgression();
				addChord(createTestChord(60, 'maj7'));
				addChord(createTestChord(61, 'maj7'));
				addChord(createTestChord(62, 'maj7'));
				addChord(createTestChord(63, 'maj7'));

				clearChordAt(1);

				expect(isProgressionFull()).toBe(false);
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

			expect(progressionState.progression).toHaveLength(4);
			const added = progressionState.progression[0];
			expect(added).not.toBeNull();
			if (added) {
				expect(added.root).toBe(60);
				expect(added.quality).toBe('maj7');
			}
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
			// [c1, c2, c3, null]

			// Modify them
			cycleInversion(0);
			randomizeVoicing(1);
			clearChordAt(2); // Delete c3, leaving a rest

			// [c1, c2, null, null]
			expect(progressionState.progression).toHaveLength(4);
			expect(progressionState.progression[2]).toBeNull();

			const chord0 = progressionState.progression[0];
			expect(chord0).not.toBeNull();
			if (chord0) {
				expect(chord0.inversion).toBe(1);
			}
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

			const progressionChord = progressionState.progression[0];
			expect(progressionChord).not.toBeNull();
			if (progressionChord) {
				expect(progressionChord.root).toBe(60);
			}
		});
	});
});

// ============================================================================
// Octave Transposition Tests
// ============================================================================

describe('transposeOctave', () => {
	beforeEach(() => {
		clearProgression();
	});

	it('should transpose chord up one octave', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		transposeOctave(0, 'up');

		const transposed = progressionState.progression[0];
		expect(transposed).not.toBeNull();
		if (transposed) {
			expect(transposed.octave).toBe(1);
		}
	});

	it('should transpose chord down one octave', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		transposeOctave(0, 'down');

		const transposed = progressionState.progression[0];
		expect(transposed).not.toBeNull();
		if (transposed) {
			expect(transposed.octave).toBe(-1);
		}
	});

	it('should not exceed maximum octave (+2)', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		transposeOctave(0, 'up'); // octave = 1
		transposeOctave(0, 'up'); // octave = 2
		transposeOctave(0, 'up'); // Should stay at 2

		const transposed = progressionState.progression[0];
		expect(transposed).not.toBeNull();
		if (transposed) {
			expect(transposed.octave).toBe(2);
		}
	});

	it('should not exceed minimum octave (-2)', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		transposeOctave(0, 'down'); // octave = -1
		transposeOctave(0, 'down'); // octave = -2
		transposeOctave(0, 'down'); // Should stay at -2

		const transposed = progressionState.progression[0];
		expect(transposed).not.toBeNull();
		if (transposed) {
			expect(transposed.octave).toBe(-2);
		}
	});

	it('should handle invalid index gracefully', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		transposeOctave(5, 'up');

		const unchanged = progressionState.progression[0];
		expect(unchanged).not.toBeNull();
		if (unchanged) {
			expect(unchanged.octave).toBe(0);
		}
	});

	it('should handle negative index gracefully', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		transposeOctave(-1, 'up');

		const unchanged = progressionState.progression[0];
		expect(unchanged).not.toBeNull();
		if (unchanged) {
			expect(unchanged.octave).toBe(0);
		}
	});

	it('should do nothing when slot is null', () => {
		transposeOctave(0, 'up');
		expect(progressionState.progression[0]).toBeNull();
	});
});

// ============================================================================
// Randomize Chord Tests
// ============================================================================

describe('randomizeChord', () => {
	beforeEach(() => {
		clearProgression();
		initRandomizeOptions({ ...DEFAULT_RANDOMIZE_OPTIONS });
	});

	it('should keep root and octave unchanged', () => {
		const chord = createTestChord(60, 'maj7');
		chord.octave = 1;
		addChord(chord);

		const originalRoot = chord.root;
		const originalOctave = chord.octave;

		randomizeChord(0);

		const randomized = progressionState.progression[0];
		expect(randomized).not.toBeNull();
		if (randomized) {
			expect(randomized.root).toBe(originalRoot);
			expect(randomized.octave).toBe(originalOctave);
		}
	});

	it('should change quality when quality option is enabled', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		// Enable quality randomization (off by default)
		setRandomizeOption('quality', true);

		let qualityChanged = false;
		for (let i = 0; i < 20; i++) {
			randomizeChord(0);
			const randomized = progressionState.progression[0];
			if (randomized && randomized.quality !== 'maj7') {
				qualityChanged = true;
				break;
			}
		}

		expect(qualityChanged).toBe(true);
	});

	it('should NOT change quality when quality option is disabled (default)', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		// Quality is OFF by default, so it should not change
		for (let i = 0; i < 10; i++) {
			randomizeChord(0);
			const randomized = progressionState.progression[0];
			expect(randomized?.quality).toBe('maj7');
		}
	});

	it('should set valid inversion for the new quality', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		randomizeChord(0);

		const randomized = progressionState.progression[0];
		expect(randomized).not.toBeNull();
		if (randomized) {
			const newQuality = randomized.quality;
			const intervals = QUALITIES[newQuality];
			const maxInversion = intervals.length - 1;

			expect(randomized.inversion).toBeGreaterThanOrEqual(0);
			expect(randomized.inversion).toBeLessThanOrEqual(maxInversion);
		}
	});

	it('should change voicing', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		let voicingChanged = false;
		for (let i = 0; i < 20; i++) {
			randomizeChord(0);
			const randomized = progressionState.progression[0];
			if (randomized && randomized.voicing !== 'close') {
				voicingChanged = true;
				break;
			}
		}

		expect(voicingChanged).toBe(true);
	});

	it('should handle invalid index gracefully', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		randomizeChord(5);

		const unchanged = progressionState.progression[0];
		expect(unchanged).not.toBeNull();
		if (unchanged) {
			expect(unchanged.quality).toBe('maj7');
		}
	});

	it('should handle negative index gracefully', () => {
		const chord = createTestChord(60, 'maj7');
		addChord(chord);

		randomizeChord(-1);

		const unchanged = progressionState.progression[0];
		expect(unchanged).not.toBeNull();
		if (unchanged) {
			expect(unchanged.quality).toBe('maj7');
		}
	});

	it('should do nothing when slot is null', () => {
		randomizeChord(0);
		expect(progressionState.progression[0]).toBeNull();
	});

	it('should randomize octave when octave option is enabled', () => {
		const chord = createTestChord(60, 'maj7');
		chord.octave = 0;
		addChord(chord);

		// Enable octave randomization (off by default)
		setRandomizeOption('octave', true);

		let octaveChanged = false;
		for (let i = 0; i < 20; i++) {
			randomizeChord(0);
			const randomized = progressionState.progression[0];
			if (randomized && randomized.octave !== 0) {
				octaveChanged = true;
				break;
			}
		}

		expect(octaveChanged).toBe(true);
	});

	it('should NOT randomize octave when octave option is disabled (default)', () => {
		const chord = createTestChord(60, 'maj7');
		chord.octave = 1;
		addChord(chord);

		// Octave is OFF by default, so it should not change
		for (let i = 0; i < 10; i++) {
			randomizeChord(0);
			const randomized = progressionState.progression[0];
			expect(randomized?.octave).toBe(1);
		}
	});

	it('should do nothing when all options are disabled', () => {
		const chord = createTestChord(60, 'maj7');
		chord.inversion = 1;
		chord.voicing = 'open';
		chord.octave = 1;
		addChord(chord);

		// Disable all options
		setRandomizeOption('inversion', false);
		setRandomizeOption('voicing', false);
		setRandomizeOption('octave', false);
		setRandomizeOption('quality', false);

		randomizeChord(0);

		const unchanged = progressionState.progression[0];
		expect(unchanged?.quality).toBe('maj7');
		expect(unchanged?.inversion).toBe(1);
		expect(unchanged?.voicing).toBe('open');
		expect(unchanged?.octave).toBe(1);
	});

	describe('with quality randomization', () => {
		beforeEach(() => {
			resetUIState();
			setRandomizeOption('quality', true);
			setRandomizeOption('inversion', false);
			setRandomizeOption('voicing', false);
		});

		it('resets an inversion the new quality cannot voice', () => {
			addChord(createTestChord(60, '13', 5));
			// First quality in the pool: a triad.
			const random = vi.spyOn(Math, 'random').mockReturnValue(0);
			randomizeChord(0);
			random.mockRestore();

			const chord = progressionState.progression[0]!;
			expect(chord.inversion).toBeLessThan(QUALITIES[chord.quality].length);
			expect(isRenderableChord(chord)).toBe(true);
		});

		it('ends a pending audition so Revert cannot undo the randomized harmony', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(60, 'm7'));
			expect(progressionState.audition).not.toBeNull();

			const random = vi.spyOn(Math, 'random').mockReturnValue(0);
			randomizeChord(0);
			random.mockRestore();
			const randomizedQuality = progressionState.progression[0]!.quality;

			expect(progressionState.audition).toBeNull();
			revertAudition();
			expect(progressionState.progression[0]?.quality).toBe(randomizedQuality);
		});
	});
});
