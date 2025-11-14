import MidiWriter from 'midi-writer-js';
import type { Chord } from '$lib/utils/theory-engine';
import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
import { NOTE_NAMES } from '$lib/utils/theory-engine/constants';

const DEFAULT_FILE_NAME = 'chord-progression.mid';

function midiToNoteName(midi: number): string {
	const pitchClass = NOTE_NAMES[midi % 12];
	const octave = Math.floor(midi / 12) - 1;
	return `${pitchClass}${octave}`;
}

function ensureBrowserEnvironment(): boolean {
	return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function exportToMIDI(progression: Chord[], bpm = 120): void {
	if (!progression.length) return;
	if (!ensureBrowserEnvironment()) {
		console.warn('MIDI export is only available in the browser.');
		return;
	}

	const track = new MidiWriter.Track();
	track.setTempo(bpm);
	track.setTimeSignature(4, 4, 24, 8);

	progression.forEach((chord) => {
		const midiNotes = getChordNotes(chord);
		const pitch = midiNotes.map((note) => midiToNoteName(note));
		track.addEvent(
			new MidiWriter.NoteEvent({
				pitch,
				duration: '1'
			})
		);
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
