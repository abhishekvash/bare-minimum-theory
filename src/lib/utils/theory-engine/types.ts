/**
 * Type Definitions for Music Theory Engine
 */

import type { QUALITIES } from './constants';
import type { VOICING_PRESETS } from './voicings';

/**
 * Chord quality types (interval patterns)
 * '' = Major triad
 */
export type ChordQuality = keyof typeof QUALITIES;

/**
 * Available voicing presets for chord spacing
 */
export type VoicingPreset = keyof typeof VOICING_PRESETS;

/**
 * Chord instance with all properties
 */
export type Chord = {
	/** MIDI note number (60 = C4) */
	root: number;
	/** Chord quality/flavor */
	quality: ChordQuality;
	/** Inversion number (0 = root position, 1 = first inversion, etc.) */
	inversion: number;
	/** Voicing preset for spacing */
	voicing: VoicingPreset;
};
