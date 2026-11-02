import { describe, it, expect } from 'vitest';
import { CHORD_DURATIONS, durationToEighths, durationToMs } from '$lib/utils/theory-engine';

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
