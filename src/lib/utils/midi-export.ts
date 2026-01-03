import MidiWriter from 'midi-writer-js';
import type { Chord } from '$lib/utils/theory-engine';
import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
import { NOTE_NAMES } from '$lib/utils/theory-engine/constants';
import { hasNonNullChords } from '$lib/stores/progression.svelte';

const DEFAULT_FILE_NAME = 'chord-progression.mid';
const MIDI_MIN_NOTE = 21; // A0
const MIDI_MAX_NOTE = 108; // C8

/**
 * Clamp MIDI note to valid range (21-108)
 * @param midi - MIDI note number
 * @returns Clamped MIDI note number
 */
function clampMidiNote(midi: number): number {
	return Math.max(MIDI_MIN_NOTE, Math.min(MIDI_MAX_NOTE, midi));
}

function midiToNoteName(midi: number): string {
	const clampedMidi = clampMidiNote(midi);
	const pitchClass = NOTE_NAMES[clampedMidi % 12];
	const octave = Math.floor(clampedMidi / 12) - 1;
	return `${pitchClass}${octave}`;
}

function ensureBrowserEnvironment(): boolean {
	return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function exportToMIDI(progression: (Chord | null)[], bpm = 120): void {
	// Check if there are any non-null chords
	if (!hasNonNullChords(progression)) return;
	if (!ensureBrowserEnvironment()) {
		console.warn('MIDI export is only available in the browser.');
		return;
	}

	const track = new MidiWriter.Track();
	track.setTempo(bpm);
	track.setTimeSignature(4, 4, 24, 8);

	// Maps all 16 UI duration options to midi-writer-js format
	// Standard notation: '1' (whole), '2' (half), '4' (quarter), '8' (eighth)
	// Dotted notation: 'd2' (dotted half), 'd4' (dotted quarter)
	// Tick notation: 'T###' for complex durations (128 ticks per quarter note)
	const DURATION_MAP: Record<string, string> = {
		'8n': '8', // 1/8 bar (eighth note)
		'4n': '4', // 1/4 bar (quarter note)
		'4n.': 'd4', // 3/8 bar (dotted quarter)
		'2n': '2', // 1/2 bar (half note)
		'0:2:2': 'T320', // 5/8 bar (2 quarters + 2 sixteenths = 256 + 64 ticks)
		'2n.': 'd2', // 3/4 bar (dotted half)
		'0:3:2': 'T448', // 7/8 bar (3 quarters + 2 sixteenths = 384 + 64 ticks)
		'1m': '1', // 1 bar (whole note)
		'1:0:2': 'T576', // 9/8 bar (1 bar + 2 sixteenths = 512 + 64 ticks)
		'1:1:0': 'T640', // 10/8 bar (1 bar + 1 quarter = 512 + 128 ticks)
		'1:1:2': 'T704', // 11/8 bar (1 bar + 1 quarter + 2 sixteenths = 512 + 128 + 64 ticks)
		'1:2:0': 'T768', // 12/8 bar (1 bar + 2 quarters = 512 + 256 ticks)
		'1:2:2': 'T832', // 13/8 bar (1 bar + 2 quarters + 2 sixteenths = 512 + 256 + 64 ticks)
		'1:3:0': 'T896', // 14/8 bar (1 bar + 3 quarters = 512 + 384 ticks)
		'1:3:2': 'T960', // 15/8 bar (1 bar + 3 quarters + 2 sixteenths = 512 + 384 + 64 ticks)
		'2m': 'T1024' // 2 bars (2 whole notes = 1024 ticks)
	};

	progression.forEach((chord) => {
		const duration = chord ? DURATION_MAP[chord.duration] || '1' : '1';

		if (chord) {
			// Add chord as notes
			const midiNotes = getChordNotes(chord);
			// Clamp notes to valid MIDI range and remove duplicates
			const clampedNotes = midiNotes.map(clampMidiNote);
			const uniqueNotes = [...new Set(clampedNotes)];
			const pitch = uniqueNotes.map((note) => midiToNoteName(note));
			track.addEvent(
				new MidiWriter.NoteEvent({
					pitch,
					duration
				})
			);
		} else {
			// Add rest (empty measure)
			track.addEvent(
				new MidiWriter.NoteEvent({
					pitch: [], // Empty pitch array = rest
					duration: '1' // Whole note duration for empty slot
				})
			);
		}
	});

	const writer = new MidiWriter.Writer(track);
	const midiBytes = writer.buildFile();
	const midiBuffer = new Uint8Array(midiBytes.length);
	midiBuffer.set(midiBytes);
	const blob = new Blob([midiBuffer], { type: 'audio/midi' });
	const url = URL.createObjectURL(blob);

	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = DEFAULT_FILE_NAME;
	anchor.style.display = 'none';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}
