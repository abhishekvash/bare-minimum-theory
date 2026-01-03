/**
 * Global State Management for Chord Progression Builder
 * Uses Svelte 5 $state rune for reactive state
 */

import type { Chord } from '$lib/utils/theory-engine';
import { QUALITIES, VOICING_PRESETS, getChordNotes } from '$lib/utils/theory-engine';
import { notifyChordUpdated } from '$lib/utils/audio-playback';
import { getScaleNotes, getValidQualitiesForRoot } from '$lib/utils/scale-helper';
import type { SavedProgression } from '$lib/utils/progression-persistence';
import { settingsState } from '$lib/stores/settings.svelte';

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

/**
 * Check if a slot index is valid (within bounds)
 * @param index - Slot index to validate
 * @returns true if index is valid
 */
function isValidSlotIndex(index: number): boolean {
	return index >= 0 && index < progressionState.progression.length;
}

/**
 * Check if a progression has at least one non-null chord
 * @param progression - Array of chord slots (may contain nulls)
 * @returns true if at least one chord exists
 */
export function hasNonNullChords(progression: (Chord | null)[]): boolean {
	return progression.some((c) => c !== null);
}

/**
 * Type guard to check if an unknown value is a valid Chord object
 * @param value - Value to validate
 * @returns true if value is a valid Chord object
 */
export function isValidChord(value: unknown): value is Chord {
	if (!value || typeof value !== 'object') return false;
	const obj = value as Record<string, unknown>;

	return (
		typeof obj.root === 'number' &&
		typeof obj.quality === 'string' &&
		typeof obj.inversion === 'number' &&
		typeof obj.voicing === 'string' &&
		typeof obj.octave === 'number' &&
		typeof obj.duration === 'string'
	);
}

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

	/** Fixed-size array of chord slots (null = empty slot) */
	progression: [null, null] as (Chord | null)[],

	/** Array of chords in the palette (variable size) */
	palette: [] as Chord[],

	/** Saved progressions management */
	savedProgressions: {
		/** Array of saved progressions (newest first) */
		items: [] as SavedProgression[],
		/** All unique tags across saved progressions (for autocomplete) */
		availableTags: [] as string[]
	}
});

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
		notifyChordUpdated(emptyIndex);
	}
}

/**
 * Determine if all slots in the progression are filled
 */
export function isProgressionFull(): boolean {
	return progressionState.progression.every((c) => c !== null);
}

/**
 * Insert a chord at a specific slot index, replacing any existing chord
 * @param index - Slot index (0-3)
 * @param chord - Chord to place in the slot
 */
export function insertChordAt(index: number, chord: Chord): void {
	if (!isValidSlotIndex(index)) return;
	progressionState.progression[index] = chord;
	notifyChordUpdated(index);
}

/**
 * Add an empty slot at the end of the progression
 */
export function addSlot(): void {
	if (progressionState.progression.length < MAX_PROGRESSION_SLOTS) {
		progressionState.progression.push(null);
	}
}

/**
 * Insert an empty slot at a specific index
 * @param index - Index to insert at
 */
export function insertSlot(index: number): void {
	if (progressionState.progression.length < MAX_PROGRESSION_SLOTS && index >= 0 && index <= progressionState.progression.length) {
		progressionState.progression.splice(index, 0, null);
	}
}

/**
 * Remove a slot entirely from the progression
 * @param index - Index of the slot to remove
 */
export function removeSlot(index: number): void {
	if (isValidSlotIndex(index) && progressionState.progression.length > 1) {
		progressionState.progression.splice(index, 1);
		notifyChordUpdated(index);
	}
}

/**
 * Remove a chord from the progression, removing the slot entirely
 * @param index - Slot index
 */
export function removeChord(index: number): void {
	if (isValidSlotIndex(index)) {
		progressionState.progression.splice(index, 1);
		// If we removed the last slot, ensure we have at least one empty slot
		if (progressionState.progression.length === 0) {
			progressionState.progression.push(null);
		}
		notifyChordUpdated(index);
	}
}

/**
 * Update a chord at a specific position in the progression
 * @param index - Slot index (0-3)
 * @param chord - New chord object to replace existing one
 */
export function updateChord(index: number, chord: Chord): void {
	if (isValidSlotIndex(index)) {
		progressionState.progression[index] = chord;
		notifyChordUpdated(index);
	}
}

/**
 * Clear all chords from the progression, resetting to 4 empty slots
 */
export function clearProgression(): void {
	progressionState.progression = [null, null];
}

/**
 * Move a chord from one slot to another (swap)
 * @param fromIndex - Source slot index (0-3)
 * @param toIndex - Destination slot index (0-3)
 */
export function moveChord(fromIndex: number, toIndex: number): void {
	if (!isValidSlotIndex(fromIndex) || !isValidSlotIndex(toIndex) || fromIndex === toIndex) {
		return;
	}

	// Swap the chords
	const temp = progressionState.progression[fromIndex];
	progressionState.progression[fromIndex] = progressionState.progression[toIndex];
	progressionState.progression[toIndex] = temp;

	// Notify both positions of the change
	notifyChordUpdated(fromIndex);
	notifyChordUpdated(toIndex);
}

/**
 * Cycle through inversions for a chord in the progression
 * @param index - Slot index (0-3)
 */
export function cycleInversion(index: number): void {
	if (isValidSlotIndex(index)) {
		const chord = progressionState.progression[index];
		if (!chord) return;

		// Max inversion depends on number of notes in the chord
		const intervals = QUALITIES[chord.quality];
		const numNotes = intervals.length;
		chord.inversion = (chord.inversion + 1) % numNotes;
		notifyChordUpdated(index);
	}
}

/**
 * Set a specific inversion for a chord in the progression
 * @param index - Slot index (0-3)
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
			notifyChordUpdated(index);
		}
	}
}

/**
 * Randomize the voicing of a chord in the progression
 * @param index - Slot index (0-3)
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
			notifyChordUpdated(index);
		}
	}
}

/**
 * Set a specific voicing for a chord in the progression
 * @param index - Slot index (0-3)
 * @param voicing - The voicing preset to set
 */
export function setVoicing(index: number, voicing: keyof typeof VOICING_PRESETS): void {
	if (isValidSlotIndex(index)) {
		const chord = progressionState.progression[index];
		if (!chord) return;

		chord.voicing = voicing;
		notifyChordUpdated(index);
	}
}

/**
 * Set a specific duration for a chord in the progression
 * @param index - Slot index (0-3)
 * @param duration - Duration string (e.g., '1m', '2n', '4n')
 */
export function setDuration(index: number, duration: string): void {
	if (isValidSlotIndex(index)) {
		const chord = progressionState.progression[index];
		if (!chord) return;

		chord.duration = duration;
		notifyChordUpdated(index);
	}
}

/**
 * Transpose a chord up or down by one octave
 * @param index - Slot index (0-3)
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
			notifyChordUpdated(index);
		}
	}
}

/**
 * Randomize chord parameters based on user-configured options
 * By default, only randomizes inversion and voicing (not quality or octave)
 * @param index - Slot index (0-3)
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

		chord.quality = availableQualities[Math.floor(Math.random() * availableQualities.length)];
		changed = true;
	}

	// Randomize inversion if enabled
	if (opts.inversion) {
		const intervals = QUALITIES[chord.quality];
		const numNotes = intervals.length;
		chord.inversion = Math.floor(Math.random() * numNotes);
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
		notifyChordUpdated(index);
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
	// Create a deep copy to avoid reference issues
	const chordCopy = JSON.parse(JSON.stringify(chord));
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
 * @param tags - Array of unique tags across all progressions
 */
export function initSavedProgressions(progressions: SavedProgression[], tags: string[]): void {
	progressionState.savedProgressions.items = progressions;
	progressionState.savedProgressions.availableTags = tags;
}

/**
 * Add a new saved progression to the store
 * @param progression - The saved progression to add
 */
export function addSavedProgression(progression: SavedProgression): void {
	// Add at the beginning (newest first) - use reassignment to ensure reactivity
	progressionState.savedProgressions.items = [
		progression,
		...progressionState.savedProgressions.items
	];
}

/**
 * Remove a saved progression from the store by ID
 * @param id - The ID of the progression to remove
 */
export function removeSavedProgression(id: string): void {
	// Use filter and reassignment to ensure reactivity
	progressionState.savedProgressions.items = progressionState.savedProgressions.items.filter(
		(p) => p.id !== id
	);
}

/**
 * Update the available tags list (typically after save/delete operations)
 * @param tags - Updated array of unique tags
 */
export function updateAvailableTags(tags: string[]): void {
	progressionState.savedProgressions.availableTags = tags;
}

/**
 * Load a saved progression into the canvas (replaces current progression)
 * @param progression - The chord array to load (4-slot array with nulls)
 */
export function loadProgressionToCanvas(progression: (Chord | null)[]): void {
	// Copy the array to avoid reference issues
	progressionState.progression = [...progression] as (Chord | null)[];
}
