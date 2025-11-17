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

	progression.forEach((chord) => {
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
					duration: '1' // Whole note
				})
			);
		} else {
			// Add rest (empty measure)
			track.addEvent(
				new MidiWriter.NoteEvent({
					pitch: [], // Empty pitch array = rest
					duration: '1' // Whole note duration
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
