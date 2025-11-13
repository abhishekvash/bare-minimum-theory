/**
 * Theory Engine
 * Music theory utilities for Bare Minimum Theory
 *
 * This is the main entry point for the theory engine.
 * Import everything you need from here:
 *
 * @example
 * import { getChordNotes, getChordName, QUALITIES, type Chord } from '$lib/utils/theory-engine';
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type { Chord, ChordQuality, VoicingPreset } from './types';
export type { VoicingFunction } from './voicings';

// ============================================================================
// CONSTANT EXPORTS
// ============================================================================

export { NOTE_NAMES, QUALITIES } from './constants';
export { VOICING_PRESETS } from './voicings';

// ============================================================================
// FUNCTION EXPORTS
// ============================================================================

// Core operations
export { applyInversion } from './inversions';
export { getChordNotes } from './chord-operations';

// Display helpers
export { getChordName, getChordTooltip } from './display';
