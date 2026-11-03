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

export type { Chord, ChordDuration, ChordQuality } from './types';

// ============================================================================
// CONSTANT EXPORTS
// ============================================================================

export { CHORD_DURATIONS, QUALITIES } from './constants';
export { VOICING_PRESETS } from './voicings';

// ============================================================================
// FUNCTION EXPORTS
// ============================================================================

// Core operations
export { getChordNotes } from './chord-operations';

// Display helpers
export { DURATION_LABELS, formatDuration, getChordName, isCustomizedChord } from './display';

// Duration math
export {
	buildLoopTimeline,
	durationToEighths,
	durationToMs,
	eighthNoteMs,
	findSlotProgress
} from './duration';

// Progression helpers
export { hasNonNullChords } from './progression';

// Boundary validation
export { isRenderableChord, parseDraggedChord } from './validation';
