/**
 * MIDI Clock Settings Persistence Utility
 * Handles localStorage load/save for MIDI clock sync preferences
 */

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
	if (typeof window === 'undefined') return DEFAULT_MIDI_CLOCK_SETTINGS;

	try {
		const stored = localStorage.getItem(MIDI_CLOCK_SETTINGS_KEY);
		if (!stored) return DEFAULT_MIDI_CLOCK_SETTINGS;

		const parsed = JSON.parse(stored);

		// Validate and return with defaults for any missing/invalid fields
		return {
			enabled:
				typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_MIDI_CLOCK_SETTINGS.enabled,
			selectedInputId:
				typeof parsed.selectedInputId === 'string' || parsed.selectedInputId === null
					? parsed.selectedInputId
					: DEFAULT_MIDI_CLOCK_SETTINGS.selectedInputId
		};
	} catch {
		return DEFAULT_MIDI_CLOCK_SETTINGS;
	}
}

/**
 * Save MIDI clock settings to localStorage
 */
export function saveMIDIClockSettings(settings: MIDIClockSettings): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(MIDI_CLOCK_SETTINGS_KEY, JSON.stringify(settings));
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
