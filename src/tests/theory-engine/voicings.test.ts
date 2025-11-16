import { describe, it, expect } from 'vitest';
import { VOICING_PRESETS } from '$lib/utils/theory-engine/voicings';

describe('VOICING_PRESETS', () => {
	describe('close voicing', () => {
		it('should return notes unchanged', () => {
			const notes = [0, 4, 7];
			const result = VOICING_PRESETS.close(notes);
			expect(result).toEqual([0, 4, 7]);
		});

		it('should work with 7th chords', () => {
			const notes = [0, 4, 7, 11];
			const result = VOICING_PRESETS.close(notes);
			expect(result).toEqual([0, 4, 7, 11]);
		});

		it('should work with extended chords', () => {
			const notes = [0, 4, 7, 11, 14];
			const result = VOICING_PRESETS.close(notes);
			expect(result).toEqual([0, 4, 7, 11, 14]);
		});
	});

	describe('open voicing', () => {
		it('should keep bass and top, raise middle notes (sorted)', () => {
			// [0, 4, 7] → bass=0, middle=[4]→[16], soprano=7 → [0, 7, 16] sorted
			const notes = [0, 4, 7];
			const result = VOICING_PRESETS.open(notes);
			expect(result).toEqual([0, 7, 16]);
		});

		it('should work with 7th chords', () => {
			// [0, 4, 7, 11] → bass=0, middle=[4,7]→[16,19], soprano=11 → [0, 11, 16, 19]
			const notes = [0, 4, 7, 11];
			const result = VOICING_PRESETS.open(notes);
			expect(result).toEqual([0, 11, 16, 19]);
		});

		it('should work with 9th chords', () => {
			// [0, 4, 7, 11, 14] → bass=0, middle=[4,7,11]→[16,19,23], soprano=14 → [0, 14, 16, 19, 23]
			const notes = [0, 4, 7, 11, 14];
			const result = VOICING_PRESETS.open(notes);
			expect(result).toEqual([0, 14, 16, 19, 23]);
		});

		it('should handle 2-note chords unchanged', () => {
			const notes = [0, 7];
			const result = VOICING_PRESETS.open(notes);
			expect(result).toEqual([0, 7]);
		});
	});

	describe('drop2 voicing', () => {
		it('should drop second-highest note down an octave', () => {
			// [0, 4, 7] → second-highest is 4 → [-8, 0, 7]
			const notes = [0, 4, 7];
			const result = VOICING_PRESETS.drop2(notes);
			expect(result).toEqual([-8, 0, 7]);
		});

		it('should work with 7th chords', () => {
			// [0, 4, 7, 11] → second-highest is 7 → [-5, 0, 4, 11]
			const notes = [0, 4, 7, 11];
			const result = VOICING_PRESETS.drop2(notes);
			expect(result).toEqual([-5, 0, 4, 11]);
		});

		it('should work with inverted chords', () => {
			// [4, 7, 11, 12] → second-highest is 11 → [-1, 4, 7, 12]
			const notes = [4, 7, 11, 12];
			const result = VOICING_PRESETS.drop2(notes);
			expect(result).toEqual([-1, 4, 7, 12]);
		});

		it('should handle 2-note chords unchanged', () => {
			const notes = [0, 7];
			const result = VOICING_PRESETS.drop2(notes);
			expect(result).toEqual([0, 7]);
		});

		it('should return sorted result', () => {
			const notes = [0, 4, 7, 11];
			const result = VOICING_PRESETS.drop2(notes);
			// Should be sorted ascending
			expect(result).toEqual([...result].sort((a, b) => a - b));
		});
	});

	describe('drop3 voicing', () => {
		it('should drop third-highest note down an octave', () => {
			// [0, 4, 7, 11] → third-highest is 4 → [-8, 0, 7, 11]
			const notes = [0, 4, 7, 11];
			const result = VOICING_PRESETS.drop3(notes);
			expect(result).toEqual([-8, 0, 7, 11]);
		});

		it('should work with 9th chords', () => {
			// [0, 4, 7, 11, 14] → third-highest is 7 → [-5, 0, 4, 11, 14]
			const notes = [0, 4, 7, 11, 14];
			const result = VOICING_PRESETS.drop3(notes);
			expect(result).toEqual([-5, 0, 4, 11, 14]);
		});

		it('should handle chords with less than 4 notes unchanged', () => {
			const notes1 = [0, 7];
			expect(VOICING_PRESETS.drop3(notes1)).toEqual([0, 7]);

			const notes2 = [0, 4, 7];
			expect(VOICING_PRESETS.drop3(notes2)).toEqual([0, 4, 7]);
		});

		it('should return sorted result', () => {
			const notes = [0, 4, 7, 11, 14];
			const result = VOICING_PRESETS.drop3(notes);
			// Should be sorted ascending
			expect(result).toEqual([...result].sort((a, b) => a - b));
		});
	});

	describe('immutability', () => {
		it('should not modify original arrays in close voicing', () => {
			const notes = [0, 4, 7];
			VOICING_PRESETS.close(notes);
			expect(notes).toEqual([0, 4, 7]);
		});

		it('should not modify original arrays in open voicing', () => {
			const notes = [0, 4, 7, 11];
			VOICING_PRESETS.open(notes);
			expect(notes).toEqual([0, 4, 7, 11]);
		});

		it('should not modify original arrays in drop2 voicing', () => {
			const notes = [0, 4, 7, 11];
			VOICING_PRESETS.drop2(notes);
			expect(notes).toEqual([0, 4, 7, 11]);
		});

		it('should not modify original arrays in drop3 voicing', () => {
			const notes = [0, 4, 7, 11, 14];
			VOICING_PRESETS.drop3(notes);
			expect(notes).toEqual([0, 4, 7, 11, 14]);
		});
	});
});
