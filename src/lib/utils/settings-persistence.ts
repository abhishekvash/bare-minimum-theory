/**
 * Settings Persistence Utility
 * Handles localStorage load/save for user preferences
 */

import { loadLocalSetting, saveLocalSetting } from './local-setting';

const RANDOMIZE_SETTINGS_KEY = 'bmt_randomize_settings';

/**
 * Configuration options for the randomize feature
 */
export interface RandomizeOptions {
	inversion: boolean;
	voicing: boolean;
	octave: boolean;
	quality: boolean;
}

/**
 * Default randomize options:
 * - Inversion and Voicing ON (what users typically want)
 * - Octave and Quality OFF (preserve the chord identity)
 */
export const DEFAULT_RANDOMIZE_OPTIONS: RandomizeOptions = {
	inversion: true,
	voicing: true,
	octave: false,
	quality: false
};

/**
 * Load randomize settings from localStorage
 * Returns defaults if not found or invalid
 */
export function loadRandomizeSettings(): RandomizeOptions {
	return loadLocalSetting(RANDOMIZE_SETTINGS_KEY, DEFAULT_RANDOMIZE_OPTIONS, (stored, defaults) => {
		const flag = (key: keyof RandomizeOptions) =>
			typeof stored[key] === 'boolean' ? stored[key] : defaults[key];
		return {
			inversion: flag('inversion'),
			voicing: flag('voicing'),
			octave: flag('octave'),
			quality: flag('quality')
		};
	});
}

/**
 * Save randomize settings to localStorage
 */
export function saveRandomizeSettings(options: RandomizeOptions): void {
	saveLocalSetting(RANDOMIZE_SETTINGS_KEY, options);
}

const PREVIEW_SETTINGS_KEY = 'bmt_preview_settings';

/**
 * When the app plays chords to help you browse (never while the loop is playing)
 */
export interface PreviewOptions {
	/** Clicking a quality plays the nearest earlier chord first, then the candidate */
	chained: boolean;
	/** Selecting a chord block plays it */
	onSelect: boolean;
	/** Pressing and sweeping across qualities plays each one crossed */
	onSweep: boolean;
}

/**
 * Default preview options: chained preview is opt-in; plain previews stay on
 */
export const DEFAULT_PREVIEW_OPTIONS: PreviewOptions = {
	chained: false,
	onSelect: true,
	onSweep: true
};

/**
 * Load preview settings from localStorage
 * Returns defaults if not found or invalid
 */
export function loadPreviewSettings(): PreviewOptions {
	return loadLocalSetting(PREVIEW_SETTINGS_KEY, DEFAULT_PREVIEW_OPTIONS, (stored, defaults) => {
		const flag = (key: keyof PreviewOptions) =>
			typeof stored[key] === 'boolean' ? stored[key] : defaults[key];
		return { chained: flag('chained'), onSelect: flag('onSelect'), onSweep: flag('onSweep') };
	});
}

/**
 * Save preview settings to localStorage
 */
export function savePreviewSettings(options: PreviewOptions): void {
	saveLocalSetting(PREVIEW_SETTINGS_KEY, options);
}
