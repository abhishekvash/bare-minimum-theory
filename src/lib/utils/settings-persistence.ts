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
	if (typeof window === 'undefined') return DEFAULT_PREVIEW_OPTIONS;

	try {
		const stored = localStorage.getItem(PREVIEW_SETTINGS_KEY);
		if (!stored) return DEFAULT_PREVIEW_OPTIONS;

		const parsed = JSON.parse(stored);
		const flag = (key: keyof PreviewOptions) =>
			typeof parsed?.[key] === 'boolean' ? parsed[key] : DEFAULT_PREVIEW_OPTIONS[key];

		return { chained: flag('chained'), onSelect: flag('onSelect'), onSweep: flag('onSweep') };
	} catch {
		return DEFAULT_PREVIEW_OPTIONS;
	}
}

/**
 * Save preview settings to localStorage
 */
export function savePreviewSettings(options: PreviewOptions): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(PREVIEW_SETTINGS_KEY, JSON.stringify(options));
}
