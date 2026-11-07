/**
 * MIDI Settings Persistence Utility
 * Handles localStorage load/save for MIDI preferences
 */

import { loadLocalSetting, saveLocalSetting } from './local-setting';

const MIDI_SETTINGS_KEY = 'bmt_midi_settings';

/**
 * Configuration options for MIDI output
 */
export interface MIDISettings {
	/** Whether MIDI output is enabled */
	enabled: boolean;
	/** ID of the selected MIDI device */
	selectedDeviceId: string | null;
	/** Whether user has seen the setup modal */
	hasSeenSetupModal: boolean;
	/** MIDI channel (1-16, stored as 1-indexed for user display) */
	midiChannel: number;
	/** Note velocity (0-127) */
	velocity: number;
	/** Whether to strum chords (slight delay between notes) */
	strumEnabled: boolean;
}

/**
 * Default MIDI settings
 */
export const DEFAULT_MIDI_SETTINGS: MIDISettings = {
	enabled: false,
	selectedDeviceId: null,
	hasSeenSetupModal: false,
	midiChannel: 1,
	velocity: 100,
	strumEnabled: true
};

/**
 * Load MIDI settings from localStorage
 * Returns defaults if not found or invalid
 */
export function loadMIDISettings(): MIDISettings {
	return loadLocalSetting(MIDI_SETTINGS_KEY, DEFAULT_MIDI_SETTINGS, (stored, defaults) => {
		const { enabled, selectedDeviceId, hasSeenSetupModal, midiChannel, velocity, strumEnabled } =
			stored;
		return {
			enabled: typeof enabled === 'boolean' ? enabled : defaults.enabled,
			selectedDeviceId:
				typeof selectedDeviceId === 'string' || selectedDeviceId === null
					? selectedDeviceId
					: defaults.selectedDeviceId,
			hasSeenSetupModal:
				typeof hasSeenSetupModal === 'boolean' ? hasSeenSetupModal : defaults.hasSeenSetupModal,
			midiChannel:
				typeof midiChannel === 'number' && midiChannel >= 1 && midiChannel <= 16
					? midiChannel
					: defaults.midiChannel,
			velocity:
				typeof velocity === 'number' && velocity >= 0 && velocity <= 127
					? velocity
					: defaults.velocity,
			strumEnabled: typeof strumEnabled === 'boolean' ? strumEnabled : defaults.strumEnabled
		};
	});
}

/**
 * Save MIDI settings to localStorage
 */
export function saveMIDISettings(settings: MIDISettings): void {
	saveLocalSetting(MIDI_SETTINGS_KEY, settings);
}
