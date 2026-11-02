import { CHORD_DURATIONS } from './constants';

const BEATS_PER_BAR = 4;
const EIGHTHS_PER_BAR = 8;

/**
 * Number of eighth notes in each supported duration. CHORD_DURATIONS is ordered from one eighth
 * through sixteen, so the length is the index + 1. '1n' is a legacy whole-note alias.
 */
const DURATION_EIGHTHS: Record<string, number> = {
	...Object.fromEntries(CHORD_DURATIONS.map((duration, index) => [duration, index + 1])),
	'1n': EIGHTHS_PER_BAR
};

/**
 * Length of a supported duration in eighth notes. Unknown values fall back to one bar
 * for legacy data safety.
 * @param duration - Supported duration notation (e.g. '2n', '1m')
 * @returns Number of eighth notes
 */
export function durationToEighths(duration: string): number {
	return DURATION_EIGHTHS[duration] ?? EIGHTHS_PER_BAR;
}

/**
 * Convert the supported duration vocabulary to milliseconds at a given tempo.
 * @param duration - Supported duration notation (e.g. '2n', '1m')
 * @param bpm - Tempo the duration should be measured against
 * @returns Duration in milliseconds
 */
export function durationToMs(duration: string, bpm: number): number {
	const eighthNoteMs = ((60 / bpm) * 1000 * BEATS_PER_BAR) / EIGHTHS_PER_BAR;
	return durationToEighths(duration) * eighthNoteMs;
}
