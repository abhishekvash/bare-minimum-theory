/**
 * MIDI Settings Persistence Utility
 * Handles localStorage load/save for MIDI preferences
 */

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
	if (typeof window === 'undefined') return DEFAULT_MIDI_SETTINGS;

	try {
		const stored = localStorage.getItem(MIDI_SETTINGS_KEY);
		if (!stored) return DEFAULT_MIDI_SETTINGS;

		const parsed = JSON.parse(stored);

		// Validate and return with defaults for any missing/invalid fields
		return {
			enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_MIDI_SETTINGS.enabled,
			selectedDeviceId:
				typeof parsed.selectedDeviceId === 'string' || parsed.selectedDeviceId === null
					? parsed.selectedDeviceId
					: DEFAULT_MIDI_SETTINGS.selectedDeviceId,
			hasSeenSetupModal:
				typeof parsed.hasSeenSetupModal === 'boolean'
					? parsed.hasSeenSetupModal
					: DEFAULT_MIDI_SETTINGS.hasSeenSetupModal,
			midiChannel:
				typeof parsed.midiChannel === 'number' &&
				parsed.midiChannel >= 1 &&
				parsed.midiChannel <= 16
					? parsed.midiChannel
					: DEFAULT_MIDI_SETTINGS.midiChannel,
			velocity:
				typeof parsed.velocity === 'number' && parsed.velocity >= 0 && parsed.velocity <= 127
					? parsed.velocity
					: DEFAULT_MIDI_SETTINGS.velocity,
			strumEnabled:
				typeof parsed.strumEnabled === 'boolean'
					? parsed.strumEnabled
					: DEFAULT_MIDI_SETTINGS.strumEnabled
		};
	} catch {
		return DEFAULT_MIDI_SETTINGS;
	}
}

/**
 * Save MIDI settings to localStorage
 */
export function saveMIDISettings(settings: MIDISettings): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(MIDI_SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Update a single MIDI setting and persist
 */
export function updateMIDISetting<K extends keyof MIDISettings>(
	key: K,
	value: MIDISettings[K]
): void {
	const current = loadMIDISettings();
	current[key] = value;
	saveMIDISettings(current);
}
