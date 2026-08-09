import { CHORD_DURATIONS, QUALITIES } from './constants';
import type { Chord } from './types';
import { VOICING_PRESETS } from './voicings';

const CHORD_DURATION_SET = new Set<string>(CHORD_DURATIONS);

function isIntegerWithin(value: unknown, min: number, max: number): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Validate an unknown chord at an external data boundary.
 * Every field must belong to the same finite domain used by rendering and playback.
 */
export function isRenderableChord(value: unknown): value is Chord {
	if (!value || typeof value !== 'object') return false;
	const chord = value as Record<string, unknown>;

	if (typeof chord.quality !== 'string' || !Object.hasOwn(QUALITIES, chord.quality)) return false;
	if (typeof chord.voicing !== 'string' || !Object.hasOwn(VOICING_PRESETS, chord.voicing)) {
		return false;
	}
	if (typeof chord.duration !== 'string' || !CHORD_DURATION_SET.has(chord.duration)) return false;

	const intervals = QUALITIES[chord.quality as keyof typeof QUALITIES];
	return (
		isIntegerWithin(chord.root, 0, 127) &&
		isIntegerWithin(chord.inversion, 0, intervals.length - 1) &&
		isIntegerWithin(chord.octave, -2, 2)
	);
}
