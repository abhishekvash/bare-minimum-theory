/**
 * Voicing Presets
 * Transform chord intervals for different spacings and voicings
 *
 * Note: These functions operate on already-inverted intervals
 */

/**
 * Voicing transformation function type
 * Takes an array of intervals and returns a transformed array
 */
export type VoicingFunction = (notes: number[]) => number[];

/**
 * Available voicing presets for chord spacing
 *
 * Each preset transforms the intervals to create different spacings:
 * - close: Notes as close together as possible
 * - open: Spread middle notes up an octave
 * - drop2: Drop second-highest note down an octave (jazz voicing)
 * - drop3: Drop third-highest note down an octave (wider spread)
 * - wide: Spread each note progressively by octaves
 */
export const VOICING_PRESETS = {
	/**
	 * Close voicing - notes as close together as possible
	 * No transformation applied
	 *
	 * @example
	 * close([0, 4, 7]) // [0, 4, 7]
	 */
	close: (notes: number[]) => [...notes],

	/**
	 * Open voicing - spread middle notes up an octave
	 * Keeps bass and top notes in place
	 *
	 * Best for 4+ note chords to create space in the middle
	 *
	 * @example
	 * open([0, 4, 7, 11]) // [0, 4, 7, 23] - sorted with middle notes moved up
	 */
	open: (notes: number[]) => {
		if (notes.length < 3) return [...notes];
		const sorted = [...notes].sort((a, b) => a - b);
		const bass = sorted[0];
		const soprano = sorted[sorted.length - 1];
		const middle = sorted.slice(1, -1).map((n) => n + 12);
		return [bass, ...middle, soprano].sort((a, b) => a - b);
	},

	/**
	 * Drop 2 voicing - drop the second-highest note down an octave
	 * Common jazz voicing that creates a strong bass interval
	 *
	 * @example
	 * drop2([0, 4, 7, 11]) // [-5, 0, 4, 11]
	 */
	drop2: (notes: number[]) => {
		if (notes.length < 3) return [...notes];
		const sorted = [...notes].sort((a, b) => a - b);
		sorted[sorted.length - 2] -= 12;
		return sorted.sort((a, b) => a - b);
	},

	/**
	 * Drop 3 voicing - drop the third-highest note down an octave
	 * Creates wider spread than drop2
	 *
	 * Best for 4+ note chords
	 *
	 * @example
	 * drop3([0, 4, 7, 11]) // [-8, 0, 7, 11]
	 */
	drop3: (notes: number[]) => {
		if (notes.length < 4) return [...notes];
		const sorted = [...notes].sort((a, b) => a - b);
		sorted[sorted.length - 3] -= 12;
		return sorted.sort((a, b) => a - b);
	},

	/**
	 * Wide voicing - spread each note progressively higher
	 * Each note goes up by (index * octave)
	 *
	 * Creates maximum separation between notes
	 *
	 * @example
	 * wide([0, 4, 7]) // [0, 16, 26] - each note spread by an octave
	 */
	wide: (notes: number[]) => {
		return notes.map((n, i) => n + i * 12);
	}
} as const;
