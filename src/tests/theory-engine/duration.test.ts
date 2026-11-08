import { describe, it, expect } from 'vitest';
import {
	CHORD_DURATIONS,
	buildLoopTimeline,
	durationToEighths,
	durationToMs,
	eighthNoteMs,
	findSlotProgress,
	type Chord
} from '#lib/utils/theory-engine/index.ts';

/** Takes any string so tests can feed legacy or unknown durations */
function chord(duration: string): Chord {
	return {
		root: 60,
		quality: 'maj7',
		inversion: 0,
		voicing: 'close',
		duration: duration as Chord['duration'],
		octave: 0
	};
}

describe('duration helpers', () => {
	it('counts eighth notes from one through sixteen in CHORD_DURATIONS order', () => {
		expect(CHORD_DURATIONS.map(durationToEighths)).toEqual(
			Array.from({ length: 16 }, (_, index) => index + 1)
		);
	});

	it('treats the legacy whole-note alias and unknown values as one bar', () => {
		expect(durationToEighths('1n')).toBe(8);
		expect(durationToEighths('3m')).toBe(8);
	});

	it('converts to milliseconds at the given tempo', () => {
		expect(durationToMs('1m', 120)).toBe(2000);
		expect(durationToMs('8n', 120)).toBe(250);
		expect(durationToMs('8n', 300)).toBe(100);
		expect(durationToMs('2m', 60)).toBe(8000);
	});
});

describe('buildLoopTimeline', () => {
	it('lays slots out back to back in eighth notes', () => {
		expect(buildLoopTimeline([chord('1m'), chord('2n'), chord('4n'), chord('4n')])).toEqual({
			offsetsEighths: [0, 8, 12, 14],
			durationsEighths: [8, 4, 2, 2],
			totalEighths: 16
		});
	});

	it('rests for one bar on an empty slot', () => {
		expect(buildLoopTimeline([chord('8n'), null, chord('8n')])).toEqual({
			offsetsEighths: [0, 1, 9],
			durationsEighths: [1, 8, 1],
			totalEighths: 10
		});
	});

	it('treats an unknown duration such as 3m as one bar', () => {
		expect(buildLoopTimeline([chord('3m')]).durationsEighths).toEqual([8]);
	});

	it('is empty for an empty progression', () => {
		expect(buildLoopTimeline([])).toEqual({
			offsetsEighths: [],
			durationsEighths: [],
			totalEighths: 0
		});
	});
});

describe('eighthNoteMs', () => {
	it('matches durationToMs for one eighth', () => {
		expect(eighthNoteMs(120)).toBe(durationToMs('8n', 120));
	});
});

describe('findSlotProgress', () => {
	const offsets = [0, 8, 12];
	const durations = [8, 4, 4];

	it('finds the slot containing the position and the progress through it', () => {
		expect(findSlotProgress(offsets, durations, 0)).toEqual({ chordIndex: 0, progress: 0 });
		expect(findSlotProgress(offsets, durations, 4)).toEqual({ chordIndex: 0, progress: 50 });
		expect(findSlotProgress(offsets, durations, 8)).toEqual({ chordIndex: 1, progress: 0 });
		expect(findSlotProgress(offsets, durations, 15)).toEqual({ chordIndex: 2, progress: 75 });
	});

	it('clamps progress to 100', () => {
		expect(findSlotProgress(offsets, durations, 20)).toEqual({ chordIndex: 2, progress: 100 });
	});

	it('returns null for an empty timeline', () => {
		expect(findSlotProgress([], [], 0)).toBeNull();
	});
});
