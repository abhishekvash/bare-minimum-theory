/**
 * Chord Operations
 * Main pipeline for converting chord definitions to playable MIDI notes
 */

import type { Chord } from './types';
import { QUALITIES } from './constants';
import { applyInversion } from './inversions';
import { VOICING_PRESETS } from './voicings';

/**
 * Get the final MIDI note numbers for a chord
 *
 * This is the main pipeline that combines all transformations:
 * 1. Get base intervals from chord quality
 * 2. Apply inversion (rotate intervals, move notes up octave)
 * 3. Apply voicing preset (spacing transformation)
 * 4. Add root offset to get final MIDI note numbers
 *
 * @param chord - The chord definition with root, quality, inversion, and voicing
 * @returns Array of MIDI note numbers ready for playback or export
 *
 * @example
 * // C major triad in root position, close voicing
 * getChordNotes({ root: 60, quality: '', inversion: 0, voicing: 'close' })
 * // Returns: [60, 64, 67] (C4, E4, G4)
 *
 * @example
 * // C major triad in first inversion, close voicing
 * getChordNotes({ root: 60, quality: '', inversion: 1, voicing: 'close' })
 * // Returns: [64, 67, 72] (E4, G4, C5)
 *
 * @example
 * // Cmaj7 in root position, drop2 voicing
 * getChordNotes({ root: 60, quality: 'maj7', inversion: 0, voicing: 'drop2' })
 * // Returns: [55, 60, 64, 71] (G3, C4, E4, B4)
 *
 * @example
 * // Dm9 in root position, wide voicing
 * getChordNotes({ root: 62, quality: 'm9', inversion: 0, voicing: 'wide' })
 * // Returns: [62, 77, 93, 108, 124] (D4, F5, A6, C8, E9)
 */
export function getChordNotes(chord: Chord): number[] {
	// Step 1: Get base intervals from chord quality
	const intervals = QUALITIES[chord.quality];

	// Step 2: Apply inversion
	const inverted = applyInversion(intervals, chord.inversion);

	// Step 3: Apply voicing preset
	const voiced = VOICING_PRESETS[chord.voicing](inverted);

	// Step 4: Add root offset to get final MIDI note numbers
	return voiced.map((interval) => chord.root + interval);
}
