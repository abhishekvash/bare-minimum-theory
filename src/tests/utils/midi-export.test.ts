import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MidiWriter from 'midi-writer-js';
import { exportToMIDI } from '#lib/utils/midi-export.ts';
import { CHORD_DURATIONS, type Chord } from '#lib/utils/theory-engine/index.ts';

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

type TimedEvent = { tick: number; kind: 'on' | 'off' | 'end' };

/** Minimal single-track SMF reader: absolute ticks of note on/off and End of Track */
function readTrackEvents(bytes: number[]): TimedEvent[] {
	let i = 22; // 14-byte MThd chunk + "MTrk" + 4-byte length
	const events: TimedEvent[] = [];
	let tick = 0;
	let status = 0;
	const readVarLen = () => {
		let value = 0;
		let byte: number;
		do {
			byte = bytes[i++];
			value = (value << 7) | (byte & 0x7f);
		} while (byte & 0x80);
		return value;
	};
	while (i < bytes.length) {
		tick += readVarLen();
		if (bytes[i] & 0x80) status = bytes[i++];
		if (status === 0xff) {
			const type = bytes[i++];
			const length = readVarLen();
			i += length;
			if (type === 0x2f) {
				events.push({ tick, kind: 'end' });
				break;
			}
		} else {
			const velocity = bytes[i + 1];
			i += 2;
			const isOn = (status & 0xf0) === 0x90 && velocity > 0;
			events.push({ tick, kind: isOn ? 'on' : 'off' });
		}
	}
	return events;
}

/** First and last tick of each chord, and the track length */
function chordStartsAndLength(bytes: number[]) {
	const events = readTrackEvents(bytes);
	const starts = [...new Set(events.filter((e) => e.kind === 'on').map((e) => e.tick))];
	// A chord sustained through a rest would move its note-off, even with the same starts
	const ends = [...new Set(events.filter((e) => e.kind === 'off').map((e) => e.tick))];
	const end = events.find((e) => e.kind === 'end')?.tick;
	return { starts, ends, end };
}

const BAR = 512; // midi-writer-js: 128 ticks per quarter

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

	it('keeps interior rests as a bar of silence before the next chord', () => {
		const bytes = exportBytes([chord('1m'), null, null, chord('2n')]);
		expect(chordStartsAndLength(bytes)).toEqual({
			starts: [0, 3 * BAR],
			ends: [BAR, 3 * BAR + 256],
			end: 3 * BAR + 256
		});
	});

	it('keeps leading rests before the first chord', () => {
		const bytes = exportBytes([null, chord('1m')]);
		expect(chordStartsAndLength(bytes)).toEqual({ starts: [BAR], ends: [2 * BAR], end: 2 * BAR });
	});

	it('extends the track length for trailing rests', () => {
		const bytes = exportBytes([chord('1m'), null, null]);
		expect(chordStartsAndLength(bytes)).toEqual({ starts: [0], ends: [BAR], end: 3 * BAR });
	});

	it('writes nothing for an all-rest progression', () => {
		const buildFile = vi.spyOn(MidiWriter.Writer.prototype, 'buildFile');
		exportToMIDI([null, null]);
		expect(buildFile).not.toHaveBeenCalled();
	});
});
