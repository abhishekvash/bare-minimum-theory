import { describe, it, expect } from 'vitest';
import { parseDraggedChord, type Chord } from '#lib/utils/theory-engine/index.ts';

const chord: Chord = {
	root: 60,
	quality: 'maj7',
	inversion: 0,
	voicing: 'close',
	duration: '1m',
	octave: 0
};

describe('parseDraggedChord', () => {
	it('returns the chord for a valid payload', () => {
		expect(parseDraggedChord(JSON.stringify(chord))).toEqual(chord);
	});

	it('returns null for malformed JSON', () => {
		expect(parseDraggedChord('{not json')).toBeNull();
		expect(parseDraggedChord('')).toBeNull();
	});

	it('returns null for JSON that is not a renderable chord', () => {
		expect(parseDraggedChord(JSON.stringify({ ...chord, quality: 'nope' }))).toBeNull();
		expect(parseDraggedChord(JSON.stringify({ ...chord, inversion: 9 }))).toBeNull();
	});

	it('returns null for non-object JSON', () => {
		expect(parseDraggedChord('null')).toBeNull();
		expect(parseDraggedChord('42')).toBeNull();
		expect(parseDraggedChord('"chord"')).toBeNull();
	});
});
