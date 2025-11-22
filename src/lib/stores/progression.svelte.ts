/**
 * Global State Management for Chord Progression Builder
 * Uses Svelte 5 $state rune for reactive state
 */

import type { Chord } from '$lib/utils/theory-engine';
import { QUALITIES, VOICING_PRESETS } from '$lib/utils/theory-engine';
import { notifyChordUpdated } from '$lib/utils/audio-playback';
import { getScaleNotes, getValidQualitiesForRoot } from '$lib/utils/scale-helper';

/** Maximum number of visible chord slots in the canvas */
export const MAX_PROGRESSION_SLOTS = 4;

/**
 * Check if a slot index is valid (within bounds)
 * @param index - Slot index to validate
 * @returns true if index is valid (0-3)
 */
function isValidSlotIndex(index: number): boolean {
	return index >= 0 && index < MAX_PROGRESSION_SLOTS;
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
	progression: [null, null, null, null] as (Chord | null)[],

	/** Array of chords in the palette (variable size) */
	palette: [] as Chord[]
});

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
 * Remove a chord from the progression, leaving an empty slot
 * @param index - Slot index (0-3)
 */
export function removeChord(index: number): void {
	if (isValidSlotIndex(index)) {
		progressionState.progression[index] = null;
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
 * Clear all chords from the progression, resetting to empty slots
 */
export function clearProgression(): void {
	progressionState.progression = [null, null, null, null];
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
 * Randomize quality, inversion, and voicing of a chord while keeping root and octave unchanged
 * @param index - Slot index (0-3)
 */
export function randomizeChord(index: number): void {
	if (isValidSlotIndex(index)) {
		const chord = progressionState.progression[index];
		if (!chord) return;

		// Determine which qualities to use
		let availableQualities = Object.keys(QUALITIES) as (keyof typeof QUALITIES)[];

		// If scale filter is enabled AND randomizeWithinScale is true, filter qualities
		if (progressionState.randomizeWithinScale && progressionState.scale) {
			const scaleNotes = getScaleNotes(progressionState.scale.key, progressionState.scale.mode);
			const validQualities = getValidQualitiesForRoot(chord.root, scaleNotes);

			if (validQualities.length > 0) {
				availableQualities = validQualities;
			}
		}

		// Get random quality
		const randomQuality = availableQualities[Math.floor(Math.random() * availableQualities.length)];

		// Get random inversion based on the new quality
		const intervals = QUALITIES[randomQuality];
		const numNotes = intervals.length;
		const randomInversion = Math.floor(Math.random() * numNotes);

		// Get random voicing
		const voicings = Object.keys(VOICING_PRESETS) as (keyof typeof VOICING_PRESETS)[];
		const randomVoicing = voicings[Math.floor(Math.random() * voicings.length)];

		chord.voicing = randomVoicing;
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
