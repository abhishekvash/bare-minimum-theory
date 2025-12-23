/**
 * Piano Settings Persistence Utility
 * Handles localStorage load/save for piano keyboard visibility preference
 */

const PIANO_SETTINGS_KEY = 'bmt_piano_settings';

/**
 * Configuration options for piano keyboard
 */
export interface PianoSettings {
	/** Whether the piano keyboard is visible */
	visible: boolean;
}

/**
 * Default piano settings (collapsed by default)
 */
export const DEFAULT_PIANO_SETTINGS: PianoSettings = {
	visible: false
};

/**
 * Load piano settings from localStorage
 * Returns defaults if not found or invalid
 */
export function loadPianoSettings(): PianoSettings {
	if (typeof window === 'undefined') return DEFAULT_PIANO_SETTINGS;

	try {
		const stored = localStorage.getItem(PIANO_SETTINGS_KEY);
		if (!stored) return DEFAULT_PIANO_SETTINGS;

		const parsed = JSON.parse(stored);

		// Validate and return with defaults for any missing/invalid fields
		return {
			visible: typeof parsed.visible === 'boolean' ? parsed.visible : DEFAULT_PIANO_SETTINGS.visible
		};
	} catch {
		return DEFAULT_PIANO_SETTINGS;
	}
}

/**
 * Save piano settings to localStorage
 */
export function savePianoSettings(settings: PianoSettings): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(PIANO_SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Update piano visibility and persist
 */
export function updatePianoVisibility(visible: boolean): void {
	savePianoSettings({ visible });
}
