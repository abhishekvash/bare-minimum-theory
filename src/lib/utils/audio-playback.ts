/**
 * Audio Playback Utilities
 * Handles chord preview using Tone.js
 */

import * as Tone from 'tone';
import type { Chord } from '$lib/utils/theory-engine';
import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';

let synth: Tone.PolySynth | null = null;
let isAudioInitialized = false;

const DEFAULT_BPM = 120;
const BEATS_PER_MEASURE = 4;
const LEAD_IN_SECONDS = 0.1;

/**
 * Initialize audio context (must be called on user gesture)
 * @returns Promise that resolves when audio is ready
 */
export async function initAudio(): Promise<void> {
	if (isAudioInitialized) return;

	await Tone.start();
	synth = new Tone.PolySynth().toDestination();
	isAudioInitialized = true;
}

/**
 * Play a chord given an array of MIDI note numbers
 * @param midiNotes - Array of MIDI note numbers to play
 * @param duration - Duration of the notes (default: '2n' = half note)
 */
export async function playChord(midiNotes: number[], duration = '2n'): Promise<void> {
	// Initialize audio if not already done
	if (!isAudioInitialized) {
		await initAudio();
	}

	if (!synth) return;

	// Convert MIDI numbers to note names (e.g., 60 -> "C4")
	const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());

	// Play the chord - triggerAttackRelease accepts array of notes
	synth.triggerAttackRelease(noteNames, duration);
}

/**
 * Play an entire chord progression at a fixed tempo (default 120 BPM)
 * @param chords - Array of chord definitions
 * @param bpm - Tempo in beats per minute
 */
export async function playProgression(chords: Chord[], bpm = DEFAULT_BPM): Promise<void> {
	if (!chords.length) return;

	await initAudio();
	const activeSynth = synth;
	if (!activeSynth) return;

	const secondsPerBeat = 60 / bpm;
	const measureDuration = secondsPerBeat * BEATS_PER_MEASURE;
	const startTime = Tone.now() + LEAD_IN_SECONDS;

	chords.forEach((chord, index) => {
		const midiNotes = getChordNotes(chord);
		const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());
		const scheduledTime = startTime + index * measureDuration;
		activeSynth.triggerAttackRelease(noteNames, measureDuration, scheduledTime);
	});
}

/**
 * Stop all currently playing notes
 */
export function stopAll(): void {
	if (synth) {
		synth.releaseAll();
	}
}

/**
 * Cleanup audio resources
 */
export function disposeAudio(): void {
	if (synth) {
		synth.dispose();
		synth = null;
	}
	isAudioInitialized = false;
}
