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
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67]); // C4, E4, G4
		});

		it('should return correct notes for C minor triad', () => {
			const chord: Chord = {
				root: 60,
				quality: 'm',
				inversion: 0,
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 63, 67]); // C4, Eb4, G4
		});

		it('should return correct notes for C diminished triad', () => {
			const chord: Chord = {
				root: 60,
				quality: 'dim',
				inversion: 0,
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 63, 66]); // C4, Eb4, Gb4
		});

		it('should return correct notes for C augmented triad', () => {
			const chord: Chord = {
				root: 60,
				quality: 'aug',
				inversion: 0,
				voicing: 'close',
				octave: 0
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
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 71]); // C4, E4, G4, B4
		});

		it('should return correct notes for C7 (dominant)', () => {
			const chord: Chord = {
				root: 60,
				quality: '7',
				inversion: 0,
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 70]); // C4, E4, G4, Bb4
		});

		it('should return correct notes for Cm7', () => {
			const chord: Chord = {
				root: 60,
				quality: 'm7',
				inversion: 0,
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 63, 67, 70]); // C4, Eb4, G4, Bb4
		});

		it('should return correct notes for Cm7b5 (half-diminished)', () => {
			const chord: Chord = {
				root: 60,
				quality: 'm7b5',
				inversion: 0,
				voicing: 'close',
				octave: 0
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
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([64, 67, 72]); // E4, G4, C5
		});

		it('should return correct notes for C major second inversion', () => {
			const chord: Chord = {
				root: 60,
				quality: '',
				inversion: 2,
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([67, 72, 76]); // G4, C5, E5
		});

		it('should return correct notes for Cmaj7 third inversion', () => {
			const chord: Chord = {
				root: 60,
				quality: 'maj7',
				inversion: 3,
				voicing: 'close',
				octave: 0
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
				voicing: 'drop2',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([55, 60, 64, 71]); // G3, C4, E4, B4
		});

		it('should apply open voicing correctly', () => {
			const chord: Chord = {
				root: 60,
				quality: 'maj7',
				inversion: 0,
				voicing: 'open',
				octave: 0
			};
			const result = getChordNotes(chord);
			// maj7: [0,4,7,11] → open: bass=0, middle=[4,7]→[16,19], soprano=11 → [0,11,16,19]
			// Add root 60: [60, 71, 76, 79]
			expect(result).toEqual([60, 71, 76, 79]); // C4, B4, E5, G5 (sorted)
		});
	});

	describe('extended chords', () => {
		it('should return correct notes for Cmaj9', () => {
			const chord: Chord = {
				root: 60,
				quality: 'maj9',
				inversion: 0,
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 71, 74]); // C4, E4, G4, B4, D5
		});

		it('should return correct notes for C9 (dominant 9th)', () => {
			const chord: Chord = {
				root: 60,
				quality: '9',
				inversion: 0,
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 70, 74]); // C4, E4, G4, Bb4, D5
		});

		it('should return correct notes for C13', () => {
			const chord: Chord = {
				root: 60,
				quality: '13',
				inversion: 0,
				voicing: 'close',
				octave: 0
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
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 74]); // C4, E4, G4, D5 (no 7th!)
		});

		it('should return correct notes for Cmadd9', () => {
			const chord: Chord = {
				root: 60,
				quality: 'madd9',
				inversion: 0,
				voicing: 'close',
				octave: 0
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
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 70, 75]); // C4, E4, G4, Bb4, D#5
		});

		it('should return correct notes for C7b9', () => {
			const chord: Chord = {
				root: 60,
				quality: '7b9',
				inversion: 0,
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([60, 64, 67, 70, 73]); // C4, E4, G4, Bb4, Db5
		});

		it('should return correct notes for C7#11 (Lydian dominant)', () => {
			const chord: Chord = {
				root: 60,
				quality: '7#11',
				inversion: 0,
				voicing: 'close',
				octave: 0
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
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([62, 65, 69, 72]); // D4, F4, A4, C5
		});

		it('should work with F# root (66)', () => {
			const chord: Chord = {
				root: 66,
				quality: 'maj7',
				inversion: 0,
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			expect(result).toEqual([66, 70, 73, 77]); // F#4, A#4, C#5, F5
		});

		it('should work with low root (48 = C3)', () => {
			const chord: Chord = {
				root: 48,
				quality: '',
				inversion: 0,
				voicing: 'close',
				octave: 0
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
				voicing: 'drop2',
				octave: 0
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
				voicing: 'drop2',
				octave: 0
			};
			const result = getChordNotes(chord);
			// D9 intervals: [0, 4, 7, 10, 14]
			// Second inversion: [7, 10, 14, 12, 16]
			// Drop2 voicing: drop second-highest note (14) down an octave
			//              Sorted: [7, 10, 12, 14, 16], second-highest is 14
			//              After drop: [7, 10, 12, 2, 16] sorted = [2, 7, 10, 12, 16]
			// Add root 62: [64, 69, 72, 74, 78]
			expect(result).toEqual([64, 69, 72, 74, 78]);
		});
	});

	describe('octave transposition', () => {
		it('should transpose chord up one octave (octave: 1)', () => {
			const chord: Chord = {
				root: 60,
				quality: '',
				inversion: 0,
				voicing: 'close',
				octave: 1
			};
			const result = getChordNotes(chord);
			// C major: [60, 64, 67] + 12 = [72, 76, 79]
			expect(result).toEqual([72, 76, 79]); // C5, E5, G5
		});

		it('should transpose chord down one octave (octave: -1)', () => {
			const chord: Chord = {
				root: 60,
				quality: '',
				inversion: 0,
				voicing: 'close',
				octave: -1
			};
			const result = getChordNotes(chord);
			// C major: [60, 64, 67] - 12 = [48, 52, 55]
			expect(result).toEqual([48, 52, 55]); // C3, E3, G3
		});

		it('should transpose chord up two octaves (octave: 2)', () => {
			const chord: Chord = {
				root: 60,
				quality: '',
				inversion: 0,
				voicing: 'close',
				octave: 2
			};
			const result = getChordNotes(chord);
			// C major: [60, 64, 67] + 24 = [84, 88, 91]
			expect(result).toEqual([84, 88, 91]); // C6, E6, G6
		});

		it('should transpose chord down two octaves (octave: -2)', () => {
			const chord: Chord = {
				root: 60,
				quality: '',
				inversion: 0,
				voicing: 'close',
				octave: -2
			};
			const result = getChordNotes(chord);
			// C major: [60, 64, 67] - 24 = [36, 40, 43]
			expect(result).toEqual([36, 40, 43]); // C2, E2, G2
		});

		it('should handle octave with inversion', () => {
			const chord: Chord = {
				root: 60,
				quality: 'maj7',
				inversion: 1,
				voicing: 'close',
				octave: 1
			};
			const result = getChordNotes(chord);
			// Cmaj7 first inversion: [64, 67, 71, 72] + 12 = [76, 79, 83, 84]
			expect(result).toEqual([76, 79, 83, 84]); // E5, G5, B5, C6
		});

		it('should handle octave with voicing preset', () => {
			const chord: Chord = {
				root: 60,
				quality: 'maj7',
				inversion: 0,
				voicing: 'drop2',
				octave: -1
			};
			const result = getChordNotes(chord);
			// Cmaj7 drop2: [55, 60, 64, 71] - 12 = [43, 48, 52, 59]
			expect(result).toEqual([43, 48, 52, 59]); // G2, C3, E3, B3
		});

		it('should not change notes when octave is 0', () => {
			const chord: Chord = {
				root: 60,
				quality: 'm7',
				inversion: 0,
				voicing: 'close',
				octave: 0
			};
			const result = getChordNotes(chord);
			// Cm7: [60, 63, 67, 70] + 0 = [60, 63, 67, 70]
			expect(result).toEqual([60, 63, 67, 70]); // C4, Eb4, G4, Bb4
		});
	});
});
