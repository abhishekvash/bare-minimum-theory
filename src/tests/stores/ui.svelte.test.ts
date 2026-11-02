/**
 * Tests for the UI interaction store: slot selection, the library rail panel,
 * ReadyBar actions and transient canvas feedback.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Chord, ChordDuration } from '$lib/utils/theory-engine';
import { QUALITIES, VOICING_PRESETS } from '$lib/utils/theory-engine';
import {
	progressionState,
	addChord,
	clearBuilderState,
	clearProgression,
	selectQuality,
	selectRoot,
	MAX_PROGRESSION_SLOTS,
	stageCandidate
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
	duration: ChordDuration = '1m'
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

		it('should reject indices outside the current progression', () => {
			expect(selectSlot(-1)).toBe(false);
			expect(selectSlot(progressionState.progression.length)).toBe(false);
			expect(selectSlot(MAX_PROGRESSION_SLOTS)).toBe(false);
			expect(uiState.selectedSlot).toBeNull();
		});

		it('should commit a pending audition when selecting a different slot', () => {
			addChord(createTestChord(60, 'maj7'));
			addChord(createTestChord(62, 'm'));
			selectSlot(0);
			stageCandidate(0, createTestChord(60, 'm9'));
			expect(progressionState.audition).not.toBeNull();

			selectSlot(1);

			expect(progressionState.audition).toBeNull();
			// The candidate stays: deselecting is the commit gesture
			expect(progressionState.progression[0]?.quality).toBe('m9');
		});

		it('should keep a pending audition when re-selecting the same slot', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			stageCandidate(0, createTestChord(60, 'm9'));

			selectSlot(0);

			expect(progressionState.audition?.baselineQuality).toBe('maj7');
		});
	});

	describe('deselectSlot', () => {
		it('should clear the selection and commit a pending audition', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			stageCandidate(0, createTestChord(60, '7b9'));

			deselectSlot();

			expect(uiState.selectedSlot).toBeNull();
			expect(progressionState.audition).toBeNull();
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
			expect(progressionState.audition).toBeNull();
			expect(progressionState.progression[0]?.quality).toBe('m9');
		});

		it('should preserve a pending candidate across Stop and return to Replace', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			setTransportActive(true);
			stageCandidate(0, createTestChord(60, 'm9'));

			setTransportActive(false);

			expect(progressionState.audition?.baselineQuality).toBe('maj7');
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
});
