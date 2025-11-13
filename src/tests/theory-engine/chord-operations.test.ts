import { describe, it, expect } from 'vitest';
import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
import type { Chord } from '$lib/utils/theory-engine/types';

describe('getChordNotes', () => {
	describe('basic triads in root position', () => {
		it('should return correct notes for C major triad', () => {
			const chord: Chord = {
				root: 60, // C4
				quality: '',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67]); // C4, E4, G4
		});

		it('should return correct notes for C minor triad', () => {
			const chord: Chord = {
				root: 60,
				quality: 'm',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 63, 67]); // C4, Eb4, G4
		});

		it('should return correct notes for C diminished triad', () => {
			const chord: Chord = {
				root: 60,
				quality: 'dim',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 63, 66]); // C4, Eb4, Gb4
		});

		it('should return correct notes for C augmented triad', () => {
			const chord: Chord = {
				root: 60,
				quality: 'aug',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 68]); // C4, E4, G#4
		});
	});

	describe('seventh chords in root position', () => {
		it('should return correct notes for Cmaj7', () => {
			const chord: Chord = {
				root: 60,
				quality: 'maj7',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 71]); // C4, E4, G4, B4
		});

		it('should return correct notes for C7 (dominant)', () => {
			const chord: Chord = {
				root: 60,
				quality: '7',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 70]); // C4, E4, G4, Bb4
		});

		it('should return correct notes for Cm7', () => {
			const chord: Chord = {
				root: 60,
				quality: 'm7',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 63, 67, 70]); // C4, Eb4, G4, Bb4
		});

		it('should return correct notes for Cm7b5 (half-diminished)', () => {
			const chord: Chord = {
				root: 60,
				quality: 'm7b5',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 63, 66, 70]); // C4, Eb4, Gb4, Bb4
		});
	});

	describe('inversions', () => {
		it('should return correct notes for C major first inversion', () => {
			const chord: Chord = {
				root: 60,
				quality: '',
				inversion: 1,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([64, 67, 72]); // E4, G4, C5
		});

		it('should return correct notes for C major second inversion', () => {
			const chord: Chord = {
				root: 60,
				quality: '',
				inversion: 2,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([67, 72, 76]); // G4, C5, E5
		});

		it('should return correct notes for Cmaj7 third inversion', () => {
			const chord: Chord = {
				root: 60,
				quality: 'maj7',
				inversion: 3,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([71, 72, 76, 79]); // B4, C5, E5, G5
		});
	});

	describe('voicing presets', () => {
		it('should apply drop2 voicing correctly', () => {
			const chord: Chord = {
				root: 60,
				quality: 'maj7',
				inversion: 0,
				voicing: 'drop2'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([55, 60, 64, 71]); // G3, C4, E4, B4
		});

		it('should apply wide voicing correctly', () => {
			const chord: Chord = {
				root: 60,
				quality: '',
				inversion: 0,
				voicing: 'wide'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 76, 91]); // C4, E5, G6
		});

		it('should apply open voicing correctly', () => {
			const chord: Chord = {
				root: 60,
				quality: 'maj7',
				inversion: 0,
				voicing: 'open'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 76, 79, 71]); // C4, E5, G5, B4
		});
	});

	describe('extended chords', () => {
		it('should return correct notes for Cmaj9', () => {
			const chord: Chord = {
				root: 60,
				quality: 'maj9',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 71, 74]); // C4, E4, G4, B4, D5
		});

		it('should return correct notes for C9 (dominant 9th)', () => {
			const chord: Chord = {
				root: 60,
				quality: '9',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 70, 74]); // C4, E4, G4, Bb4, D5
		});

		it('should return correct notes for C13', () => {
			const chord: Chord = {
				root: 60,
				quality: '13',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 70, 74, 81]); // C4, E4, G4, Bb4, D5, A5
		});
	});

	describe('add chords', () => {
		it('should return correct notes for Cadd9', () => {
			const chord: Chord = {
				root: 60,
				quality: 'add9',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 74]); // C4, E4, G4, D5 (no 7th!)
		});

		it('should return correct notes for Cmadd9', () => {
			const chord: Chord = {
				root: 60,
				quality: 'madd9',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 63, 67, 74]); // C4, Eb4, G4, D5 (no 7th!)
		});
	});

	describe('altered dominants', () => {
		it('should return correct notes for C7#9 (Hendrix chord)', () => {
			const chord: Chord = {
				root: 60,
				quality: '7#9',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 70, 75]); // C4, E4, G4, Bb4, D#5
		});

		it('should return correct notes for C7b9', () => {
			const chord: Chord = {
				root: 60,
				quality: '7b9',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 70, 73]); // C4, E4, G4, Bb4, Db5
		});

		it('should return correct notes for C7#11 (Lydian dominant)', () => {
			const chord: Chord = {
				root: 60,
				quality: '7#11',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 70, 74, 78]); // C4, E4, G4, Bb4, D5, F#5
		});
	});

	describe('different root notes', () => {
		it('should work with D root (62)', () => {
			const chord: Chord = {
				root: 62,
				quality: 'm7',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([62, 65, 69, 72]); // D4, F4, A4, C5
		});

		it('should work with F# root (66)', () => {
			const chord: Chord = {
				root: 66,
				quality: 'maj7',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([66, 70, 73, 77]); // F#4, A#4, C#5, F5
		});

		it('should work with low root (48 = C3)', () => {
			const chord: Chord = {
				root: 48,
				quality: '',
				inversion: 0,
				voicing: 'close'
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([48, 52, 55]); // C3, E3, G3
		});
	});

	describe('complex combinations', () => {
		it('should handle inversion + voicing together', () => {
			const chord: Chord = {
				root: 60,
				quality: 'maj7',
				inversion: 1,
				voicing: 'drop2'
			};
			const result = getChordNotes(chord);
			// First inversion: [4, 7, 11, 12]
			// Drop2 on [4, 7, 11, 12]: drop 11 → [-1, 4, 7, 12]
			// Add root 60: [59, 64, 67, 72]
			expect(result).toEqual([59, 64, 67, 72]); // B3, E4, G4, C5
		});

		it('should handle extended chord with inversion and voicing', () => {
			const chord: Chord = {
				root: 62, // D
				quality: '9',
				inversion: 2,
				voicing: 'wide'
			};
			const result = getChordNotes(chord);
			// D9 intervals: [0, 4, 7, 10, 14]
			// Second inversion: [7, 10, 14, 12, 16]
			// Wide voicing: [7 + 0*12, 10 + 1*12, 14 + 2*12, 12 + 3*12, 16 + 4*12]
			//             = [7, 22, 38, 48, 64]
			// Add root 62: [69, 84, 100, 110, 126]
			expect(result).toEqual([69, 84, 100, 110, 126]);
		});
	});
});
