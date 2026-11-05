/**
 * Piano Settings Persistence Utility
 * Handles localStorage load/save for piano keyboard visibility preference
 */

import { loadLocalSetting, saveLocalSetting } from './local-setting';

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
	return loadLocalSetting(PIANO_SETTINGS_KEY, DEFAULT_PIANO_SETTINGS, (stored, defaults) => ({
		visible: typeof stored.visible === 'boolean' ? stored.visible : defaults.visible
	}));
}

/**
 * Save piano settings to localStorage
 */
export function savePianoSettings(settings: PianoSettings): void {
	saveLocalSetting(PIANO_SETTINGS_KEY, settings);
}

/**
 * Update piano visibility and persist
 */
export function updatePianoVisibility(visible: boolean): void {
	savePianoSettings({ visible });
}
