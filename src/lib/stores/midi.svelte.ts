/**
 * MIDI State Management
 * Handles MIDI output configuration, connection state, and clock sync
 */

import { DEFAULT_MIDI_SETTINGS, type MIDISettings } from '$lib/utils/midi-settings-persistence';
import { DEFAULT_MIDI_CLOCK_SETTINGS, type MIDIClockSettings } from '$lib/utils/midi-clock-persistence';

export const midiState = $state({
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
		selectedInputId: DEFAULT_MIDI_CLOCK_SETTINGS.selectedInputId,
		/** Whether currently receiving clock signals */
		isReceivingClock: false,
		/** Detected BPM from clock signals (null if no clock) */
		detectedBpm: null as number | null,
		/** Whether DAW transport is currently playing (for external control) */
		isExternallyPlaying: false
	}
});

// ============================================================================
// MIDI Output Management
// ============================================================================

/**
 * Set whether MIDI output is enabled
 */
export function setMIDIEnabled(enabled: boolean): void {
	midiState.enabled = enabled;
}

/**
 * Set the selected MIDI device ID
 */
export function setMIDIDevice(deviceId: string | null): void {
	midiState.selectedDeviceId = deviceId;
}

/**
 * Update the list of available MIDI outputs
 */
export function updateMIDIOutputs(outputs: Array<{ id: string; name: string }>): void {
	midiState.outputs = outputs;
}

/**
 * Set MIDI connection state
 */
export function setMIDIConnectionState(isConnected: boolean): void {
	midiState.isConnected = isConnected;
}

/**
 * Set MIDI error state
 */
export function setMIDIError(error: string | null): void {
	midiState.error = error;
}

/**
 * Set whether MIDI is supported in this browser
 */
export function setMIDISupported(isSupported: boolean): void {
	midiState.isSupported = isSupported;
}

/**
 * Set whether MIDI permission was granted
 */
export function setMIDIPermissionGranted(granted: boolean): void {
	midiState.permissionGranted = granted;
}

/**
 * Set whether user has seen the setup modal
 */
export function setMIDIHasSeenSetupModal(seen: boolean): void {
	midiState.hasSeenSetupModal = seen;
}

/**
 * Set MIDI channel (1-16)
 */
export function setMIDIChannel(channel: number): void {
	if (channel >= 1 && channel <= 16) {
		midiState.midiChannel = channel;
	}
}

/**
 * Set MIDI velocity (0-127)
 */
export function setMIDIVelocity(velocity: number): void {
	if (velocity >= 0 && velocity <= 127) {
		midiState.velocity = velocity;
	}
}

/**
 * Set whether MIDI strum is enabled
 */
export function setMIDIStrumEnabled(enabled: boolean): void {
	midiState.strumEnabled = enabled;
}

/**
 * Initialize MIDI settings from loaded preferences
 */
export function initMIDISettings(settings: MIDISettings): void {
	midiState.enabled = settings.enabled;
	midiState.selectedDeviceId = settings.selectedDeviceId;
	midiState.hasSeenSetupModal = settings.hasSeenSetupModal;
	midiState.midiChannel = settings.midiChannel;
	midiState.velocity = settings.velocity;
	midiState.strumEnabled = settings.strumEnabled;
}

// ============================================================================
// MIDI Clock Sync Management
// ============================================================================

/**
 * Update the list of available MIDI inputs
 */
export function updateMIDIInputs(inputs: Array<{ id: string; name: string }>): void {
	midiState.inputs = inputs;
}

/**
 * Set whether clock sync is enabled (opt-in feature)
 */
export function setClockSyncEnabled(enabled: boolean): void {
	midiState.clockSync.enabled = enabled;
}

/**
 * Set the selected MIDI input device for clock sync
 */
export function setClockInputDevice(deviceId: string | null): void {
	midiState.clockSync.selectedInputId = deviceId;
}

/**
 * Set whether currently receiving clock signals
 */
export function setClockReceivingState(isReceiving: boolean): void {
	midiState.clockSync.isReceivingClock = isReceiving;
}

/**
 * Set the detected BPM from clock signals
 */
export function setDetectedBpm(bpm: number | null): void {
	midiState.clockSync.detectedBpm = bpm;
}

/**
 * Set whether DAW transport is currently playing (for external control)
 */
export function setExternalPlayingState(isPlaying: boolean): void {
	midiState.clockSync.isExternallyPlaying = isPlaying;
}

/**
 * Initialize MIDI clock settings from loaded preferences
 */
export function initMIDIClockSettings(settings: MIDIClockSettings): void {
	midiState.clockSync.enabled = settings.enabled;
	midiState.clockSync.selectedInputId = settings.selectedInputId;
}
