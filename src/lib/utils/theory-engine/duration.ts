import { CHORD_DURATIONS } from './constants';
import type { Chord } from './types';

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
	return durationToEighths(duration) * eighthNoteMs(bpm);
}

/**
 * Length of one eighth note in milliseconds at a given tempo.
 * @param bpm - Tempo in quarter-note beats per minute
 * @returns Milliseconds per eighth note
 */
export function eighthNoteMs(bpm: number): number {
	return ((60 / bpm) * 1000 * BEATS_PER_BAR) / EIGHTHS_PER_BAR;
}

/**
 * Where every slot of a loop starts and how long it lasts, in eighth notes.
 * Playback adapters scale this to their own units (transport ticks, milliseconds).
 */
export type LoopTimeline = {
	offsetsEighths: number[];
	durationsEighths: number[];
	totalEighths: number;
};

/**
 * Lay a progression out on a loop timeline. Empty slots rest for one bar.
 * @param progression - Slots in playback order
 * @returns Per-slot offsets and durations, plus the loop length
 */
export function buildLoopTimeline(progression: readonly (Chord | null)[]): LoopTimeline {
	let totalEighths = 0;
	const durationsEighths = progression.map((chord) => durationToEighths(chord?.duration ?? '1m'));
	const offsetsEighths = durationsEighths.map((duration) => {
		const start = totalEighths;
		totalEighths += duration;
		return start;
	});
	return { offsetsEighths, durationsEighths, totalEighths };
}

/**
 * Find which slot a loop position falls in and how far through it playback is.
 * Offsets, durations and position must share one unit.
 * @param offsets - Slot start positions, ascending
 * @param durations - Slot lengths
 * @param position - Current position inside the loop
 * @returns Slot index and progress (0-100) through it, or null for an empty timeline
 */
export function findSlotProgress(
	offsets: readonly number[],
	durations: readonly number[],
	position: number
): { chordIndex: number; progress: number } | null {
	if (offsets.length === 0) return null;

	let chordIndex = 0;
	for (let index = 0; index < offsets.length; index++) {
		if (position >= offsets[index]) chordIndex = index;
		else break;
	}

	const progressInChord = (position - offsets[chordIndex]) / durations[chordIndex];
	return { chordIndex, progress: Math.min(100, Math.max(0, progressInChord * 100)) };
}
