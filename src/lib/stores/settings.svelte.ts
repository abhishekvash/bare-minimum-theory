/**
 * Settings State Management
 * Handles UI preferences, randomization options, and piano keyboard visualization
 */

import { DEFAULT_RANDOMIZE_OPTIONS, type RandomizeOptions } from '$lib/utils/settings-persistence';
import { DEFAULT_PIANO_SETTINGS, type PianoSettings } from '$lib/utils/piano-settings-persistence';

export const settingsState = $state({
    /** Configuration for what the randomize button affects */
    randomizeOptions: { ...DEFAULT_RANDOMIZE_OPTIONS } as RandomizeOptions,

    /** Piano keyboard visualization state */
    pianoKeyboard: {
        /** Whether the piano keyboard is visible */
        visible: DEFAULT_PIANO_SETTINGS.visible,
        /** Currently active (playing) MIDI note numbers */
        activeNotes: [] as number[]
    }
});

// ============================================================================
// Randomize Options Management
// ============================================================================

/**
 * Set a specific randomize option
 * @param key - The option key (inversion, voicing, octave, quality)
 * @param value - Whether to enable or disable this option
 */
export function setRandomizeOption(key: keyof RandomizeOptions, value: boolean): void {
    settingsState.randomizeOptions[key] = value;
}

/**
 * Initialize randomize options (typically from localStorage)
 * @param options - The complete options object to set
 */
export function initRandomizeOptions(options: RandomizeOptions): void {
    settingsState.randomizeOptions = { ...options };
}

// ============================================================================
// Piano Keyboard Management
// ============================================================================

/**
 * Set piano keyboard visibility
 * @param visible - Whether the piano should be visible
 */
export function setPianoVisible(visible: boolean): void {
    settingsState.pianoKeyboard.visible = visible;
}

/**
 * Set the currently active (playing) notes on the piano
 * @param notes - Array of MIDI note numbers currently playing
 */
export function setActiveNotes(notes: number[]): void {
    settingsState.pianoKeyboard.activeNotes = notes;
}

/**
 * Clear all active notes from the piano
 */
export function clearActiveNotes(): void {
    settingsState.pianoKeyboard.activeNotes = [];
}

/**
 * Initialize piano keyboard settings from loaded preferences
 */
export function initPianoSettings(settings: PianoSettings): void {
    settingsState.pianoKeyboard.visible = settings.visible;
}
