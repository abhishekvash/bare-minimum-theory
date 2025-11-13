/**
 * Global State Management for Chord Progression Builder
 * Uses Svelte 5 $state rune for reactive state
 */

import type { Chord } from '$lib/utils/theory-engine';
import type { QUALITIES } from '$lib/utils/theory-engine/constants';

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
	progressionState.progression.push(chord);
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
		// For now, cycle through 0-3 (covers triads and 7th chords)
		const maxInversion = 3;
		chord.inversion = (chord.inversion + 1) % (maxInversion + 1);
	}
}

/**
 * Randomize the voicing of a chord in the progression
 * @param index - Position in the progression array
 */
export function randomizeVoicing(index: number): void {
	if (index >= 0 && index < progressionState.progression.length) {
		const voicings = ['close', 'open', 'drop2', 'drop3', 'wide'] as const;
		const currentVoicing = progressionState.progression[index].voicing;

		// Get a different voicing than the current one
		const otherVoicings = voicings.filter((v) => v !== currentVoicing);
		const randomIndex = Math.floor(Math.random() * otherVoicings.length);

		progressionState.progression[index].voicing = otherVoicings[randomIndex];
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
