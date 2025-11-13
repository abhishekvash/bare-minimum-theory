/**
 * Chord Inversion Logic
 * Handles rotation of chord intervals and octave displacement
 */

/**
 * Apply inversion to a chord's interval array
 *
 * Inversions work by rotating the interval array left and pushing
 * moved notes up by an octave (+ 12 semitones)
 *
 * @param intervals - Array of intervals in semitones from root (e.g., [0, 4, 7])
 * @param inversion - Inversion number (0 = root position, 1 = first inversion, etc.)
 * @returns New array with inversion applied
 *
 * @example
 * // Root position (no inversion)
 * applyInversion([0, 4, 7], 0) // [0, 4, 7]
 *
 * @example
 * // First inversion - move root up an octave
 * applyInversion([0, 4, 7], 1) // [4, 7, 12]
 *
 * @example
 * // Second inversion - move root and third up
 * applyInversion([0, 4, 7], 2) // [7, 12, 16]
 *
 * @example
 * // Cmaj7 first inversion
 * applyInversion([0, 4, 7, 11], 1) // [4, 7, 11, 12]
 */
export function applyInversion(intervals: readonly number[], inversion: number): number[] {
	// No inversion needed for root position
	if (inversion === 0) return [...intervals];

	// Create a mutable copy for rotation
	const inverted = [...intervals];

	// Rotate left 'inversion' times, moving each note up an octave
	for (let i = 0; i < inversion; i++) {
		const lowest = inverted.shift()!; // Remove first note
		inverted.push(lowest + 12); // Add it back up an octave
	}

	return inverted;
}
