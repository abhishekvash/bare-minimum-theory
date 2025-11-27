/**
 * Settings Persistence Utility
 * Handles localStorage load/save for user preferences
 */

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
	if (typeof window === 'undefined') return DEFAULT_RANDOMIZE_OPTIONS;

	try {
		const stored = localStorage.getItem(RANDOMIZE_SETTINGS_KEY);
		if (!stored) return DEFAULT_RANDOMIZE_OPTIONS;

		const parsed = JSON.parse(stored);

		// Validate and return with defaults for any missing/invalid fields
		return {
			inversion:
				typeof parsed.inversion === 'boolean'
					? parsed.inversion
					: DEFAULT_RANDOMIZE_OPTIONS.inversion,
			voicing:
				typeof parsed.voicing === 'boolean' ? parsed.voicing : DEFAULT_RANDOMIZE_OPTIONS.voicing,
			octave: typeof parsed.octave === 'boolean' ? parsed.octave : DEFAULT_RANDOMIZE_OPTIONS.octave,
			quality:
				typeof parsed.quality === 'boolean' ? parsed.quality : DEFAULT_RANDOMIZE_OPTIONS.quality
		};
	} catch {
		return DEFAULT_RANDOMIZE_OPTIONS;
	}
}

/**
 * Save randomize settings to localStorage
 */
export function saveRandomizeSettings(options: RandomizeOptions): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(RANDOMIZE_SETTINGS_KEY, JSON.stringify(options));
}
