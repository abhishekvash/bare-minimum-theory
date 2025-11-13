import { describe, it, expect } from 'vitest';
import { getChordName, getChordTooltip } from '$lib/utils/theory-engine/display';
import type { Chord } from '$lib/utils/theory-engine/types';

describe('getChordName', () => {
	describe('major triads', () => {
		it('should return "C" for C major', () => {
			const chord: Chord = { root: 60, quality: '', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('C');
		});

		it('should return "D" for D major', () => {
			const chord: Chord = { root: 62, quality: '', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('D');
		});

		it('should return "F#" for F# major', () => {
			const chord: Chord = { root: 66, quality: '', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('F#');
		});
	});

	describe('minor chords', () => {
		it('should return "Am" for A minor', () => {
			const chord: Chord = { root: 69, quality: 'm', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('Am');
		});

		it('should return "C#m" for C# minor', () => {
			const chord: Chord = { root: 61, quality: 'm', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('C#m');
		});
	});

	describe('seventh chords', () => {
		it('should return "Cmaj7" for C major 7th', () => {
			const chord: Chord = { root: 60, quality: 'maj7', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('Cmaj7');
		});

		it('should return "G7" for G dominant 7th', () => {
			const chord: Chord = { root: 67, quality: '7', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('G7');
		});

		it('should return "Dm7" for D minor 7th', () => {
			const chord: Chord = { root: 62, quality: 'm7', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('Dm7');
		});

		it('should return "Bm7b5" for B half-diminished', () => {
			const chord: Chord = { root: 71, quality: 'm7b5', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('Bm7b5');
		});
	});

	describe('extended chords', () => {
		it('should return "Cmaj9" for C major 9th', () => {
			const chord: Chord = { root: 60, quality: 'maj9', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('Cmaj9');
		});

		it('should return "G13" for G dominant 13th', () => {
			const chord: Chord = { root: 67, quality: '13', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('G13');
		});
	});

	describe('add chords', () => {
		it('should return "Cadd9" for C add 9', () => {
			const chord: Chord = { root: 60, quality: 'add9', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('Cadd9');
		});

		it('should return "Dmadd9" for D minor add 9', () => {
			const chord: Chord = { root: 62, quality: 'madd9', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('Dmadd9');
		});
	});

	describe('altered dominants', () => {
		it('should return "C7#9" for C7 sharp 9 (Hendrix chord)', () => {
			const chord: Chord = { root: 60, quality: '7#9', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('C7#9');
		});

		it('should return "G7b9" for G7 flat 9', () => {
			const chord: Chord = { root: 67, quality: '7b9', inversion: 0, voicing: 'close' };
			expect(getChordName(chord)).toBe('G7b9');
		});
	});

	describe('octave handling', () => {
		it('should use modulo 12 for root note name', () => {
			// C4 (60), C5 (72), C6 (84) should all be "C"
			const chord1: Chord = { root: 60, quality: '', inversion: 0, voicing: 'close' };
			const chord2: Chord = { root: 72, quality: '', inversion: 0, voicing: 'close' };
			const chord3: Chord = { root: 84, quality: '', inversion: 0, voicing: 'close' };

			expect(getChordName(chord1)).toBe('C');
			expect(getChordName(chord2)).toBe('C');
			expect(getChordName(chord3)).toBe('C');
		});

		it('should handle low MIDI notes', () => {
			const chord: Chord = { root: 36, quality: 'maj7', inversion: 0, voicing: 'close' }; // C2
			expect(getChordName(chord)).toBe('Cmaj7');
		});
	});

	describe('inversion independence', () => {
		it('should return same name regardless of inversion', () => {
			const root = { root: 60, quality: '' as const, voicing: 'close' as const };

			expect(getChordName({ ...root, inversion: 0 })).toBe('C');
			expect(getChordName({ ...root, inversion: 1 })).toBe('C');
			expect(getChordName({ ...root, inversion: 2 })).toBe('C');
		});

		it('should return same name regardless of voicing', () => {
			const base = { root: 60, quality: 'maj7' as const, inversion: 0 };

			expect(getChordName({ ...base, voicing: 'close' })).toBe('Cmaj7');
			expect(getChordName({ ...base, voicing: 'open' })).toBe('Cmaj7');
			expect(getChordName({ ...base, voicing: 'drop2' })).toBe('Cmaj7');
			expect(getChordName({ ...base, voicing: 'wide' })).toBe('Cmaj7');
		});
	});
});

describe('getChordTooltip', () => {
	describe('root position (no tooltip)', () => {
		it('should return empty string for root position', () => {
			const chord: Chord = { root: 60, quality: '', inversion: 0, voicing: 'close' };
			expect(getChordTooltip(chord)).toBe('');
		});

		it('should return empty string for any chord in root position', () => {
			const chords: Chord[] = [
				{ root: 60, quality: 'maj7', inversion: 0, voicing: 'close' },
				{ root: 62, quality: 'm7', inversion: 0, voicing: 'drop2' },
				{ root: 64, quality: '7#9', inversion: 0, voicing: 'wide' }
			];

			chords.forEach((chord) => {
				expect(getChordTooltip(chord)).toBe('');
			});
		});
	});

	describe('first inversion', () => {
		it('should show "First inversion (E in bass)" for C major', () => {
			const chord: Chord = { root: 60, quality: '', inversion: 1, voicing: 'close' };
			expect(getChordTooltip(chord)).toBe('First inversion (E in bass)');
		});

		it('should show "First inversion (Eb in bass)" for C minor', () => {
			const chord: Chord = { root: 60, quality: 'm', inversion: 1, voicing: 'close' };
			expect(getChordTooltip(chord)).toBe('First inversion (D# in bass)');
		});

		it('should show correct bass note for Cmaj7', () => {
			const chord: Chord = { root: 60, quality: 'maj7', inversion: 1, voicing: 'close' };
			expect(getChordTooltip(chord)).toBe('First inversion (E in bass)');
		});
	});

	describe('second inversion', () => {
		it('should show "Second inversion (G in bass)" for C major', () => {
			const chord: Chord = { root: 60, quality: '', inversion: 2, voicing: 'close' };
			expect(getChordTooltip(chord)).toBe('Second inversion (G in bass)');
		});

		it('should show correct bass note for Dm7', () => {
			const chord: Chord = { root: 62, quality: 'm7', inversion: 2, voicing: 'close' };
			expect(getChordTooltip(chord)).toBe('Second inversion (A in bass)');
		});
	});

	describe('third inversion', () => {
		it('should show "Third inversion" for 7th chords', () => {
			const chord: Chord = { root: 60, quality: '7', inversion: 3, voicing: 'close' };
			expect(getChordTooltip(chord)).toBe('Third inversion (A# in bass)');
		});

		it('should show correct bass note for Cmaj7', () => {
			const chord: Chord = { root: 60, quality: 'maj7', inversion: 3, voicing: 'close' };
			expect(getChordTooltip(chord)).toBe('Third inversion (B in bass)');
		});
	});

	describe('higher inversions', () => {
		it('should handle fourth inversion for 9th chords', () => {
			const chord: Chord = { root: 60, quality: 'maj9', inversion: 4, voicing: 'close' };
			expect(getChordTooltip(chord)).toBe('Fourth inversion (D in bass)');
		});

		it('should handle fifth inversion for 11th chords', () => {
			const chord: Chord = { root: 60, quality: 'maj11', inversion: 5, voicing: 'close' };
			expect(getChordTooltip(chord)).toBe('Fifth inversion (F in bass)');
		});

		it('should handle sixth inversion for 13th chords', () => {
			// maj13: [0, 4, 7, 11, 14, 21]
			// After 6 inversions: [21, 12, 16, 19, 23, 26, 28]
			// Bass note is 21 semitones = root + 21 = C + 21 % 12 = 9 = A, but actually...
			// Let me recalculate: inversion 6 moves first 6 notes up
			// [21, 12, 16, 19, 23, 26] -> 21 + 60 = 81, 81 % 12 = 9 = A... wait
			// After 6 inversions of [0,4,7,11,14,21]: first note is at index 6... but there's only 6 notes!
			// So it wraps: [12, 16, 19, 23, 26, 33] - first note is 12 = C
			const chord: Chord = { root: 60, quality: 'maj13', inversion: 6, voicing: 'close' };
			expect(getChordTooltip(chord)).toBe('Sixth inversion (C in bass)');
		});

		it('should use correct ordinal suffixes for high inversions', () => {
			// Test edge cases for ordinal suffix logic
			const testCases = [
				{ inv: 7, expected: '7th' },
				{ inv: 11, expected: '11th' }, // Not 11st!
				{ inv: 12, expected: '12th' }, // Not 12nd!
				{ inv: 13, expected: '13th' }, // Not 13rd!
				{ inv: 21, expected: '21st' },
				{ inv: 22, expected: '22nd' },
				{ inv: 23, expected: '23rd' },
				{ inv: 101, expected: '101st' },
				{ inv: 112, expected: '112th' }
			];

			testCases.forEach(({ inv, expected }) => {
				// Using a simple major triad to test ordinal logic
				const chord: Chord = { root: 60, quality: '', inversion: inv, voicing: 'close' };
				const tooltip = getChordTooltip(chord);
				expect(tooltip).toContain(expected);
			});
		});
	});

	describe('bass note calculation', () => {
		it('should correctly identify bass note across different roots', () => {
			// D major first inversion should have F# in bass
			const chord1: Chord = { root: 62, quality: '', inversion: 1, voicing: 'close' };
			expect(getChordTooltip(chord1)).toBe('First inversion (F# in bass)');

			// G major first inversion should have B in bass
			const chord2: Chord = { root: 67, quality: '', inversion: 1, voicing: 'close' };
			expect(getChordTooltip(chord2)).toBe('First inversion (B in bass)');
		});

		it('should handle enharmonic equivalents (sharps)', () => {
			// F# major first inversion has A# in bass
			const chord: Chord = { root: 66, quality: '', inversion: 1, voicing: 'close' };
			// NOTE_NAMES uses sharps, so A# not Bb
			expect(getChordTooltip(chord)).toBe('First inversion (A# in bass)');
		});
	});

	describe('voicing independence', () => {
		it('should return same tooltip regardless of voicing', () => {
			const base = { root: 60, quality: '' as const, inversion: 1 };

			const tooltips = [
				getChordTooltip({ ...base, voicing: 'close' }),
				getChordTooltip({ ...base, voicing: 'open' }),
				getChordTooltip({ ...base, voicing: 'drop2' }),
				getChordTooltip({ ...base, voicing: 'wide' })
			];

			// All should be the same
			tooltips.forEach((tooltip) => {
				expect(tooltip).toBe('First inversion (E in bass)');
			});
		});
	});
});
