import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MidiWriter from 'midi-writer-js';
import { exportToMIDI } from '$lib/utils/midi-export';
import { CHORD_DURATIONS, type Chord } from '$lib/utils/theory-engine';

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

/** Run an export and return the bytes of the .mid file it built */
function exportBytes(progression: (Chord | null)[]): number[] {
	const buildFile = vi.spyOn(MidiWriter.Writer.prototype, 'buildFile');
	exportToMIDI(progression, 120);
	const bytes = buildFile.mock.results[0].value as Uint8Array;
	buildFile.mockRestore();
	return Array.from(bytes);
}

describe('exportToMIDI', () => {
	beforeEach(() => {
		vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('writes every supported duration and a rest exactly as before', () => {
		const progression = [...CHORD_DURATIONS.map(chord), null];
		expect(exportBytes(progression)).toMatchSnapshot();
	});

	it('writes a whole bar for a legacy or unknown duration', () => {
		expect(exportBytes([chord('1n')])).toEqual(exportBytes([chord('1m')]));
		expect(exportBytes([chord('3m')])).toEqual(exportBytes([chord('1m')]));
	});

	it('writes nothing for an all-rest progression', () => {
		const buildFile = vi.spyOn(MidiWriter.Writer.prototype, 'buildFile');
		exportToMIDI([null, null]);
		expect(buildFile).not.toHaveBeenCalled();
	});
});
