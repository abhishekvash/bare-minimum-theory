/**
 * Global State Management for Chord Progression Builder
 * Uses Svelte 5 $state rune for reactive state
 */

import type { Chord } from '$lib/utils/theory-engine';
import { QUALITIES, VOICING_PRESETS } from '$lib/utils/theory-engine';
import { notifyChordUpdated } from '$lib/utils/audio-playback';

/** Maximum number of visible chord slots in the canvas */
export const MAX_PROGRESSION_SLOTS = 4;

/**
 * Main reactive state object for the entire application
 * Exported as an object to maintain deep reactivity
 */
export const progressionState = $state({
	/** Optional scale filter (e.g., { key: 'C', mode: 'major' }) */
	scale: null as { key: string; mode: string } | null,

	/** Whether the scale filter is currently active */
	scaleFilterEnabled: false,

	/** Tracks the chord currently being built in the UI */
	builderState: {
		/** Selected root note (MIDI number, e.g., 60 = C4) */
		selectedRoot: null as number | null,
		/** Selected chord quality (e.g., 'maj7', 'm', '7') */
		selectedQuality: null as keyof typeof QUALITIES | null
	},

	/** Array of complete chords in the progression */
	progression: [] as Chord[]
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
 * Add a chord to the progression
 * @param chord - Complete chord object to add
 */
export function addChord(chord: Chord): void {
	if (isProgressionFull()) return;
	progressionState.progression.push(chord);
}

/**
 * Determine if the progression already contains the maximum number of slots
 */
export function isProgressionFull(): boolean {
	return progressionState.progression.length >= MAX_PROGRESSION_SLOTS;
}

/**
 * Insert a chord at a specific slot index. If the progression is already full,
 * the chord at the clamped slot index will be replaced.
 * @param index - Desired slot index (0-based)
 * @param chord - Chord to insert or replace with
 */
export function insertChordAt(index: number, chord: Chord): void {
	if (index < 0) return;

	const clampedIndex = Math.min(index, MAX_PROGRESSION_SLOTS - 1);

	if (isProgressionFull()) {
		progressionState.progression[clampedIndex] = chord;
		notifyChordUpdated(clampedIndex);
		return;
	}

	const insertIndex = Math.min(clampedIndex, progressionState.progression.length);
	progressionState.progression.splice(insertIndex, 0, chord);
	if (progressionState.progression.length > MAX_PROGRESSION_SLOTS) {
		progressionState.progression.length = MAX_PROGRESSION_SLOTS;
	}
	notifyChordUpdated(insertIndex);
}

/**
 * Remove a chord from the progression at a specific index
 * @param index - Position in the progression array
 */
export function removeChord(index: number): void {
	if (index >= 0 && index < progressionState.progression.length) {
		progressionState.progression.splice(index, 1);
	}
}

/**
 * Update a chord at a specific position in the progression
 * @param index - Position in the progression array
 * @param chord - New chord object to replace existing one
 */
export function updateChord(index: number, chord: Chord): void {
	if (index >= 0 && index < progressionState.progression.length) {
		progressionState.progression[index] = chord;
		notifyChordUpdated(index);
	}
}

/**
 * Clear all chords from the progression
 */
export function clearProgression(): void {
	progressionState.progression = [];
}

/**
 * Cycle through inversions for a chord in the progression
 * @param index - Position in the progression array
 */
export function cycleInversion(index: number): void {
	if (index >= 0 && index < progressionState.progression.length) {
		const chord = progressionState.progression[index];
		// Max inversion depends on number of notes in the chord
		const intervals = QUALITIES[chord.quality];
		const numNotes = intervals.length;
		chord.inversion = (chord.inversion + 1) % numNotes;
		notifyChordUpdated(index);
	}
}

/**
 * Set a specific inversion for a chord in the progression
 * @param index - Position in the progression array
 * @param inversion - The inversion number to set (0 = root position, 1 = first inversion, etc.)
 */
export function setInversion(index: number, inversion: number): void {
	if (index >= 0 && index < progressionState.progression.length) {
		const chord = progressionState.progression[index];
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
 * @param index - Position in the progression array
 */
export function randomizeVoicing(index: number): void {
	if (index >= 0 && index < progressionState.progression.length) {
		const voicings = Object.keys(VOICING_PRESETS) as (keyof typeof VOICING_PRESETS)[];
		const currentVoicing = progressionState.progression[index].voicing;

		// Get a different voicing than the current one
		const otherVoicings = voicings.filter((v) => v !== currentVoicing);
		if (otherVoicings.length > 0) {
			const randomIndex = Math.floor(Math.random() * otherVoicings.length);
			progressionState.progression[index].voicing = otherVoicings[randomIndex];
			notifyChordUpdated(index);
		}
	}
}

/**
 * Set a specific voicing for a chord in the progression
 * @param index - Position in the progression array
 * @param voicing - The voicing preset to set
 */
export function setVoicing(index: number, voicing: keyof typeof VOICING_PRESETS): void {
	if (index >= 0 && index < progressionState.progression.length) {
		progressionState.progression[index].voicing = voicing;
		notifyChordUpdated(index);
	}
}

/**
 * Move a chord to a different position in the progression
 * @param fromIndex - Current position
 * @param toIndex - Target position
 */
export function moveChord(fromIndex: number, toIndex: number): void {
	if (
		fromIndex >= 0 &&
		fromIndex < progressionState.progression.length &&
		toIndex >= 0 &&
		toIndex < progressionState.progression.length
	) {
		const [chord] = progressionState.progression.splice(fromIndex, 1);
		progressionState.progression.splice(toIndex, 0, chord);
	}
}

/**
 * Transpose a chord up or down by one octave
 * @param index - Position in the progression array
 * @param direction - 'up' to transpose up, 'down' to transpose down
 */
export function transposeOctave(index: number, direction: 'up' | 'down'): void {
	if (index >= 0 && index < progressionState.progression.length) {
		const chord = progressionState.progression[index];
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
 * @param index - Position in the progression array
 */
export function randomizeChord(index: number): void {
	if (index >= 0 && index < progressionState.progression.length) {
		const chord = progressionState.progression[index];

		// Get random quality
		const qualities = Object.keys(QUALITIES) as (keyof typeof QUALITIES)[];
		const randomQuality = qualities[Math.floor(Math.random() * qualities.length)];

		// Get random inversion based on the new quality
		const intervals = QUALITIES[randomQuality];
		const numNotes = intervals.length;
		const randomInversion = Math.floor(Math.random() * numNotes);

		// Get random voicing
		const voicings = Object.keys(VOICING_PRESETS) as (keyof typeof VOICING_PRESETS)[];
		const randomVoicing = voicings[Math.floor(Math.random() * voicings.length)];

		// Update chord (keep root and octave unchanged)
		chord.quality = randomQuality;
		chord.inversion = randomInversion;
		chord.voicing = randomVoicing;
		notifyChordUpdated(index);
	}
}
