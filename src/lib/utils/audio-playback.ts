/**
 * Audio Playback Utilities
 * Handles chord preview using Tone.js
 */

import * as Tone from 'tone';
import type { Chord } from '$lib/utils/theory-engine';
import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';

let synth: Tone.PolySynth | null = null;
let isAudioInitialized = false;
let loopEventIds: number[] = [];

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
 * Start looping playback of a chord progression using Tone.Transport
 * Provides sample-accurate timing for perfect looping
 * @param chords - Array of chord definitions
 * @param bpm - Tempo in beats per minute
 */
export async function startLoopingPlayback(chords: Chord[], bpm = DEFAULT_BPM): Promise<void> {
	if (!chords.length) return;

	await initAudio();
	const activeSynth = synth;
	if (!activeSynth) return;

	// Stop any existing playback
	stopLoopingPlayback();

	// Set Transport BPM
	Tone.Transport.bpm.value = bpm;

	// Calculate loop length in measures
	const loopLengthInMeasures = chords.length;

	// Schedule each chord in the loop
	chords.forEach((chord, index) => {
		const midiNotes = getChordNotes(chord);
		const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());

		// Schedule at the start of each measure
		const eventId = Tone.Transport.schedule((time) => {
			activeSynth.triggerAttackRelease(noteNames, '1m', time);
		}, `${index}m`);

		loopEventIds.push(eventId);
	});

	// Set loop points (0 to end of progression)
	Tone.Transport.loop = true;
	Tone.Transport.loopStart = 0;
	Tone.Transport.loopEnd = `${loopLengthInMeasures}m`;

	// Start the transport
	Tone.Transport.start();
}

/**
 * Stop looping playback and reset Transport
 */
export function stopLoopingPlayback(): void {
	// Stop and reset transport
	Tone.Transport.stop();
	Tone.Transport.cancel();
	Tone.Transport.position = 0;

	// Clear event IDs
	loopEventIds = [];

	// Release all playing notes
	if (synth) {
		synth.releaseAll();
	}
}

/**
 * Stop all currently playing notes and cancel all scheduled notes
 */
export function stopAll(): void {
	if (synth) {
		// Release all currently playing notes
		synth.releaseAll();
		// Dispose and recreate synth to cancel all scheduled events
		synth.dispose();
		synth = new Tone.PolySynth().toDestination();
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
