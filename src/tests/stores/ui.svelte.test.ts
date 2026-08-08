/**
 * Tests for the UI interaction store: slot selection, the library rail panel,
 * and the live-audition transaction (including its integrity hooks).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Chord } from '$lib/utils/theory-engine';
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
	selectQuality,
	selectRoot,
	updateChord,
	MAX_PROGRESSION_SLOTS
} from '$lib/stores/progression.svelte';
import {
	uiState,
	selectSlot,
	deselectSlot,
	openLibraryPanel,
	closeLibraryPanel,
	toggleLibraryPanel,
	closeAutoOpenedLibraryPanel,
	pinLibraryPanel,
	stageCandidate,
	commitAudition,
	revertAudition,
	resetUIState,
	getReadyBarAction,
	getReadyChord,
	performReadyBarAction,
	setTransportActive,
	markSlotQueuedIfCurrent,
	acknowledgeQueuedSlotOnArrival
} from '$lib/stores/ui.svelte';

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

describe('UI Interaction State', () => {
	beforeEach(() => {
		clearProgression();
		clearBuilderState();
		resetUIState();
	});

	// ==========================================================================
	// Slot Selection
	// ==========================================================================

	describe('selectSlot', () => {
		it('should set the selected slot', () => {
			addChord(createTestChord(60, 'maj7'));

			selectSlot(0);

			expect(uiState.selectedSlot).toBe(0);
		});

		it('should sync the builder to the selected slot chord', () => {
			addChord(createTestChord(65, 'm7'));

			selectSlot(0);

			expect(progressionState.builderState.selectedRoot).toBe(65);
			expect(progressionState.builderState.selectedQuality).toBe('m7');
		});

		it('should leave the builder alone when selecting an empty slot', () => {
			addChord(createTestChord(65, 'm7'));
			selectSlot(0);

			selectSlot(2); // empty slot

			expect(uiState.selectedSlot).toBe(2);
			expect(progressionState.builderState.selectedRoot).toBe(65);
			expect(progressionState.builderState.selectedQuality).toBe('m7');
		});

		it('should ignore out-of-range indices', () => {
			selectSlot(-1);
			expect(uiState.selectedSlot).toBeNull();

			selectSlot(MAX_PROGRESSION_SLOTS);
			expect(uiState.selectedSlot).toBeNull();
		});

		it('should commit a pending audition when selecting a different slot', () => {
			addChord(createTestChord(60, 'maj7'));
			addChord(createTestChord(62, 'm'));
			selectSlot(0);
			stageCandidate(0, createTestChord(60, 'm9'));
			expect(uiState.audition).not.toBeNull();

			selectSlot(1);

			expect(uiState.audition).toBeNull();
			// The candidate stays: deselecting is the commit gesture
			expect(progressionState.progression[0]?.quality).toBe('m9');
		});

		it('should keep a pending audition when re-selecting the same slot', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			stageCandidate(0, createTestChord(60, 'm9'));

			selectSlot(0);

			expect(uiState.audition?.baselineQuality).toBe('maj7');
		});
	});

	describe('deselectSlot', () => {
		it('should clear the selection and commit a pending audition', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			stageCandidate(0, createTestChord(60, '7b9'));

			deselectSlot();

			expect(uiState.selectedSlot).toBeNull();
			expect(uiState.audition).toBeNull();
			expect(progressionState.progression[0]?.quality).toBe('7b9');
		});
	});

	// ==========================================================================
	// Library Panel
	// ==========================================================================

	describe('libraryPanel', () => {
		it('should start collapsed', () => {
			expect(uiState.libraryPanel.open).toBeNull();
			expect(uiState.libraryPanel.autoOpened).toBe(false);
		});

		it('should open a section', () => {
			openLibraryPanel('palette');

			expect(uiState.libraryPanel.open).toBe('palette');
			expect(uiState.libraryPanel.autoOpened).toBe(false);
		});

		it('should behave as tabs, showing one section at a time', () => {
			openLibraryPanel('palette');
			openLibraryPanel('saved');

			expect(uiState.libraryPanel.open).toBe('saved');
		});

		it('should collapse when toggling the active section', () => {
			toggleLibraryPanel('palette');
			expect(uiState.libraryPanel.open).toBe('palette');

			toggleLibraryPanel('palette');
			expect(uiState.libraryPanel.open).toBeNull();
		});

		it('should switch sections when toggling an inactive one', () => {
			toggleLibraryPanel('palette');
			toggleLibraryPanel('saved');

			expect(uiState.libraryPanel.open).toBe('saved');
		});

		it('should collapse an auto-opened panel when a drag leaves', () => {
			openLibraryPanel('palette', true);
			expect(uiState.libraryPanel.autoOpened).toBe(true);

			closeAutoOpenedLibraryPanel();

			expect(uiState.libraryPanel.open).toBeNull();
		});

		it('should leave a user-opened panel alone when a drag leaves', () => {
			openLibraryPanel('palette');
			openLibraryPanel('palette', true); // drag over an already-open panel

			expect(uiState.libraryPanel.autoOpened).toBe(false);
			closeAutoOpenedLibraryPanel();
			expect(uiState.libraryPanel.open).toBe('palette');
		});

		it('should keep an auto-opened panel open once pinned by a drop', () => {
			openLibraryPanel('palette', true);

			pinLibraryPanel();
			closeAutoOpenedLibraryPanel();

			expect(uiState.libraryPanel.open).toBe('palette');
		});

		it('should clear autoOpened on close', () => {
			openLibraryPanel('saved', true);

			closeLibraryPanel();

			expect(uiState.libraryPanel.open).toBeNull();
			expect(uiState.libraryPanel.autoOpened).toBe(false);
		});
	});

	// ==========================================================================
	// ReadyBar action state machine
	// ==========================================================================

	describe('ReadyBar actions', () => {
		function ready(root = 60, quality: keyof typeof QUALITIES = 'maj7'): void {
			selectRoot(root);
			selectQuality(quality);
		}

		it('should stay absent until root and quality are both selected', () => {
			selectRoot(60);

			expect(getReadyChord()).toBeNull();
			expect(getReadyBarAction()).toBeNull();
		});

		it('should add the ready chord to the first empty slot', () => {
			ready(62, 'm7');

			expect(getReadyBarAction()).toMatchObject({ kind: 'add', disabled: false });
			expect(performReadyBarAction()).toBe(true);
			expect(progressionState.progression[0]).toEqual(createTestChord(62, 'm7'));
		});

		it('should append below the cap when every existing slot is occupied', () => {
			progressionState.progression = [
				createTestChord(60),
				createTestChord(62),
				createTestChord(64),
				createTestChord(65)
			];
			ready(67, '7');

			expect(performReadyBarAction()).toBe(true);
			expect(progressionState.progression).toHaveLength(5);
			expect(progressionState.progression[4]?.root).toBe(67);
		});

		it('should disable Add with a full hint only at the real slot cap', () => {
			progressionState.progression = Array.from({ length: MAX_PROGRESSION_SLOTS }, (_, index) =>
				createTestChord(60 + index)
			);
			ready();

			expect(getReadyBarAction()).toEqual({
				kind: 'add',
				label: '+ Add to progression',
				disabled: true,
				hint: 'Progression is full'
			});
			expect(performReadyBarAction()).toBe(false);
		});

		it('should replace selected-slot harmony while stopped and preserve performance settings', () => {
			addChord(createTestChord(60, 'maj7', 2, 'drop2', -1, '2n.'));
			selectSlot(0);
			ready(67, 'm9');

			expect(getReadyBarAction()?.kind).toBe('replace');
			expect(performReadyBarAction()).toBe(true);
			expect(progressionState.progression[0]).toEqual(
				createTestChord(67, 'm9', 2, 'drop2', -1, '2n.')
			);
		});

		it('should hide the playing action until browsing stages a candidate, then commit it', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			setTransportActive(true);

			expect(getReadyBarAction()).toBeNull();

			stageCandidate(0, createTestChord(60, 'm9'));
			expect(getReadyBarAction()?.kind).toBe('commit');
			expect(performReadyBarAction()).toBe(true);
			expect(uiState.audition).toBeNull();
			expect(progressionState.progression[0]?.quality).toBe('m9');
		});

		it('should preserve a pending candidate across Stop and return to Replace', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			setTransportActive(true);
			stageCandidate(0, createTestChord(60, 'm9'));

			setTransportActive(false);

			expect(uiState.audition?.baselineQuality).toBe('maj7');
			expect(getReadyBarAction()?.kind).toBe('replace');
		});
	});

	describe('queued edit feedback', () => {
		it('should mark only edits targeting each current playing slot', () => {
			setTransportActive(true);

			markSlotQueuedIfCurrent(1, 0);
			expect(uiState.queuedSlots).toEqual([]);

			markSlotQueuedIfCurrent(0, 0);
			markSlotQueuedIfCurrent(1, 1);
			expect(uiState.queuedSlots).toEqual([0, 1]);
		});

		it('should clear each slot on its own return, not while it remains current', () => {
			setTransportActive(true);
			markSlotQueuedIfCurrent(0, 0);
			markSlotQueuedIfCurrent(1, 1);

			acknowledgeQueuedSlotOnArrival(1, 1);
			expect(uiState.queuedSlots).toEqual([0, 1]);

			acknowledgeQueuedSlotOnArrival(0, 1);
			expect(uiState.queuedSlots).toEqual([1]);
			acknowledgeQueuedSlotOnArrival(1, 0);
			expect(uiState.queuedSlots).toEqual([]);
		});
	});

	// ==========================================================================
	// Audition Transaction
	// ==========================================================================

	describe('stageCandidate', () => {
		it('should capture the baseline harmony and apply the candidate', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);

			stageCandidate(0, createTestChord(67, 'm9'));

			expect(uiState.audition).toEqual({
				slotIndex: 0,
				baselineRoot: 60,
				baselineQuality: 'maj7'
			});
			expect(progressionState.progression[0]?.root).toBe(67);
			expect(progressionState.progression[0]?.quality).toBe('m9');
		});

		it('should resolve the transaction when browsing returns to the baseline harmony', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);

			stageCandidate(0, createTestChord(60, 'm9'));
			stageCandidate(0, createTestChord(60, 'maj7'));

			expect(uiState.audition).toBeNull();
			expect(progressionState.progression[0]?.quality).toBe('maj7');
		});

		it('should capture the baseline only once per transaction', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);

			stageCandidate(0, createTestChord(62, 'm'));
			stageCandidate(0, createTestChord(64, '7'));
			stageCandidate(0, createTestChord(65, 'dim'));

			expect(uiState.audition).toEqual({
				slotIndex: 0,
				baselineRoot: 60,
				baselineQuality: 'maj7'
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

			expect(uiState.audition).toEqual({
				slotIndex: 1,
				baselineRoot: 62,
				baselineQuality: 'm'
			});
			// The first slot's candidate was committed by the target switch
			expect(progressionState.progression[0]?.quality).toBe('m9');
		});

		it('should place the chord but start no transaction on an empty slot', () => {
			const candidate = createTestChord(67, '7');

			stageCandidate(1, candidate);

			expect(progressionState.progression[1]).toEqual(candidate);
			expect(uiState.audition).toBeNull();
		});

		it('should ignore slots outside the progression', () => {
			stageCandidate(-1, createTestChord(60, 'maj7'));
			stageCandidate(progressionState.progression.length, createTestChord(60, 'maj7'));

			expect(uiState.audition).toBeNull();
			expect(progressionState.progression.every((c) => c === null)).toBe(true);
		});
	});

	describe('commitAudition', () => {
		it('should keep the candidate and clear the record', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(67, 'm9'));

			commitAudition();

			expect(uiState.audition).toBeNull();
			expect(progressionState.progression[0]?.root).toBe(67);
			expect(progressionState.progression[0]?.quality).toBe('m9');
		});

		it('should be safe with nothing pending', () => {
			expect(() => commitAudition()).not.toThrow();
			expect(uiState.audition).toBeNull();
		});
	});

	describe('revertAudition', () => {
		it('should restore the baseline harmony and clear the record', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(67, 'm9'));

			revertAudition();

			expect(uiState.audition).toBeNull();
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

			expect(uiState.audition?.slotIndex).toBe(2);
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

			expect(uiState.audition?.slotIndex).toBe(0);
		});

		it('should shift the record when a slot is inserted before it', () => {
			addChord(createTestChord(60, 'maj7'));
			addChord(createTestChord(62, 'm'));
			selectSlot(1);
			stageCandidate(1, createTestChord(62, '7'));

			insertSlot(0);

			expect(uiState.audition?.slotIndex).toBe(2);
			expect(uiState.selectedSlot).toBe(2);
		});

		it('should shift the record when a filled slot is inserted before it', () => {
			addChord(createTestChord(60, 'maj7'));
			addChord(createTestChord(62, 'm'));
			stageCandidate(1, createTestChord(62, '7'));

			insertSlotWithChord(0, createTestChord(64, 'dim'));

			expect(uiState.audition?.slotIndex).toBe(2);
		});

		it('should discard the record when the audited slot is cleared', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(67, 'm9'));

			clearChordAt(0);

			expect(uiState.audition).toBeNull();
		});

		it('should keep the record when a different slot is cleared', () => {
			addChord(createTestChord(60, 'maj7'));
			addChord(createTestChord(62, 'm'));
			stageCandidate(1, createTestChord(62, '7'));

			clearChordAt(0);

			expect(uiState.audition?.slotIndex).toBe(1);
		});

		it('should discard the record when the audited slot is removed', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(67, 'm9'));

			removeSlot(0);

			expect(uiState.audition).toBeNull();
			expect(uiState.selectedSlot).toBeNull();
		});

		it('should shift the record when an earlier slot is removed', () => {
			addChord(createTestChord(60, 'maj7'));
			addChord(createTestChord(62, 'm'));
			selectSlot(1);
			stageCandidate(1, createTestChord(62, '7'));

			removeSlot(0);

			expect(uiState.audition?.slotIndex).toBe(0);
			expect(uiState.selectedSlot).toBe(0);
		});

		it('should discard the record when the audited slot is overwritten by another action', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(67, 'm9'));

			insertChordAt(0, createTestChord(70, 'sus4')); // e.g. a drop onto the slot

			expect(uiState.audition).toBeNull();
			expect(progressionState.progression[0]?.root).toBe(70);
		});

		it('should discard the record when the audited slot is replaced via updateChord', () => {
			addChord(createTestChord(60, 'maj7'));
			stageCandidate(0, createTestChord(67, 'm9'));

			updateChord(0, createTestChord(70, 'sus4'));

			expect(uiState.audition).toBeNull();
		});

		it('should discard the record when the progression is cleared', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			stageCandidate(0, createTestChord(67, 'm9'));

			clearProgression();

			expect(uiState.audition).toBeNull();
			expect(uiState.selectedSlot).toBeNull();
		});

		it('should discard the record when a saved progression is loaded', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			stageCandidate(0, createTestChord(67, 'm9'));

			loadProgressionToCanvas([createTestChord(62, 'm'), null, null, null]);

			expect(uiState.audition).toBeNull();
			expect(uiState.selectedSlot).toBeNull();
		});
	});
});
