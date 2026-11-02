/**
 * MIDI Clock Settings Persistence Utility
 * Handles localStorage load/save for MIDI clock sync preferences
 */

import { loadLocalSetting, saveLocalSetting } from './local-setting';

const MIDI_CLOCK_SETTINGS_KEY = 'bmt_midi_clock_settings';

/**
 * Configuration options for MIDI clock sync
 */
export interface MIDIClockSettings {
	/** Whether clock sync is enabled (opt-in, disabled by default) */
	enabled: boolean;
	/** ID of the selected MIDI input device for clock */
	selectedInputId: string | null;
}

/**
 * Default MIDI clock settings - disabled by default (opt-in feature)
 */
export const DEFAULT_MIDI_CLOCK_SETTINGS: MIDIClockSettings = {
	enabled: false,
	selectedInputId: null
};

/**
 * Load MIDI clock settings from localStorage
 * Returns defaults if not found or invalid
 */
export function loadMIDIClockSettings(): MIDIClockSettings {
	return loadLocalSetting(
		MIDI_CLOCK_SETTINGS_KEY,
		DEFAULT_MIDI_CLOCK_SETTINGS,
		(stored, defaults) => {
			const { enabled, selectedInputId } = stored;
			return {
				enabled: typeof enabled === 'boolean' ? enabled : defaults.enabled,
				selectedInputId:
					typeof selectedInputId === 'string' || selectedInputId === null
						? selectedInputId
						: defaults.selectedInputId
			};
		}
	);
}

/**
 * Save MIDI clock settings to localStorage
 */
export function saveMIDIClockSettings(settings: MIDIClockSettings): void {
	saveLocalSetting(MIDI_CLOCK_SETTINGS_KEY, settings);
}

/**
 * Update a single MIDI clock setting and persist
 */
export function updateMIDIClockSetting<K extends keyof MIDIClockSettings>(
	key: K,
	value: MIDIClockSettings[K]
): void {
	const current = loadMIDIClockSettings();
	current[key] = value;
	saveMIDIClockSettings(current);
}
