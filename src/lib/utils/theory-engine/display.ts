/**
 * Display Helpers
 * Functions for generating human-readable chord names and tooltips
 */

import type { Chord } from './types';
import { NOTE_NAMES, QUALITIES } from './constants';
import { applyInversion } from './inversions';

/**
 * Get the display name for a chord
 *
 * Combines the root note name with the quality suffix
 *
 * @param chord - The chord to get the name for
 * @returns Human-readable chord name (e.g., "Cmaj7", "Am", "F#dim7")
 *
 * @example
 * getChordName({ root: 60, quality: 'maj7', inversion: 0, voicing: 'close' })
 * // Returns: "Cmaj7"
 *
 * @example
 * getChordName({ root: 69, quality: 'm7', inversion: 1, voicing: 'drop2' })
 * // Returns: "Am7"
 *
 * @example
 * getChordName({ root: 66, quality: '', inversion: 0, voicing: 'close' })
 * // Returns: "F#" (major triad, quality is empty string)
 */
export function getChordName(chord: Chord): string {
	const rootName = NOTE_NAMES[chord.root % 12];
	return `${rootName}${chord.quality}`;
}

/**
 * Get the tooltip text for a chord showing inversion details
 *
 * Returns empty string for root position (inversion 0)
 * For inversions, shows the inversion name and bass note
 *
 * @param chord - The chord to get the tooltip for
 * @returns Tooltip text or empty string for root position
 *
 * @example
 * getChordTooltip({ root: 60, quality: 'maj7', inversion: 0, voicing: 'close' })
 * // Returns: "" (root position has no tooltip)
 *
 * @example
 * getChordTooltip({ root: 60, quality: '', inversion: 1, voicing: 'close' })
 * // Returns: "First inversion (E in bass)"
 *
 * @example
 * getChordTooltip({ root: 60, quality: 'maj7', inversion: 2, voicing: 'close' })
 * // Returns: "Second inversion (G in bass)"
 *
 * @example
 * getChordTooltip({ root: 62, quality: 'm7', inversion: 3, voicing: 'close' })
 * // Returns: "Third inversion (C in bass)"
 */
export function getChordTooltip(chord: Chord): string {
	// No tooltip for root position
	if (chord.inversion === 0) return '';

	// Get the intervals for this chord quality
	const intervals = QUALITIES[chord.quality];

	// Apply inversion to find which note is in the bass
	const inverted = applyInversion(intervals, chord.inversion);

	// The first note after inversion is the bass note
	const bassInterval = inverted[0];

	// Calculate the actual bass note (root + interval, wrapped to 0-11)
	const bassNote = NOTE_NAMES[(chord.root + bassInterval) % 12];

	// Inversion names
	const inversionNames = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];

	// Helper to get ordinal suffix
	const getOrdinalSuffix = (n: number): string => {
		const lastDigit = n % 10;
		const lastTwoDigits = n % 100;

		// Special case for 11, 12, 13
		if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return 'th';

		// Regular rules
		if (lastDigit === 1) return 'st';
		if (lastDigit === 2) return 'nd';
		if (lastDigit === 3) return 'rd';
		return 'th';
	};

	const inversionName =
		inversionNames[chord.inversion] || `${chord.inversion}${getOrdinalSuffix(chord.inversion)}`;

	return `${inversionName} inversion (${bassNote} in bass)`;
}
