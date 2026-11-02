/**
 * UI Interaction State
 * Slot selection, the library rail panel, transport mirror and transient canvas feedback.
 * The live-audition transaction is owned by `progression.svelte.ts`.
 *
 * This module and `progression.svelte.ts` import each other on purpose: the progression
 * mutators call the integrity hooks at the bottom of this file so the selection and canvas
 * feedback never point at a slot that moved or stopped existing. Only hoisted function
 * declarations cross the cycle, so module initialisation order does not matter.
 */

import type { Chord, ChordQuality } from '$lib/utils/theory-engine';
import {
	MAX_PROGRESSION_SLOTS,
	addChord,
	commitAudition,
	placeChordAt,
	progressionState,
	selectQuality,
	selectRoot
} from '$lib/stores/progression.svelte';
import { cancelAudition } from '$lib/utils/audition-controller';

/** Which library section the rail has expanded */
export type LibrarySection = 'palette' | 'saved';

/** Popovers that participate in the global Escape surface stack */
export type SurfacePopover = 'scale' | 'inspector-randomize';

/** The context-sensitive action shown beside a complete builder chord */
export type ReadyBarAction = {
	kind: 'add' | 'replace' | 'commit';
	label: string;
	disabled: boolean;
	hint: string | null;
};

/**
 * Reactive interaction state, shared by the canvas, inspector and library rail
 */
export const uiState = $state({
	/** Slot the inspector and builder are currently targeting (null = nothing selected) */
	selectedSlot: null as number | null,

	/** Library rail expansion (one section at a time; the icons behave as tabs) */
	libraryPanel: {
		/** Expanded section, or null while the rail is collapsed */
		open: null as LibrarySection | null,
		/** True when the panel opened only to receive a drag, so it can collapse again */
		autoOpened: false
	},

	/** Open non-modal popover, closed by Escape after inspector/library surfaces */
	activePopover: null as SurfacePopover | null,

	/** Reactive mirror of transport ownership for builder and ReadyBar decisions */
	transportActive: false,

	/** Quality under keyboard browse while playback keeps the builder selection unchanged */
	browseQuality: null as ChordQuality | null,

	/** Slots whose edits will not be heard until the playhead returns to each one */
	queuedSlots: [] as number[],

	/** Slot receiving the brief placement feedback */
	landingSlot: null as number | null
});

/** Invalidates older landing timers so a newer placement keeps its full feedback window */
let landingGeneration = 0;

/**
 * Check whether an index can hold a selectable slot
 * @param index - Slot index to validate
 * @returns true if the index is a plausible slot position
 */
function isSelectableSlot(index: number): boolean {
	return Number.isInteger(index) && index >= 0 && index < progressionState.progression.length;
}

// ============================================================================
// Slot Selection
// ============================================================================

/**
 * Select a slot, committing any audition pending on the previously selected slot.
 * Syncs the builder to the slot's chord so candidates keep the selection's root.
 * @param index - Slot index to select
 * @returns true when the index names a real slot
 */
export function selectSlot(index: number): boolean {
	if (!isSelectableSlot(index)) return false;
	if (uiState.selectedSlot === index) return true;

	// Switching the target slot ends whatever is sounding; it commits, but never reverts, state
	cancelAudition();
	commitAudition();
	uiState.browseQuality = null;
	uiState.selectedSlot = index;

	const chord = progressionState.progression[index];
	if (chord) {
		selectRoot(chord.root);
		selectQuality(chord.quality);
	}
	return true;
}

/**
 * Clear the selection, committing any pending audition (deselecting is the commit gesture)
 */
export function deselectSlot(): void {
	cancelAudition();
	commitAudition();
	uiState.browseQuality = null;
	uiState.selectedSlot = null;
}

// ============================================================================
// Transport, ready chord and transient canvas feedback
// ============================================================================

/**
 * Mirror whether the progression transport owns sound. Stopping clears timing-only feedback but
 * deliberately leaves the live-audition transaction intact so the user can still keep or revert.
 */
export function setTransportActive(active: boolean): void {
	uiState.transportActive = active;
	if (!active) {
		uiState.browseQuality = null;
		uiState.queuedSlots = [];
	}
}

/** Set or clear the transport-only quality browse cursor. */
export function setBrowseQuality(quality: ChordQuality | null): void {
	uiState.browseQuality = quality;
}

/** Build the complete chord represented by the builder, or null until both choices exist. */
export function getReadyChord(): Chord | null {
	const { selectedRoot, selectedQuality } = progressionState.builderState;
	if (selectedRoot === null || selectedQuality === null) return null;

	return {
		root: selectedRoot,
		quality: selectedQuality,
		inversion: 0,
		voicing: 'close',
		octave: 0,
		duration: '1m'
	};
}

/**
 * Resolve the ReadyBar's one available action from selection, transport and audition state.
 * While playing on a selected slot, browsing owns staging, so no button appears until there is a
 * candidate to commit.
 */
export function getReadyBarAction(): ReadyBarAction | null {
	if (!getReadyChord()) return null;

	const selectedSlot = uiState.selectedSlot;
	if (selectedSlot === null) {
		const atCapacity =
			progressionState.progression.length >= MAX_PROGRESSION_SLOTS &&
			progressionState.progression.every((chord) => chord !== null);
		return {
			kind: 'add',
			label: '+ Add to progression',
			disabled: atCapacity,
			hint: atCapacity ? 'Progression is full' : null
		};
	}

	if (!uiState.transportActive) {
		return {
			kind: 'replace',
			label: 'Replace',
			disabled: selectedSlot >= progressionState.progression.length,
			hint: null
		};
	}

	if (progressionState.audition?.slotIndex === selectedSlot) {
		return { kind: 'commit', label: 'Commit', disabled: false, hint: null };
	}

	return null;
}

/**
 * Execute the current ReadyBar action against the stores.
 * @returns true when an action changed state
 */
export function performReadyBarAction(): boolean {
	const chord = getReadyChord();
	const action = getReadyBarAction();
	if (!chord || !action || action.disabled) return false;

	if (action.kind === 'add') {
		addChord(chord);
		return true;
	}

	if (action.kind === 'replace') {
		const selectedSlot = uiState.selectedSlot;
		if (selectedSlot === null) return false;
		return placeChordAt(selectedSlot, chord);
	}

	commitAudition();
	return true;
}

/** Mark an edit as queued only when it targets the slot the playhead is inside right now. */
export function markSlotQueuedIfCurrent(slotIndex: number, currentSlot: number | null): void {
	if (
		uiState.transportActive &&
		currentSlot === slotIndex &&
		!uiState.queuedSlots.includes(slotIndex)
	) {
		uiState.queuedSlots = [...uiState.queuedSlots, slotIndex];
	}
}

/** Clear the queued marker when the playhead arrives at that slot again. */
export function acknowledgeQueuedSlotOnArrival(
	currentSlot: number,
	previousSlot: number | null
): void {
	if (previousSlot !== currentSlot && uiState.queuedSlots.includes(currentSlot)) {
		uiState.queuedSlots = uiState.queuedSlots.filter((slot) => slot !== currentSlot);
	}
}

/** Show short placement feedback on a slot. */
export function markSlotLanding(slotIndex: number): void {
	landingGeneration += 1;
	const generation = landingGeneration;
	uiState.landingSlot = slotIndex;

	setTimeout(() => {
		if (generation === landingGeneration) uiState.landingSlot = null;
	}, 220);
}

// ============================================================================
// Library Panel
// ============================================================================

/**
 * Expand the library rail onto a section
 * @param section - Section to show
 * @param autoOpened - True when a drag opened the panel, so it can collapse on drag-out
 */
export function openLibraryPanel(section: LibrarySection, autoOpened = false): void {
	const alreadyShowing = uiState.libraryPanel.open === section;
	uiState.libraryPanel.open = section;
	// A panel the user opened deliberately never becomes an auto-opened one
	uiState.libraryPanel.autoOpened = autoOpened && !alreadyShowing;
}

/**
 * Collapse the library rail
 */
export function closeLibraryPanel(): void {
	uiState.libraryPanel.open = null;
	uiState.libraryPanel.autoOpened = false;
}

/** Track the non-modal popover currently participating in the Escape stack. */
export function setActivePopover(popover: SurfacePopover | null): void {
	uiState.activePopover = popover;
}

/** Close whichever tracked popover is open. Components react to this state change. */
export function closeActivePopover(): void {
	uiState.activePopover = null;
}

/**
 * Toggle a library section (clicking the active icon collapses the rail)
 * @param section - Section the rail icon represents
 */
export function toggleLibraryPanel(section: LibrarySection): void {
	if (uiState.libraryPanel.open === section) {
		closeLibraryPanel();
	} else {
		openLibraryPanel(section);
	}
}

/**
 * Collapse the panel only if a drag opened it — a drag that leaves without dropping
 * should not close a panel the user opened themselves
 */
export function closeAutoOpenedLibraryPanel(): void {
	if (uiState.libraryPanel.autoOpened) {
		closeLibraryPanel();
	}
}

/**
 * Keep an auto-opened panel open (used after a successful drop onto it)
 */
export function pinLibraryPanel(): void {
	uiState.libraryPanel.autoOpened = false;
}

// ============================================================================
// Progression Integrity Hooks
// ============================================================================
// Called by the progression store's mutators (after it has remapped its own audition record).
// They keep the selection and canvas feedback pointing at the chord the user is working on.

/**
 * Two slots exchanged contents (a move onto an empty slot, or a swap)
 * @param indexA - First slot index
 * @param indexB - Second slot index
 */
export function handleSlotsExchanged(indexA: number, indexB: number): void {
	if (uiState.selectedSlot === indexA) uiState.selectedSlot = indexB;
	else if (uiState.selectedSlot === indexB) uiState.selectedSlot = indexA;

	uiState.queuedSlots = uiState.queuedSlots.map((slot) => {
		if (slot === indexA) return indexB;
		if (slot === indexB) return indexA;
		return slot;
	});

	if (uiState.landingSlot === indexA) uiState.landingSlot = indexB;
	else if (uiState.landingSlot === indexB) uiState.landingSlot = indexA;
}

/**
 * A slot was inserted, shifting everything at or after it one place right
 * @param index - Index the new slot was inserted at
 */
export function handleSlotInserted(index: number): void {
	if (uiState.selectedSlot !== null && uiState.selectedSlot >= index) uiState.selectedSlot += 1;
	uiState.queuedSlots = uiState.queuedSlots.map((slot) => (slot >= index ? slot + 1 : slot));
	if (uiState.landingSlot !== null && uiState.landingSlot >= index) uiState.landingSlot += 1;
}

/**
 * A slot was removed, shifting everything after it one place left
 * @param index - Index of the removed slot
 */
export function handleSlotRemoved(index: number): void {
	if (uiState.selectedSlot !== null) {
		if (uiState.selectedSlot === index) uiState.selectedSlot = null;
		else if (uiState.selectedSlot > index) uiState.selectedSlot -= 1;
	}

	uiState.queuedSlots = uiState.queuedSlots
		.filter((slot) => slot !== index)
		.map((slot) => (slot > index ? slot - 1 : slot));

	if (uiState.landingSlot !== null) {
		if (uiState.landingSlot === index) uiState.landingSlot = null;
		else if (uiState.landingSlot > index) uiState.landingSlot -= 1;
	}
}

/**
 * A slot's chord was deleted
 * @param index - Cleared slot index
 */
export function handleSlotCleared(index: number): void {
	uiState.queuedSlots = uiState.queuedSlots.filter((slot) => slot !== index);
	if (uiState.landingSlot === index) uiState.landingSlot = null;
}

/**
 * The whole progression was replaced (cleared, or a saved progression loaded)
 */
export function handleProgressionReplaced(): void {
	uiState.selectedSlot = null;
	uiState.browseQuality = null;
	uiState.queuedSlots = [];
	uiState.landingSlot = null;
}

/**
 * Reset every piece of interaction state (used by tests and full app resets)
 */
export function resetUIState(): void {
	landingGeneration += 1;
	uiState.selectedSlot = null;
	uiState.libraryPanel.open = null;
	uiState.libraryPanel.autoOpened = false;
	uiState.activePopover = null;
	uiState.transportActive = false;
	uiState.browseQuality = null;
	uiState.queuedSlots = [];
	uiState.landingSlot = null;
}
