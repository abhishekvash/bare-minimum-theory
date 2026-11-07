/**
 * Global State Management for Chord Progression Builder
 * Uses Svelte 5 $state rune for reactive state
 */

import type { Chord, ChordDuration, ChordQuality } from '#lib/utils/theory-engine/index.ts';
import { QUALITIES, VOICING_PRESETS, getChordNotes } from '#lib/utils/theory-engine/index.ts';
import { playbackPort } from '#lib/utils/playback-port.ts';
import { getScaleNotes, getValidQualitiesForRoot } from '#lib/utils/scale-helper.ts';
import type { SavedProgression } from '#lib/utils/progression-persistence.ts';
import { settingsState } from '#lib/stores/settings.svelte.ts';
import {
	remapIndexAfterExchange,
	remapIndexAfterInsert,
	remapIndexAfterRemove
} from '#lib/utils/slot-index.ts';
// ui.svelte.ts imports this store back on purpose: these are its slot-integrity hooks (see its header)
import {
	// fallow-ignore-next-line circular-dependency
	handleProgressionReplaced,
	handleSlotCleared,
	handleSlotInserted,
	handleSlotRemoved,
	handleSlotsExchanged,
	markSlotLanding,
	markSlotQueuedIfCurrent
} from '#lib/stores/ui.svelte.ts';

/** Piano keyboard default range (C4-B6, 3 octaves centered on chord builder roots) */
const DEFAULT_RANGE_START = 60; // C4
const DEFAULT_RANGE_END = 95; // B6

/** Minimum octaves to display */
const MIN_OCTAVES = 3;

/**
 * Compute the piano range needed to display all chords in the progression
 * Snaps to octave boundaries and ensures minimum 3 octaves
 * @param progression - Array of chords (or nulls for empty slots)
 * @returns Object with start and end MIDI note numbers for the range
 */
export function computePianoRange(progression: (Chord | null)[]): { start: number; end: number } {
	// Collect all notes from all chords in progression
	const allNotes: number[] = [];
	for (const chord of progression) {
		if (chord) {
			allNotes.push(...getChordNotes(chord));
		}
	}

	if (allNotes.length === 0) {
		return { start: DEFAULT_RANGE_START, end: DEFAULT_RANGE_END };
	}

	const minNote = Math.min(...allNotes);
	const maxNote = Math.max(...allNotes);

	// Snap to octave boundaries (C = 0, 12, 24, 36, 48, 60, 72, 84, 96...)
	const startOctave = Math.floor(minNote / 12);
	const endOctave = Math.floor(maxNote / 12);

	// Calculate octaves needed
	const octavesNeeded = endOctave - startOctave + 1;

	// Ensure minimum 3 octaves
	if (octavesNeeded < MIN_OCTAVES) {
		const extra = MIN_OCTAVES - octavesNeeded;
		// Add octaves evenly on both sides, prefer adding above
		const addBelow = Math.floor(extra / 2);
		const addAbove = extra - addBelow;
		return {
			start: (startOctave - addBelow) * 12,
			end: (endOctave + addAbove + 1) * 12 - 1
		};
	}

	return {
		start: startOctave * 12, // C of lowest octave
		end: (endOctave + 1) * 12 - 1 // B of highest octave
	};
}

/** Maximum number of visible chord slots in the canvas */
export const MAX_PROGRESSION_SLOTS = 16;

/** Minimum number of chord slots in the canvas */
export const MIN_PROGRESSION_SLOTS = 4;

/**
 * Check if a slot index is valid (within bounds)
 * @param index - Slot index to validate
 * @returns true if index is valid
 */
function isValidSlotIndex(index: number): boolean {
	return index >= 0 && index < progressionState.progression.length;
}

/**
 * Construct the chord the builder is targeting. Occupied slots contribute their performance
 * settings, so stopped preview, live staging and Replace all describe the same eventual chord.
 * Empty or appended targets use builder defaults.
 */
export function createCandidateChord(
	root: number,
	quality: Chord['quality'],
	targetSlot: number
): Chord {
	const existing = progressionState.progression[targetSlot];
	if (!existing) {
		return {
			root,
			quality,
			inversion: 0,
			voicing: 'close',
			octave: 0,
			duration: '1m'
		};
	}

	const maxInversion = QUALITIES[quality].length - 1;
	return {
		...existing,
		root,
		quality,
		inversion: existing.inversion <= maxInversion ? existing.inversion : 0
	};
}

/**
 * Notify playback about an edit and capture whether it targets the slot currently under the
 * playhead. Reading progress at mutation time avoids losing the queued signal on a later render.
 */
function notifySlotEdited(index: number): void {
	playbackPort.slotChanged(index);
	markSlotQueuedIfCurrent(index, playbackPort.playheadSlot());
}

/**
 * An in-flight live audition on a single slot.
 * The baseline is harmony only: reverting restores root + quality and leaves the slot's
 * inversion / voicing / octave / duration exactly as they are. The one exception is an
 * inversion a smaller candidate forced back to root position; Revert puts that back.
 */
type AuditionRecord = {
	/** Slot the audition belongs to (follows the chord if the slot moves) */
	slotIndex: number;
	/** Root of the chord that was in the slot before the first candidate */
	baselineRoot: number;
	/** Quality of the chord that was in the slot before the first candidate */
	baselineQuality: ChordQuality;
	/** Inversion the slot had before a candidate with fewer notes clamped it to 0, if any */
	clampedInversion: number | null;
};

/**
 * Main reactive state object for the entire application
 * Exported as an object to maintain deep reactivity
 */
export const progressionState = $state({
	/** Optional scale filter (e.g., { key: 'C', mode: 'major' }) */
	scale: null as { key: string; mode: string } | null,

	/** Whether the scale filter is currently active */
	scaleFilterEnabled: false,

	/** Whether to constrain randomization to scale notes */
	randomizeWithinScale: false,

	/** Tracks the chord currently being built in the UI */
	builderState: {
		/** Selected root note (MIDI number, e.g., 60 = C4) */
		selectedRoot: null as number | null,
		/** Selected chord quality (e.g., 'maj7', 'm', '7') */
		selectedQuality: null as keyof typeof QUALITIES | null
	},

	/** Dynamically-sized array of chord slots (null = empty slot), can grow up to MAX_PROGRESSION_SLOTS */
	progression: [null, null, null, null] as (Chord | null)[],

	/** Array of chords in the palette (variable size) */
	palette: [] as Chord[],

	/** Pending live audition, or null when nothing is being tried */
	audition: null as AuditionRecord | null
});

/**
 * The saved-progression library. Entries are only ever replaced wholesale (load, add, remove),
 * never edited in place, so the list is raw state: entries stay plain objects instead of deep
 * proxies, and the tag list is derived from them instead of being re-read from IndexedDB.
 */
class SavedLibrary {
	/** Saved progressions, newest first */
	items = $state.raw<SavedProgression[]>([]);

	/** Every unique tag across the library, alphabetical (for autocomplete) */
	availableTags = $derived([...new Set(this.items.flatMap((p) => p.tags))].sort());
}

export const savedLibrary = new SavedLibrary();

/**
 * Check if the progression can be saved
 * A progression can be saved when it has at least 2 non-null chords
 * @returns true if the progression can be saved
 */
export function canSaveProgression(): boolean {
	return progressionState.progression.filter((c) => c !== null).length >= 2;
}

// ============================================================================
// Scale Management
// ============================================================================

/**
 * Set the active scale filter
 * @param key - Root note name (e.g., 'C', 'D#')
 * @param mode - Scale mode (e.g., 'major', 'minor', 'dorian')
 */
export function setScale(key: string, mode: string): void {
	progressionState.scale = { key, mode };
}

/**
 * Clear the scale filter
 */
export function clearScale(): void {
	progressionState.scale = null;
}

/**
 * Toggle the scale filter on/off
 */
export function toggleScaleFilter(): void {
	progressionState.scaleFilterEnabled = !progressionState.scaleFilterEnabled;
}

/**
 * Set the scale filter state explicitly
 * @param enabled - Whether scale filtering should be active
 */
export function setScaleFilterEnabled(enabled: boolean): void {
	progressionState.scaleFilterEnabled = enabled;
}

/**
 * Set whether randomization should be constrained to scale notes
 * @param enabled - Whether to randomize within scale only
 */
export function setRandomizeWithinScale(enabled: boolean): void {
	progressionState.randomizeWithinScale = enabled;
}

// ============================================================================
// Chord Builder State Management
// ============================================================================

/**
 * Select a root note in the chord builder
 * @param root - MIDI note number (60 = C4, 61 = C#4, etc.)
 */
export function selectRoot(root: number): void {
	progressionState.builderState.selectedRoot = root;
}

/**
 * Select a chord quality in the chord builder
 * @param quality - Chord quality key (e.g., '', 'm', 'maj7', '7')
 */
export function selectQuality(quality: keyof typeof QUALITIES): void {
	progressionState.builderState.selectedQuality = quality;
}

/**
 * Clear all builder selections
 */
export function clearBuilderState(): void {
	progressionState.builderState.selectedRoot = null;
	progressionState.builderState.selectedQuality = null;
}

// ============================================================================
// Progression Management
// ============================================================================

/**
 * Add a chord to the first available empty slot
 * @param chord - Complete chord object to add
 */
export function addChord(chord: Chord): void {
	const emptyIndex = progressionState.progression.findIndex((c) => c === null);
	if (emptyIndex !== -1) {
		progressionState.progression[emptyIndex] = chord;
		notifySlotEdited(emptyIndex);
		markSlotLanding(emptyIndex);
	} else if (progressionState.progression.length < MAX_PROGRESSION_SLOTS) {
		progressionState.progression.push(chord);
		const addedIndex = progressionState.progression.length - 1;
		notifySlotEdited(addedIndex);
		markSlotLanding(addedIndex);
	}
}

/**
 * Determine if all slots in the progression are filled
 */
export function isProgressionFull(): boolean {
	return progressionState.progression.every((c) => c !== null);
}

/**
 * Insert a chord at a specific slot index.
 * Replacing an occupied slot keeps the slot's performance settings while changing harmony.
 * @param index - Slot index
 * @param chord - Chord to place in the slot
 */
export function insertChordAt(index: number, chord: Chord): void {
	if (!isValidSlotIndex(index)) return;

	// An explicit placement wins over any audition on the slot
	discardAuditionAt(index);
	writeHarmony(index, chord);
}

/**
 * Write a chord's harmony into a slot, keeping an occupied slot's performance settings.
 * Shared by explicit placement and the audition transaction, which must not discard itself.
 * @param index - Valid slot index
 * @param chord - Chord whose harmony should be applied
 */
function writeHarmony(index: number, chord: Chord): void {
	const existingChord = progressionState.progression[index];
	if (!existingChord) {
		progressionState.progression[index] = chord;
		notifySlotEdited(index);
		markSlotLanding(index);
		return;
	}

	const maxInversion = QUALITIES[chord.quality].length - 1;
	const inversion = existingChord.inversion <= maxInversion ? existingChord.inversion : 0;

	progressionState.progression[index] = {
		...existingChord,
		root: chord.root,
		quality: chord.quality,
		inversion
	};
	notifySlotEdited(index);
}

/**
 * Add an empty slot at the end of the progression
 */
export function addSlot(): void {
	if (progressionState.progression.length < MAX_PROGRESSION_SLOTS) {
		progressionState.progression.push(null);
		// The loop got longer: playback has to rebuild its schedule to hear the new rest
		playbackPort.slotChanged(progressionState.progression.length - 1);
	}
}

/**
 * Insert an empty slot at a specific index
 * @param index - Index to insert at
 */
export function insertSlot(index: number): void {
	if (
		progressionState.progression.length < MAX_PROGRESSION_SLOTS &&
		index >= 0 &&
		index <= progressionState.progression.length
	) {
		progressionState.progression.splice(index, 0, null);
		onSlotInserted(index);
		playbackPort.slotChanged(index);
	}
}

/**
 * Insert a new slot holding a chord, shifting later slots right.
 * Used by drops on the between-slot insertion points; a no-op at the slot cap.
 * @param index - Index the new slot should occupy
 * @param chord - Chord to place in the new slot
 */
export function insertSlotWithChord(index: number, chord: Chord): void {
	if (
		progressionState.progression.length >= MAX_PROGRESSION_SLOTS ||
		index < 0 ||
		index > progressionState.progression.length
	) {
		return;
	}

	progressionState.progression.splice(index, 0, chord);
	onSlotInserted(index);
	notifySlotEdited(index);
	markSlotLanding(index);
}

/**
 * Materialize the padded placeholder slots implied by an index.
 * A drop can name a position past the real array; those slots become real here, the same way
 * click-to-place materializes them.
 * @param index - Index a new slot is about to occupy
 * @returns true when a slot can exist at that index
 */
export function materializeSlotsUpTo(index: number): boolean {
	if (
		index < 0 ||
		index >= MAX_PROGRESSION_SLOTS ||
		progressionState.progression.length >= MAX_PROGRESSION_SLOTS
	) {
		return false;
	}

	while (progressionState.progression.length < index) {
		progressionState.progression.push(null);
	}
	return true;
}

/**
 * Place a chord into a real or display-only padded slot, materializing every implied slot first.
 * @param index - Canvas slot, including a padded placeholder index
 * @param chord - Chord to place
 * @returns true when the chord was placed
 */
export function placeChordAt(index: number, chord: Chord): boolean {
	if (!Number.isInteger(index) || index < 0 || index >= MAX_PROGRESSION_SLOTS) return false;

	while (progressionState.progression.length <= index) {
		if (progressionState.progression.length >= MAX_PROGRESSION_SLOTS) return false;
		progressionState.progression.push(null);
	}

	insertChordAt(index, chord);
	return true;
}

/**
 * Move a chord out of its slot into a brand-new slot at `index`, leaving a rest behind.
 * This is the drop-on-an-insertion-point path, and it is deliberately one mutation rather than an
 * insert followed by a clear: a rejected insert would otherwise still empty the source (losing the
 * chord), and the integrity hooks would leave the selection and audition record on the rest instead
 * of following the chord that moved.
 * Dropping onto either insertion point touching the chord's own block is a no-op — the chord is
 * already there, and growing the loop by a rest is not what that gesture means.
 * @param fromIndex - Slot the chord is being dragged out of
 * @param index - Index the new slot should occupy
 * @returns true when the chord moved
 */
export function moveChordToNewSlot(fromIndex: number, index: number): boolean {
	if (!isValidSlotIndex(fromIndex)) return false;

	const chord = progressionState.progression[fromIndex];
	if (!chord) return false;

	// The insertion points either side of the chord's own block would move it onto itself
	if (index === fromIndex || index === fromIndex + 1) return false;

	if (!materializeSlotsUpTo(index)) return false;

	progressionState.progression.splice(index, 0, { ...chord });

	// The insertion pushed everything at or after it one place right, the source slot included
	const sourceIndex = fromIndex >= index ? fromIndex + 1 : fromIndex;
	progressionState.progression[sourceIndex] = null;

	// Hooks fire once, on the finished state: the insertion shift first, then the selection and
	// audition record hop from the rest left behind to the slot the chord landed in
	onSlotInserted(index);
	onSlotsExchanged(sourceIndex, index);

	notifySlotEdited(index);
	notifySlotEdited(sourceIndex);
	return true;
}

/**
 * Whether a slot can still be removed: removal never takes the canvas below `MIN_PROGRESSION_SLOTS`.
 * A shorter saved progression loads at its own length, and then nothing can be removed from it.
 */
export function canRemoveSlot(): boolean {
	return progressionState.progression.length > MIN_PROGRESSION_SLOTS;
}

/**
 * Remove a slot entirely from the progression, compacting later slots.
 * A no-op at or below `MIN_PROGRESSION_SLOTS`.
 * @param index - Index of the slot to remove
 */
export function removeSlot(index: number): void {
	if (isValidSlotIndex(index) && canRemoveSlot()) {
		progressionState.progression.splice(index, 1);
		onSlotRemoved(index);
		notifySlotEdited(index);
	}
}

/**
 * Delete the chord in a slot, leaving the slot behind as a rest.
 * This is the "delete chord" action; `removeSlot` is the one that compacts.
 * @param index - Slot index
 */
export function clearChordAt(index: number): void {
	if (isValidSlotIndex(index)) {
		onSlotCleared(index);
		progressionState.progression[index] = null;
		notifySlotEdited(index);
	}
}

/**
 * Update a chord at a specific position in the progression
 * @param index - Slot index
 * @param chord - New chord object to replace existing one
 */
export function updateChord(index: number, chord: Chord): void {
	if (isValidSlotIndex(index)) {
		discardAuditionAt(index);
		progressionState.progression[index] = chord;
		notifySlotEdited(index);
	}
}

/**
 * Clear all chords from the progression, resetting to 4 empty slots
 */
export function clearProgression(): void {
	progressionState.progression = [null, null, null, null];
	onProgressionReplaced();
}

/**
 * Move a chord between slots: onto an empty slot it moves (the source becomes a rest),
 * onto an occupied slot the two chords swap.
 * @param fromIndex - Source slot index
 * @param toIndex - Destination slot index
 */
export function moveChord(fromIndex: number, toIndex: number): void {
	if (!isValidSlotIndex(fromIndex) || !isValidSlotIndex(toIndex) || fromIndex === toIndex) {
		return;
	}

	const source = progressionState.progression[fromIndex];
	const target = progressionState.progression[toIndex];

	if (target === null) {
		// Move: the source slot is left as a rest, consistent with delete-leaves-rest
		progressionState.progression[toIndex] = source;
		progressionState.progression[fromIndex] = null;
	} else {
		// Swap: both slots are occupied, so they exchange chords
		progressionState.progression[fromIndex] = target;
		progressionState.progression[toIndex] = source;
	}

	onSlotsExchanged(fromIndex, toIndex);

	// Notify both positions of the change
	notifySlotEdited(fromIndex);
	notifySlotEdited(toIndex);
}

/**
 * Cycle through inversions for a chord in the progression
 * @param index - Slot index
 */
export function cycleInversion(index: number): void {
	if (isValidSlotIndex(index)) {
		const chord = progressionState.progression[index];
		if (!chord) return;

		// Max inversion depends on number of notes in the chord
		const intervals = QUALITIES[chord.quality];
		const numNotes = intervals.length;
		chord.inversion = (chord.inversion + 1) % numNotes;
		forgetClampedInversion(index);
		notifySlotEdited(index);
	}
}

/**
 * Set a specific inversion for a chord in the progression
 * @param index - Slot index
 * @param inversion - The inversion number to set (0 = root position, 1 = first inversion, etc.)
 */
export function setInversion(index: number, inversion: number): void {
	if (isValidSlotIndex(index)) {
		const chord = progressionState.progression[index];
		if (!chord) return;

		const intervals = QUALITIES[chord.quality];
		const numNotes = intervals.length;
		// Clamp inversion to valid range
		if (inversion >= 0 && inversion < numNotes) {
			chord.inversion = inversion;
			forgetClampedInversion(index);
			notifySlotEdited(index);
		}
	}
}

/**
 * Randomize the voicing of a chord in the progression
 * @param index - Slot index
 */
export function randomizeVoicing(index: number): void {
	if (isValidSlotIndex(index)) {
		const chord = progressionState.progression[index];
		if (!chord) return;

		const voicings = Object.keys(VOICING_PRESETS) as (keyof typeof VOICING_PRESETS)[];
		const currentVoicing = chord.voicing;

		// Get a different voicing than the current one
		const otherVoicings = voicings.filter((v) => v !== currentVoicing);
		if (otherVoicings.length > 0) {
			const randomIndex = Math.floor(Math.random() * otherVoicings.length);
			chord.voicing = otherVoicings[randomIndex];
			notifySlotEdited(index);
		}
	}
}

/**
 * Set a specific voicing for a chord in the progression
 * @param index - Slot index
 * @param voicing - The voicing preset to set
 */
export function setVoicing(index: number, voicing: keyof typeof VOICING_PRESETS): void {
	if (isValidSlotIndex(index)) {
		const chord = progressionState.progression[index];
		if (!chord) return;

		chord.voicing = voicing;
		notifySlotEdited(index);
	}
}

/**
 * Set a specific duration for a chord in the progression
 * @param index - Slot index
 * @param duration - Duration string (e.g., '1m', '2n', '4n')
 */
export function setDuration(index: number, duration: ChordDuration): void {
	if (isValidSlotIndex(index)) {
		const chord = progressionState.progression[index];
		if (!chord) return;

		chord.duration = duration;
		notifySlotEdited(index);
	}
}

/**
 * Transpose a chord up or down by one octave
 * @param index - Slot index
 * @param direction - 'up' to transpose up, 'down' to transpose down
 */
export function transposeOctave(index: number, direction: 'up' | 'down'): void {
	if (isValidSlotIndex(index)) {
		const chord = progressionState.progression[index];
		if (!chord) return;

		const delta = direction === 'up' ? 1 : -1;
		const newOctave = chord.octave + delta;

		// Enforce octave range of -2 to +2
		if (newOctave >= -2 && newOctave <= 2) {
			chord.octave = newOctave;
			notifySlotEdited(index);
		}
	}
}

/**
 * Randomize chord parameters based on user-configured options
 * By default, only randomizes inversion and voicing (not quality or octave)
 * @param index - Slot index
 */
export function randomizeChord(index: number): void {
	if (!isValidSlotIndex(index)) return;

	const chord = progressionState.progression[index];
	if (!chord) return;

	const opts = settingsState.randomizeOptions;

	// Track if anything actually changed
	let changed = false;

	// Only randomize quality if enabled
	if (opts.quality) {
		let availableQualities = Object.keys(QUALITIES) as (keyof typeof QUALITIES)[];

		// If scale filter is enabled AND randomizeWithinScale is true, filter qualities
		if (progressionState.randomizeWithinScale && progressionState.scale) {
			const scaleNotes = getScaleNotes(progressionState.scale.key, progressionState.scale.mode);
			const validQualities = getValidQualitiesForRoot(chord.root, scaleNotes);

			if (validQualities.length > 0) {
				availableQualities = validQualities;
			}
		}

		const previousQuality = chord.quality;
		chord.quality = availableQualities[Math.floor(Math.random() * availableQualities.length)];
		// A smaller chord cannot keep an inversion it no longer has notes for.
		if (chord.inversion >= QUALITIES[chord.quality].length) chord.inversion = 0;
		// New harmony is an explicit edit: it ends any audition, so Revert can't undo it.
		if (chord.quality !== previousQuality) discardAuditionAt(index);
		changed = true;
	}

	// Randomize inversion if enabled
	if (opts.inversion) {
		const intervals = QUALITIES[chord.quality];
		const numNotes = intervals.length;
		chord.inversion = Math.floor(Math.random() * numNotes);
		forgetClampedInversion(index);
		changed = true;
	}

	// Randomize voicing if enabled
	if (opts.voicing) {
		const voicings = Object.keys(VOICING_PRESETS) as (keyof typeof VOICING_PRESETS)[];
		chord.voicing = voicings[Math.floor(Math.random() * voicings.length)];
		changed = true;
	}

	// Randomize octave if enabled (range: -2 to +2)
	if (opts.octave) {
		chord.octave = Math.floor(Math.random() * 5) - 2;
		changed = true;
	}

	if (changed) {
		notifySlotEdited(index);
	}
}

// ============================================================================
// Palette Management
// ============================================================================

/**
 * Add a chord to the palette
 * @param chord - Chord object to add
 */
export function addToPalette(chord: Chord): void {
	// Snapshot, not the (possibly proxied) chord itself, so the palette never aliases a slot
	const chordCopy = $state.snapshot(chord);
	progressionState.palette.push(chordCopy);
}

/**
 * Remove a chord from the palette
 * @param index - Index of chord to remove
 */
export function removeFromPalette(index: number): void {
	if (index >= 0 && index < progressionState.palette.length) {
		progressionState.palette.splice(index, 1);
	}
}

/**
 * Clear all chords from the palette
 */
export function clearPalette(): void {
	progressionState.palette = [];
}

/**
 * Move a chord within the palette (reorder)
 * @param fromIndex - Source index
 * @param toIndex - Destination index
 */
export function moveInPalette(fromIndex: number, toIndex: number): void {
	if (
		fromIndex >= 0 &&
		fromIndex < progressionState.palette.length &&
		toIndex >= 0 &&
		toIndex < progressionState.palette.length &&
		fromIndex !== toIndex
	) {
		const [chord] = progressionState.palette.splice(fromIndex, 1);
		progressionState.palette.splice(toIndex, 0, chord);
	}
}

// ============================================================================
// Saved Progressions Management
// ============================================================================

/**
 * Initialize saved progressions from loaded data (typically from IndexedDB)
 * @param progressions - Array of saved progressions
 */
export function initSavedProgressions(progressions: SavedProgression[]): void {
	savedLibrary.items = progressions;
}

/**
 * Add a new saved progression to the store
 * @param progression - The saved progression to add
 */
export function addSavedProgression(progression: SavedProgression): void {
	// Newest first. Raw state: reassign, never mutate in place
	savedLibrary.items = [progression, ...savedLibrary.items];
}

/**
 * Remove a saved progression from the store by ID
 * @param id - The ID of the progression to remove
 */
export function removeSavedProgression(id: string): void {
	savedLibrary.items = savedLibrary.items.filter((p) => p.id !== id);
}

/**
 * Load a saved progression into the canvas (replaces current progression)
 * @param progression - The chord array to load. It keeps its saved length, even below
 *   `MIN_PROGRESSION_SLOTS`: padding would add silent bars to playback and export.
 */
export function loadProgressionToCanvas(progression: (Chord | null)[]): void {
	// Copy every chord, not just the array: the canvas is edited in place, and sharing the
	// library entry's chord objects would let those edits rewrite the saved entry
	progressionState.progression = progression.map((chord) => (chord ? { ...chord } : null));
	onProgressionReplaced();
}

// ============================================================================
// Live Audition
// ============================================================================
// The audition transaction lives beside the mutators so they can keep its record pointing at
// the chord being tried: the record follows a chord that moves, and an explicit action on the
// audited slot wins over the audition. Audition writes go through `writeHarmony` directly.

/**
 * Drop the audition record if it belongs to the given slot
 * @param index - Slot index
 */
function discardAuditionAt(index: number): void {
	if (progressionState.audition?.slotIndex === index) {
		progressionState.audition = null;
	}
}

/**
 * The user set the slot's inversion explicitly, so Revert must not restore one a candidate clamped
 * @param index - Slot index
 */
function forgetClampedInversion(index: number): void {
	const record = progressionState.audition;
	if (record?.slotIndex === index) record.clampedInversion = null;
}

/** Two slots exchanged contents (a move onto an empty slot, or a swap) */
function onSlotsExchanged(indexA: number, indexB: number): void {
	const record = progressionState.audition;
	if (record) record.slotIndex = remapIndexAfterExchange(record.slotIndex, indexA, indexB);
	handleSlotsExchanged(indexA, indexB);
}

/** A slot was inserted, shifting everything at or after it one place right */
function onSlotInserted(index: number): void {
	const record = progressionState.audition;
	if (record) record.slotIndex = remapIndexAfterInsert(record.slotIndex, index);
	handleSlotInserted(index);
}

/** A slot was removed, shifting everything after it one place left */
function onSlotRemoved(index: number): void {
	const record = progressionState.audition;
	if (record) {
		const next = remapIndexAfterRemove(record.slotIndex, index);
		if (next === null) progressionState.audition = null;
		else record.slotIndex = next;
	}
	handleSlotRemoved(index);
}

/** A slot's chord was deleted: the explicit action wins over any audition on it */
function onSlotCleared(index: number): void {
	discardAuditionAt(index);
	handleSlotCleared(index);
}

/** The whole progression was replaced (cleared, or a saved progression loaded) */
function onProgressionReplaced(): void {
	progressionState.audition = null;
	handleProgressionReplaced();
}

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
	if (!Number.isInteger(slotIndex) || !isValidSlotIndex(slotIndex)) return;

	// Staging onto a different slot commits whatever was pending on the old one
	if (progressionState.audition && progressionState.audition.slotIndex !== slotIndex) {
		progressionState.audition = null;
	}

	const current = progressionState.progression[slotIndex];
	if (!progressionState.audition && current) {
		progressionState.audition = {
			slotIndex,
			baselineRoot: current.root,
			baselineQuality: current.quality,
			clampedInversion: null
		};
	}

	const inversionBefore = current?.inversion ?? 0;
	writeHarmony(slotIndex, chord);
	const inversionAfter = progressionState.progression[slotIndex]?.inversion ?? 0;
	const record = progressionState.audition;
	if (
		record?.slotIndex === slotIndex &&
		record.clampedInversion === null &&
		inversionBefore > 0 &&
		inversionAfter === 0
	) {
		record.clampedInversion = inversionBefore;
	}

	// Returning to the baseline resolves the transaction; there is nothing left to commit/revert.
	if (
		record &&
		record.slotIndex === slotIndex &&
		chord.root === record.baselineRoot &&
		chord.quality === record.baselineQuality
	) {
		progressionState.audition = null;
		// Back on the baseline harmony, so the inversion a smaller candidate clamped away fits again
		const slot = progressionState.progression[slotIndex];
		if (record.clampedInversion !== null && slot && slot.inversion === 0) {
			setInversion(slotIndex, record.clampedInversion);
		}
	}
}

/**
 * Make the pending candidate permanent by forgetting the baseline
 */
export function commitAudition(): void {
	progressionState.audition = null;
}

/**
 * Restore the baseline harmony and end the transaction.
 * The slot keeps every performance setting it picked up while auditioning, except that an
 * inversion clamped away by a smaller candidate is restored (unless the user re-set it).
 */
export function revertAudition(): void {
	const record = progressionState.audition;
	if (!record) return;

	progressionState.audition = null;
	if (!isValidSlotIndex(record.slotIndex)) return;
	writeHarmony(record.slotIndex, {
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
