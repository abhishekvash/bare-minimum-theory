import type { Chord } from './types';

/**
 * Check if a progression has at least one non-null chord
 * @param progression - Array of chord slots (may contain nulls)
 * @returns true if at least one chord exists
 */
export function hasNonNullChords(progression: (Chord | null)[]): boolean {
	return progression.some((c) => c !== null);
}
