/**
 * Global State Management for Chord Progression Builder
 * Uses Svelte 5 $state rune for reactive state
 */

import type { Chord } from '$lib/utils/theory-engine';
import { QUALITIES, VOICING_PRESETS } from '$lib/utils/theory-engine';
import { notifyChordUpdated } from '$lib/utils/audio-playback';
import { getScaleNotes, getValidQualitiesForRoot } from '$lib/utils/scale-helper';
import type { RandomizeOptions } from '$lib/utils/settings-persistence';
import { DEFAULT_RANDOMIZE_OPTIONS } from '$lib/utils/settings-persistence';
import type { MIDISettings } from '$lib/utils/midi-settings-persistence';
import { DEFAULT_MIDI_SETTINGS } from '$lib/utils/midi-settings-persistence';
import type { MIDIClockSettings } from '$lib/utils/midi-clock-persistence';
import { DEFAULT_MIDI_CLOCK_SETTINGS } from '$lib/utils/midi-clock-persistence';

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
		typeof obj.octave === 'number'
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

	/** Configuration for what the randomize button affects */
	randomizeOptions: { ...DEFAULT_RANDOMIZE_OPTIONS } as RandomizeOptions,

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
	palette: [] as Chord[],

	/** MIDI output configuration */
	midiOutput: {
		/** Whether MIDI output is enabled (master toggle) */
		enabled: DEFAULT_MIDI_SETTINGS.enabled,
		/** Selected MIDI device ID */
		selectedDeviceId: DEFAULT_MIDI_SETTINGS.selectedDeviceId as string | null,
		/** Whether MIDI is supported in this browser */
		isSupported: false,
		/** Whether permission was granted */
		permissionGranted: false,
		/** Available MIDI outputs */
		outputs: [] as Array<{ id: string; name: string }>,
		/** Available MIDI inputs (for clock sync) */
		inputs: [] as Array<{ id: string; name: string }>,
		/** Current connection state */
		isConnected: false,
		/** Last error if any */
		error: null as string | null,
		/** Whether user has seen the setup modal */
		hasSeenSetupModal: DEFAULT_MIDI_SETTINGS.hasSeenSetupModal,
		/** MIDI channel (1-16) */
		midiChannel: DEFAULT_MIDI_SETTINGS.midiChannel,
		/** Note velocity (0-127) */
		velocity: DEFAULT_MIDI_SETTINGS.velocity,
		/** Whether to strum chords (slight delay between notes) */
		strumEnabled: DEFAULT_MIDI_SETTINGS.strumEnabled,
		/** MIDI clock sync configuration (opt-in feature) */
		clockSync: {
			/** Whether clock sync is enabled (disabled by default) */
			enabled: DEFAULT_MIDI_CLOCK_SETTINGS.enabled,
			/** Selected MIDI input device for clock */
			selectedInputId: DEFAULT_MIDI_CLOCK_SETTINGS.selectedInputId as string | null,
			/** Whether currently receiving clock signals */
			isReceivingClock: false,
			/** Detected BPM from clock signals (null if no clock) */
			detectedBpm: null as number | null,
			/** Whether DAW transport is currently playing (for external control) */
			isExternallyPlaying: false
		}
	}
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

/**
 * Set a specific randomize option
 * @param key - The option key (inversion, voicing, octave, quality)
 * @param value - Whether to enable or disable this option
 */
export function setRandomizeOption(key: keyof RandomizeOptions, value: boolean): void {
	progressionState.randomizeOptions[key] = value;
}

/**
 * Initialize randomize options (typically from localStorage)
 * @param options - The complete options object to set
 */
export function initRandomizeOptions(options: RandomizeOptions): void {
	progressionState.randomizeOptions = { ...options };
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
 * Randomize chord parameters based on user-configured options
 * By default, only randomizes inversion and voicing (not quality or octave)
 * @param index - Slot index (0-3)
 */
export function randomizeChord(index: number): void {
	if (!isValidSlotIndex(index)) return;

	const chord = progressionState.progression[index];
	if (!chord) return;

	const opts = progressionState.randomizeOptions;

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
// MIDI Output Management
// ============================================================================

/**
 * Set whether MIDI output is enabled
 */
export function setMIDIEnabled(enabled: boolean): void {
	progressionState.midiOutput.enabled = enabled;
}

/**
 * Set the selected MIDI device ID
 */
export function setMIDIDevice(deviceId: string | null): void {
	progressionState.midiOutput.selectedDeviceId = deviceId;
}

/**
 * Update the list of available MIDI outputs
 */
export function updateMIDIOutputs(outputs: Array<{ id: string; name: string }>): void {
	progressionState.midiOutput.outputs = outputs;
}

/**
 * Set MIDI connection state
 */
export function setMIDIConnectionState(isConnected: boolean): void {
	progressionState.midiOutput.isConnected = isConnected;
}

/**
 * Set MIDI error state
 */
export function setMIDIError(error: string | null): void {
	progressionState.midiOutput.error = error;
}

/**
 * Set whether MIDI is supported in this browser
 */
export function setMIDISupported(isSupported: boolean): void {
	progressionState.midiOutput.isSupported = isSupported;
}

/**
 * Set whether MIDI permission was granted
 */
export function setMIDIPermissionGranted(granted: boolean): void {
	progressionState.midiOutput.permissionGranted = granted;
}

/**
 * Set whether user has seen the setup modal
 */
export function setMIDIHasSeenSetupModal(seen: boolean): void {
	progressionState.midiOutput.hasSeenSetupModal = seen;
}

/**
 * Set MIDI channel (1-16)
 */
export function setMIDIChannel(channel: number): void {
	if (channel >= 1 && channel <= 16) {
		progressionState.midiOutput.midiChannel = channel;
	}
}

/**
 * Set MIDI velocity (0-127)
 */
export function setMIDIVelocity(velocity: number): void {
	if (velocity >= 0 && velocity <= 127) {
		progressionState.midiOutput.velocity = velocity;
	}
}

/**
 * Set whether MIDI strum is enabled
 */
export function setMIDIStrumEnabled(enabled: boolean): void {
	progressionState.midiOutput.strumEnabled = enabled;
}

/**
 * Initialize MIDI settings from loaded preferences
 */
export function initMIDISettings(settings: MIDISettings): void {
	progressionState.midiOutput.enabled = settings.enabled;
	progressionState.midiOutput.selectedDeviceId = settings.selectedDeviceId;
	progressionState.midiOutput.hasSeenSetupModal = settings.hasSeenSetupModal;
	progressionState.midiOutput.midiChannel = settings.midiChannel;
	progressionState.midiOutput.velocity = settings.velocity;
	progressionState.midiOutput.strumEnabled = settings.strumEnabled;
}

// ============================================================================
// MIDI Clock Sync Management
// ============================================================================

/**
 * Update the list of available MIDI inputs
 */
export function updateMIDIInputs(inputs: Array<{ id: string; name: string }>): void {
	progressionState.midiOutput.inputs = inputs;
}

/**
 * Set whether clock sync is enabled (opt-in feature)
 */
export function setClockSyncEnabled(enabled: boolean): void {
	progressionState.midiOutput.clockSync.enabled = enabled;
}

/**
 * Set the selected MIDI input device for clock sync
 */
export function setClockInputDevice(deviceId: string | null): void {
	progressionState.midiOutput.clockSync.selectedInputId = deviceId;
}

/**
 * Set whether currently receiving clock signals
 */
export function setClockReceivingState(isReceiving: boolean): void {
	progressionState.midiOutput.clockSync.isReceivingClock = isReceiving;
}

/**
 * Set the detected BPM from clock signals
 */
export function setDetectedBpm(bpm: number | null): void {
	progressionState.midiOutput.clockSync.detectedBpm = bpm;
}

/**
 * Set whether DAW transport is currently playing (for external control)
 */
export function setExternalPlayingState(isPlaying: boolean): void {
	progressionState.midiOutput.clockSync.isExternallyPlaying = isPlaying;
}

/**
 * Initialize MIDI clock settings from loaded preferences
 */
export function initMIDIClockSettings(settings: MIDIClockSettings): void {
	progressionState.midiOutput.clockSync.enabled = settings.enabled;
	progressionState.midiOutput.clockSync.selectedInputId = settings.selectedInputId;
}
