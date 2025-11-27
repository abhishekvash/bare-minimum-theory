/**
 * Music Theory Constants
 * Core data structures for notes, chord qualities, and voicing presets
 */

// ============================================================================
// NOTE SYSTEM
// ============================================================================

/**
 * Chromatic note names (12-tone equal temperament)
 * Index corresponds to MIDI note number % 12
 */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// ============================================================================
// CHORD QUALITIES
// ============================================================================

/**
 * Chord quality definitions as interval arrays (semitones from root)
 * All intervals are 0-indexed (root = 0)
 *
 * Example: [0, 4, 7] = root, major third, perfect fifth
 *
 * The key names are used as display suffixes (e.g., 'maj7' displays as 'Cmaj7')
 */
export const QUALITIES = {
	// Triads
	'': [0, 4, 7], // Major triad
	m: [0, 3, 7], // Minor triad
	dim: [0, 3, 6], // Diminished triad
	aug: [0, 4, 8], // Augmented triad
	sus4: [0, 5, 7], // Suspended 4th
	sus2: [0, 2, 7], // Suspended 2nd
	'5': [0, 7], // Power chord (perfect 5th only)

	// Seventh chords
	maj7: [0, 4, 7, 11], // Major 7th
	'7': [0, 4, 7, 10], // Dominant 7th
	m7: [0, 3, 7, 10], // Minor 7th
	mMaj7: [0, 3, 7, 11], // Minor major 7th
	dim7: [0, 3, 6, 9], // Diminished 7th (fully diminished)
	m7b5: [0, 3, 6, 10], // Half-diminished 7th (minor 7 flat 5)
	augMaj7: [0, 4, 8, 11], // Augmented major 7th
	aug7: [0, 4, 8, 10], // Augmented 7th

	// Sixth chords
	'6': [0, 4, 7, 9], // Major 6th
	m6: [0, 3, 7, 9], // Minor 6th

	// Add chords (no 7th)
	add9: [0, 4, 7, 14], // Major add 9
	madd9: [0, 3, 7, 14], // Minor add 9
	add11: [0, 4, 7, 17], // Major add 11
	add13: [0, 4, 7, 21], // Major add 13

	// Ninth chords
	maj9: [0, 4, 7, 11, 14], // Major 9th
	'9': [0, 4, 7, 10, 14], // Dominant 9th
	m9: [0, 3, 7, 10, 14], // Minor 9th
	mMaj9: [0, 3, 7, 11, 14], // Minor major 9th

	// Altered dominants
	'7b9': [0, 4, 7, 10, 13], // Dominant 7 flat 9
	'7#9': [0, 4, 7, 10, 15], // Dominant 7 sharp 9 (Hendrix chord)
	'7b5': [0, 4, 6, 10], // Dominant 7 flat 5
	'7#5': [0, 4, 8, 10], // Dominant 7 sharp 5
	'7#11': [0, 4, 7, 10, 14, 18], // Dominant 7 sharp 11 (Lydian dominant)

	// Eleventh chords
	maj11: [0, 4, 7, 11, 14, 17], // Major 11th
	'11': [0, 4, 7, 10, 14, 17], // Dominant 11th
	m11: [0, 3, 7, 10, 14, 17], // Minor 11th

	// Thirteenth chords
	maj13: [0, 4, 7, 11, 14, 21], // Major 13th
	'13': [0, 4, 7, 10, 14, 21], // Dominant 13th
	m13: [0, 3, 7, 10, 14, 21] // Minor 13th
} as const;

/**
 * Display order for chord qualities (research-backed popularity)
 * JavaScript Object.keys() reorders numeric strings, so we need explicit ordering
 */
export const QUALITY_ORDER = [
	'',
	'm',
	'sus4',
	'sus2',
	'5', // Most common
	'7',
	'maj7',
	'm7', // Jazz big three
	'6',
	'm6', // Sixth chords
	'9',
	'maj9',
	'm9', // Ninth chords
	'add9',
	'madd9', // Add chords
	'dim',
	'aug',
	'dim7',
	'm7b5', // Color chords
	'7#9',
	'7b9',
	'7#5',
	'7b5', // Altered dominants
	'11',
	'm11',
	'maj11',
	'13',
	'm13',
	'maj13', // Advanced extensions
	'7#11',
	'mMaj7',
	'mMaj9',
	'augMaj7',
	'aug7',
	'add11',
	'add13' // Complex alterations
] as const;

// ============================================================================
// SCALES
// ============================================================================

/**
 * Scale modes in order of popularity
 * Includes minor variants (harmonic/melodic) for advanced users
 */
export const MODES = [
	'major',
	'minor',
	'harmonic minor',
	'melodic minor',
	'dorian',
	'phrygian',
	'lydian',
	'mixolydian',
	'locrian'
] as const;
