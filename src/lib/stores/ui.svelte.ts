/**
 * UI Interaction State
 * Slot selection, the library rail panel, and the live-audition transaction.
 *
 * This module and `progression.svelte.ts` import each other on purpose: the progression
 * mutators call the integrity hooks at the bottom of this file so the audition record and
 * the selection never point at a slot that moved or stopped existing. Only hoisted function
 * declarations cross the cycle, so module initialisation order does not matter.
 */

import type { Chord, ChordQuality } from '$lib/utils/theory-engine';
import {
	MAX_PROGRESSION_SLOTS,
	addChord,
	insertChordAt,
	placeChordAt,
	progressionState,
	setInversion,
	selectQuality,
	selectRoot
} from '$lib/stores/progression.svelte';
import { cancelAudition } from '$lib/utils/audition-controller';

/** Which library section the rail has expanded */
export type LibrarySection = 'palette' | 'saved';

/** Popovers that participate in the global Escape surface stack */
export type SurfacePopover = 'scale' | 'inspector-randomize';

/**
 * An in-flight live audition on a single slot.
 * The baseline is harmony only: reverting restores root + quality and leaves the slot's
 * inversion / voicing / octave / duration exactly as they are. The one exception is an
 * inversion a smaller candidate forced back to root position; Revert puts that back.
 */
export type AuditionRecord = {
	/** Slot the audition belongs to (follows the chord if the slot moves) */
	slotIndex: number;
	/** Root of the chord that was in the slot before the first candidate */
	baselineRoot: number;
	/** Quality of the chord that was in the slot before the first candidate */
	baselineQuality: ChordQuality;
	/** Inversion the slot had before a candidate with fewer notes clamped it to 0, if any */
	clampedInversion: number | null;
};

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

	/** Pending live audition, or null when nothing is being tried */
	audition: null as AuditionRecord | null,

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
 * True while this module is writing a candidate/baseline into the progression.
 * Lets the overwrite hook tell an audition's own write apart from an explicit user action.
 */
let applyingAudition = false;

/**
 * Check whether an index can hold a selectable slot
 * @param index - Slot index to validate
 * @returns true if the index is a plausible slot position
 */
function isSelectableSlot(index: number): boolean {
	return Number.isInteger(index) && index >= 0 && index < progressionState.progression.length;
}

/**
 * Write harmony into a slot on behalf of the audition, suppressing the overwrite hook
 * @param index - Slot index
 * @param chord - Chord whose root/quality should be applied
 */
function applyAuditionHarmony(index: number, chord: Chord): void {
	applyingAudition = true;
	try {
		insertChordAt(index, chord);
	} finally {
		applyingAudition = false;
	}
}

/**
 * Drop the audition record if it belongs to the given slot
 * @param index - Slot index
 */
function discardAuditionAt(index: number): void {
	if (uiState.audition?.slotIndex === index) {
		uiState.audition = null;
	}
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

	if (uiState.audition?.slotIndex === selectedSlot) {
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
// Live Audition
// ============================================================================

/**
 * Try a candidate chord in a slot.
 * The baseline is captured once per transaction, so browsing further candidates never
 * moves the point Revert returns to. The candidate replaces harmony only.
 * A candidate staged into an empty slot is placed, but starts no transaction — there is
 * no baseline harmony to restore.
 * @param slotIndex - Slot being auditioned
 * @param chord - Candidate chord
 */
export function stageCandidate(slotIndex: number, chord: Chord): void {
	if (!isSelectableSlot(slotIndex) || slotIndex >= progressionState.progression.length) return;

	// Staging onto a different slot commits whatever was pending on the old one
	if (uiState.audition && uiState.audition.slotIndex !== slotIndex) {
		uiState.audition = null;
	}

	const current = progressionState.progression[slotIndex];
	if (!uiState.audition && current) {
		uiState.audition = {
			slotIndex,
			baselineRoot: current.root,
			baselineQuality: current.quality,
			clampedInversion: null
		};
	}

	const inversionBefore = current?.inversion ?? 0;
	applyAuditionHarmony(slotIndex, chord);
	const inversionAfter = progressionState.progression[slotIndex]?.inversion ?? 0;
	if (
		uiState.audition?.slotIndex === slotIndex &&
		uiState.audition.clampedInversion === null &&
		inversionBefore > 0 &&
		inversionAfter === 0
	) {
		uiState.audition.clampedInversion = inversionBefore;
	}

	// Returning to the baseline resolves the transaction; there is nothing left to commit/revert.
	const record = uiState.audition;
	if (
		record &&
		record.slotIndex === slotIndex &&
		chord.root === record.baselineRoot &&
		chord.quality === record.baselineQuality
	) {
		uiState.audition = null;
	}
}

/**
 * Make the pending candidate permanent by forgetting the baseline
 */
export function commitAudition(): void {
	uiState.audition = null;
}

/**
 * Restore the baseline harmony and end the transaction.
 * The slot keeps every performance setting it picked up while auditioning, except that an
 * inversion clamped away by a smaller candidate is restored (unless the user re-set it).
 */
export function revertAudition(): void {
	const record = uiState.audition;
	if (!record) return;

	uiState.audition = null;
	applyAuditionHarmony(record.slotIndex, {
		root: record.baselineRoot,
		quality: record.baselineQuality,
		inversion: 0,
		voicing: 'close',
		octave: 0,
		duration: '1m'
	});

	const restored = progressionState.progression[record.slotIndex];
	if (record.clampedInversion !== null && restored && restored.inversion === 0) {
		setInversion(record.slotIndex, record.clampedInversion);
	}
}

// ============================================================================
// Progression Integrity Hooks
// ============================================================================
// Called by the progression store's mutators. They keep the audition record and the
// selection pointing at the chord the user is actually working on: the record follows a
// chord that moves, and an explicit action on the audited slot wins over the audition.

/**
 * Two slots exchanged contents (a move onto an empty slot, or a swap)
 * @param indexA - First slot index
 * @param indexB - Second slot index
 */
export function handleSlotsExchanged(indexA: number, indexB: number): void {
	const record = uiState.audition;
	if (record) {
		if (record.slotIndex === indexA) record.slotIndex = indexB;
		else if (record.slotIndex === indexB) record.slotIndex = indexA;
	}

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
	const record = uiState.audition;
	if (record && record.slotIndex >= index) record.slotIndex += 1;

	if (uiState.selectedSlot !== null && uiState.selectedSlot >= index) uiState.selectedSlot += 1;
	uiState.queuedSlots = uiState.queuedSlots.map((slot) => (slot >= index ? slot + 1 : slot));
	if (uiState.landingSlot !== null && uiState.landingSlot >= index) uiState.landingSlot += 1;
}

/**
 * A slot was removed, shifting everything after it one place left
 * @param index - Index of the removed slot
 */
export function handleSlotRemoved(index: number): void {
	const record = uiState.audition;
	if (record) {
		if (record.slotIndex === index) uiState.audition = null;
		else if (record.slotIndex > index) record.slotIndex -= 1;
	}

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
 * A slot's chord was deleted — the explicit action wins over any audition on it
 * @param index - Cleared slot index
 */
export function handleSlotCleared(index: number): void {
	discardAuditionAt(index);
	uiState.queuedSlots = uiState.queuedSlots.filter((slot) => slot !== index);
	if (uiState.landingSlot === index) uiState.landingSlot = null;
}

/**
 * A slot's chord was replaced by something other than the audition itself
 * @param index - Overwritten slot index
 */
export function handleSlotOverwritten(index: number): void {
	if (applyingAudition) return;
	discardAuditionAt(index);
}

/**
 * The whole progression was replaced (cleared, or a saved progression loaded)
 */
export function handleProgressionReplaced(): void {
	uiState.audition = null;
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
	uiState.audition = null;
	uiState.activePopover = null;
	uiState.transportActive = false;
	uiState.browseQuality = null;
	uiState.queuedSlots = [];
	uiState.landingSlot = null;
}
