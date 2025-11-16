import { describe, it, expect } from 'vitest';
import {
	getScaleNotes,
	isRootInScale,
	isQualityValidForScaleDegree,
	getValidQualitiesForRoot
} from '$lib/utils/scale-helper';
import type { ChordQuality } from '$lib/utils/theory-engine/types';

describe('scale-helper', () => {
	describe('getScaleNotes', () => {
		it('should return notes for C major', () => {
			const notes = getScaleNotes('C', 'major');
			expect(notes).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
		});

		it('should return notes for D minor', () => {
			const notes = getScaleNotes('D', 'minor');
			expect(notes).toEqual(['D', 'E', 'F', 'G', 'A', 'Bb', 'C']);
		});

		it('should return notes for E dorian', () => {
			const notes = getScaleNotes('E', 'dorian');
			expect(notes).toEqual(['E', 'F#', 'G', 'A', 'B', 'C#', 'D']);
		});

		it('should return notes for F lydian', () => {
			const notes = getScaleNotes('F', 'lydian');
			expect(notes).toEqual(['F', 'G', 'A', 'B', 'C', 'D', 'E']);
		});

		it('should return empty array for invalid scale', () => {
			const notes = getScaleNotes('X', 'invalid');
			expect(notes).toEqual([]);
		});
	});

	describe('isRootInScale', () => {
		const cMajorNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

		it('should return true for C (60) in C major', () => {
			expect(isRootInScale(60, cMajorNotes)).toBe(true);
		});

		it('should return true for D (62) in C major', () => {
			expect(isRootInScale(62, cMajorNotes)).toBe(true);
		});

		it('should return false for C# (61) in C major', () => {
			expect(isRootInScale(61, cMajorNotes)).toBe(false);
		});

		it('should return false for D# (63) in C major', () => {
			expect(isRootInScale(63, cMajorNotes)).toBe(false);
		});

		it('should return true for all notes when no scale is selected', () => {
			expect(isRootInScale(60, [])).toBe(true);
			expect(isRootInScale(61, [])).toBe(true);
		});

		it('should handle different octaves correctly', () => {
			expect(isRootInScale(48, cMajorNotes)).toBe(true); // C3
			expect(isRootInScale(72, cMajorNotes)).toBe(true); // C5
		});
	});

	describe('isQualityValidForScaleDegree', () => {
		const cMajorNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

		it('should return true for C major chord in C major scale', () => {
			expect(isQualityValidForScaleDegree(60, '' as ChordQuality, cMajorNotes)).toBe(true);
		});

		it('should return false for C minor chord in C major scale', () => {
			expect(isQualityValidForScaleDegree(60, 'm' as ChordQuality, cMajorNotes)).toBe(false);
		});

		it('should return true for D minor chord in C major scale', () => {
			expect(isQualityValidForScaleDegree(62, 'm' as ChordQuality, cMajorNotes)).toBe(true);
		});

		it('should return true for E minor chord in C major scale', () => {
			expect(isQualityValidForScaleDegree(64, 'm' as ChordQuality, cMajorNotes)).toBe(true);
		});

		it('should return true for F major chord in C major scale', () => {
			expect(isQualityValidForScaleDegree(65, '' as ChordQuality, cMajorNotes)).toBe(true);
		});

		it('should return true for G major chord in C major scale', () => {
			expect(isQualityValidForScaleDegree(67, '' as ChordQuality, cMajorNotes)).toBe(true);
		});

		it('should return true for A minor chord in C major scale', () => {
			expect(isQualityValidForScaleDegree(69, 'm' as ChordQuality, cMajorNotes)).toBe(true);
		});

		it('should return true for Cmaj7 chord in C major scale', () => {
			expect(isQualityValidForScaleDegree(60, 'maj7' as ChordQuality, cMajorNotes)).toBe(true);
		});

		it('should return false for C7 chord in C major scale (has Bb)', () => {
			expect(isQualityValidForScaleDegree(60, '7' as ChordQuality, cMajorNotes)).toBe(false);
		});

		it('should return true for all qualities when no scale is selected', () => {
			expect(isQualityValidForScaleDegree(60, '' as ChordQuality, [])).toBe(true);
			expect(isQualityValidForScaleDegree(60, 'm' as ChordQuality, [])).toBe(true);
		});

		it('should return false for root not in scale', () => {
			expect(isQualityValidForScaleDegree(61, '' as ChordQuality, cMajorNotes)).toBe(false);
		});
	});

	describe('getValidQualitiesForRoot', () => {
		const cMajorNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

		it('should return only diatonic qualities for C in C major', () => {
			const qualities = getValidQualitiesForRoot(60, cMajorNotes);

			// Should include major triad and major-based chords
			expect(qualities).toContain('' as ChordQuality); // Major
			expect(qualities).toContain('maj7' as ChordQuality);
			expect(qualities).toContain('6' as ChordQuality);

			// Should NOT include minor or chords with out-of-scale notes
			expect(qualities).not.toContain('m' as ChordQuality);
			expect(qualities).not.toContain('7' as ChordQuality); // Has Bb
		});

		it('should return only diatonic qualities for D in C major', () => {
			const qualities = getValidQualitiesForRoot(62, cMajorNotes);

			// Should include minor triad
			expect(qualities).toContain('m' as ChordQuality);

			// Should NOT include major
			expect(qualities).not.toContain('' as ChordQuality);
		});

		it('should return all qualities when no scale is selected', () => {
			const qualities = getValidQualitiesForRoot(60, []);
			// Should include both major and minor
			expect(qualities).toContain('' as ChordQuality);
			expect(qualities).toContain('m' as ChordQuality);
			expect(qualities.length).toBeGreaterThan(30); // All 37 qualities
		});
	});
});
