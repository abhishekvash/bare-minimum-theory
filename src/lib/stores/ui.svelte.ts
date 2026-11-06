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
	// fallow-ignore-next-line circular-dependency
	clearChordAt,
	commitAudition,
	placeChordAt,
	progressionState,
	selectQuality,
	selectRoot
} from '$lib/stores/progression.svelte';
import { playbackPort } from '$lib/utils/playback-port';
import {
	remapIndexAfterExchange,
	remapIndexAfterInsert,
	remapIndexAfterRemove
} from '$lib/utils/slot-index';

/** Which library section the rail has expanded */
export type LibrarySection = 'palette' | 'saved';

/** Popovers that participate in the global Escape surface stack */
export type SurfacePopover = 'scale';

/** Sections of the Settings dialog, so a contextual entry point can open the relevant one */
export type SettingsSection = 'preview' | 'randomize' | 'midi' | 'display';

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

	/** Settings dialog: open state and the section to bring into view */
	settings: {
		open: false,
		section: null as SettingsSection | null
	},

	/** Reactive mirror of transport ownership for builder and inspector decisions */
	transportActive: false,

	/** Quality under keyboard browse while playback keeps the builder selection unchanged */
	browseQuality: null as ChordQuality | null,

	/** Slots whose edits will not be heard until the playhead returns to each one */
	queuedSlots: [] as number[],

	/** Slot receiving the brief placement feedback */
	landingSlot: null as number | null,

	/** True while the onboarding tour owns the screen, so page shortcuts stay quiet */
	tourActive: false
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
	playbackPort.interruptAudition();
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
	playbackPort.interruptAudition();
	commitAudition();
	uiState.browseQuality = null;
	uiState.selectedSlot = null;
}

/**
 * Delete the chord in a slot, leaving a rest behind, and close the inspector when that slot
 * was the one being edited. Shared by the block's hover delete and the inspector's action so
 * neither can leave the inspector pointed at a chord that no longer exists.
 * @param index - Slot index
 */
export function deleteChordFromSlot(index: number): void {
	clearChordAt(index);
	if (uiState.selectedSlot === index) deselectSlot();
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
 * The builder chord the selected slot could be replaced with, or null when there is nothing to
 * offer: no complete builder chord, no selection, the loop playing (browsing stages candidates
 * then), or the builder already holding the slot's harmony.
 */
export function getReplacementChord(): Chord | null {
	const readyChord = getReadyChord();
	const selectedSlot = uiState.selectedSlot;
	if (!readyChord || selectedSlot === null || uiState.transportActive) return null;
	if (selectedSlot >= progressionState.progression.length) return null;

	const current = progressionState.progression[selectedSlot];
	const sameHarmony = current?.root === readyChord.root && current?.quality === readyChord.quality;
	return sameHarmony ? null : readyChord;
}

/**
 * Replace the selected slot's harmony with the builder chord, keeping its performance settings
 * @returns true when the slot changed
 */
export function replaceSelectedWithReadyChord(): boolean {
	const chord = getReplacementChord();
	const selectedSlot = uiState.selectedSlot;
	if (!chord || selectedSlot === null) return false;
	return placeChordAt(selectedSlot, chord);
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

/**
 * Clear the queued marker when the playhead arrives at that slot again.
 * @param wrapped - The playhead jumped back to the start of the same slot (the loop wrapped). In a
 *   one-slot loop the slot never changes, so this is the only arrival there is.
 */
export function acknowledgeQueuedSlotOnArrival(
	currentSlot: number,
	previousSlot: number | null,
	wrapped = false
): void {
	const arrived = wrapped || previousSlot !== currentSlot;
	if (arrived && uiState.queuedSlots.includes(currentSlot)) {
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
 * Open the Settings dialog, optionally scrolled to one section
 * @param section - Section to bring into view (e.g. 'randomize' from the inspector)
 */
export function openSettings(section: SettingsSection | null = null): void {
	uiState.settings.section = section;
	uiState.settings.open = true;
}

/** Mark the onboarding tour as running or finished */
export function setTourActive(active: boolean): void {
	uiState.tourActive = active;
}

/** Close the Settings dialog */
export function closeSettings(): void {
	uiState.settings.open = false;
	uiState.settings.section = null;
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
	uiState.selectedSlot = remapIndexAfterExchange(uiState.selectedSlot, indexA, indexB);
	uiState.queuedSlots = uiState.queuedSlots.map((slot) =>
		remapIndexAfterExchange(slot, indexA, indexB)
	);
	uiState.landingSlot = remapIndexAfterExchange(uiState.landingSlot, indexA, indexB);
}

/**
 * A slot was inserted, shifting everything at or after it one place right
 * @param index - Index the new slot was inserted at
 */
export function handleSlotInserted(index: number): void {
	uiState.selectedSlot = remapIndexAfterInsert(uiState.selectedSlot, index);
	uiState.queuedSlots = uiState.queuedSlots.map((slot) => remapIndexAfterInsert(slot, index));
	uiState.landingSlot = remapIndexAfterInsert(uiState.landingSlot, index);
}

/**
 * A slot was removed, shifting everything after it one place left
 * @param index - Index of the removed slot
 */
export function handleSlotRemoved(index: number): void {
	uiState.selectedSlot = remapIndexAfterRemove(uiState.selectedSlot, index);
	uiState.queuedSlots = uiState.queuedSlots.flatMap((slot) => {
		const next = remapIndexAfterRemove(slot, index);
		return next === null ? [] : [next];
	});
	uiState.landingSlot = remapIndexAfterRemove(uiState.landingSlot, index);
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
	uiState.tourActive = false;
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
	uiState.settings.open = false;
	uiState.settings.section = null;
	uiState.transportActive = false;
	uiState.browseQuality = null;
	uiState.queuedSlots = [];
	uiState.landingSlot = null;
}
