import MidiWriter from 'midi-writer-js';
import type { Chord } from '#lib/utils/theory-engine/index.ts';
import { getChordNotes } from '#lib/utils/theory-engine/chord-operations.ts';
import { NOTE_NAMES } from '#lib/utils/theory-engine/constants.ts';
import { durationToEighths } from '#lib/utils/theory-engine/duration.ts';
import { hasNonNullChords } from '#lib/utils/theory-engine/progression.ts';

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

/** midi-writer-js resolution: 128 ticks per quarter note, so 64 per eighth */
const MIDI_WRITER_TICKS_PER_EIGHTH = 64;

/** An empty slot is a whole 4/4 bar of silence */
const REST_TICKS = 8 * MIDI_WRITER_TICKS_PER_EIGHTH;

/**
 * Express a chord duration as an explicit midi-writer-js tick length (`T###`).
 * Unknown values fall back to one bar, as everywhere else.
 */
function toMidiWriterDuration(duration: string): string {
	return `T${durationToEighths(duration) * MIDI_WRITER_TICKS_PER_EIGHTH}`;
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

	// midi-writer-js emits no events for an empty pitch list, so a rest would
	// advance no time. Instead, carry the rest length forward as the next
	// chord's `wait`, and as the End of Track delta for trailing rests.
	let pendingRestTicks = 0;

	progression.forEach((chord) => {
		if (!chord) {
			pendingRestTicks += REST_TICKS;
			return;
		}

		// Clamp notes to valid MIDI range and remove duplicates
		const clampedNotes = getChordNotes(chord).map(clampMidiNote);
		const uniqueNotes = [...new Set(clampedNotes)];
		const pitch = uniqueNotes.map((note) => midiToNoteName(note));
		track.addEvent(
			new MidiWriter.NoteEvent({
				pitch,
				duration: toMidiWriterDuration(chord.duration),
				...(pendingRestTicks > 0 && { wait: `T${pendingRestTicks}` })
			})
		);
		pendingRestTicks = 0;
	});

	// Trailing rests still extend the file: the End of Track delta sets its length
	track.addEvent(new MidiWriter.EndTrackEvent({ delta: pendingRestTicks }));

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
