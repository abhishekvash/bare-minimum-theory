import { describe, it, expect } from 'vitest';
import { applyInversion } from '$lib/utils/theory-engine/inversions';

describe('applyInversion', () => {
	describe('root position (inversion 0)', () => {
		it('should return unchanged intervals for major triad', () => {
			const intervals = [0, 4, 7];
			const result = applyInversion(intervals, 0);
			expect(result).toEqual([0, 4, 7]);
		});

		it('should return unchanged intervals for 7th chord', () => {
			const intervals = [0, 4, 7, 11];
			const result = applyInversion(intervals, 0);
			expect(result).toEqual([0, 4, 7, 11]);
		});

		it('should not modify the original array', () => {
			const intervals = [0, 4, 7];
			const result = applyInversion(intervals, 0);
			expect(result).not.toBe(intervals); // Different reference
			expect(intervals).toEqual([0, 4, 7]); // Original unchanged
		});
	});

	describe('first inversion', () => {
		it('should invert major triad correctly', () => {
			// C major [C, E, G] → [E, G, C'] → [4, 7, 12]
			const intervals = [0, 4, 7];
			const result = applyInversion(intervals, 1);
			expect(result).toEqual([4, 7, 12]);
		});

		it('should invert minor triad correctly', () => {
			// C minor [C, Eb, G] → [Eb, G, C'] → [3, 7, 12]
			const intervals = [0, 3, 7];
			const result = applyInversion(intervals, 1);
			expect(result).toEqual([3, 7, 12]);
		});

		it('should invert maj7 chord correctly', () => {
			// Cmaj7 [C, E, G, B] → [E, G, B, C'] → [4, 7, 11, 12]
			const intervals = [0, 4, 7, 11];
			const result = applyInversion(intervals, 1);
			expect(result).toEqual([4, 7, 11, 12]);
		});
	});

	describe('second inversion', () => {
		it('should invert major triad correctly', () => {
			// C major [C, E, G] → [G, C', E'] → [7, 12, 16]
			const intervals = [0, 4, 7];
			const result = applyInversion(intervals, 2);
			expect(result).toEqual([7, 12, 16]);
		});

		it('should invert 7th chord correctly', () => {
			// C7 [C, E, G, Bb] → [G, Bb, C', E'] → [7, 10, 12, 16]
			const intervals = [0, 4, 7, 10];
			const result = applyInversion(intervals, 2);
			expect(result).toEqual([7, 10, 12, 16]);
		});
	});

	describe('third inversion', () => {
		it('should invert 7th chord correctly', () => {
			// C7 [C, E, G, Bb] → [Bb, C', E', G'] → [10, 12, 16, 19]
			const intervals = [0, 4, 7, 10];
			const result = applyInversion(intervals, 3);
			expect(result).toEqual([10, 12, 16, 19]);
		});

		it('should invert 9th chord correctly', () => {
			// Cmaj9 [C, E, G, B, D] → [B, D', C', E', G'] → [11, 14, 12, 16, 19]
			const intervals = [0, 4, 7, 11, 14];
			const result = applyInversion(intervals, 3);
			expect(result).toEqual([11, 14, 12, 16, 19]);
		});
	});

	describe('edge cases', () => {
		it('should handle power chord (2 notes)', () => {
			const intervals = [0, 7];
			const result = applyInversion(intervals, 1);
			expect(result).toEqual([7, 12]);
		});

		it('should handle multiple inversions beyond chord size', () => {
			// Inverting a triad 4 times should give us back to root + octaves
			const intervals = [0, 4, 7];
			const result = applyInversion(intervals, 4);
			// After 3 inversions we're back to [0, 4, 7] + 12 each = [12, 16, 19]
			// One more: [16, 19, 24]
			expect(result).toEqual([16, 19, 24]);
		});

		it('should handle complex extended chords', () => {
			// 13th chord inversion
			const intervals = [0, 4, 7, 10, 14, 21];
			const result = applyInversion(intervals, 1);
			expect(result).toEqual([4, 7, 10, 14, 21, 12]);
		});

		it('should not mutate the original intervals array', () => {
			const intervals = [0, 4, 7, 11] as const;
			const result = applyInversion(intervals, 2);
			expect(intervals).toEqual([0, 4, 7, 11]); // Original unchanged
			expect(result).toEqual([7, 11, 12, 16]); // Result is correct
		});
	});
});
