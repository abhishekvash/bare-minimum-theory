/**
 * Audio Playback Utilities
 * Handles chord preview using Tone.js
 */

import * as Tone from 'tone';
import type { Chord } from '$lib/utils/theory-engine';
import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
import { hasNonNullChords } from '$lib/stores/progression.svelte';

const DEFAULT_BPM = 120;
const BEATS_PER_MEASURE = 4;
const LEAD_IN_SECONDS = 0.1;
const STRUM_DELAY = 0.05; // 50ms between notes for guitar-like strum

let synth: Tone.PolySynth | null = null;
let isAudioInitialized = false;
let chordEventIds: (number | null)[] = [];
let progressionGetter: (() => (Chord | null)[]) | null = null;
let currentBpm = DEFAULT_BPM;

/**
 * Create a new PolySynth with consistent configuration
 * @returns Configured PolySynth instance
 */
function createSynth(): Tone.PolySynth {
	return new Tone.PolySynth(Tone.Synth, {
		volume: -12, // Reduce volume to prevent clipping
		oscillator: {
			type: 'sine2' // Colored sine wave
		},
		envelope: {
			attack: 0.001, // Fast attack for bell "ping"
			decay: 5, // Long decay for bell ring
			sustain: 0.01, // Low sustain (bell fades)
			release: 2 // Long release for natural decay
		}
	}).toDestination();
}

/**
 * Initialize audio context (must be called on user gesture)
 * @returns Promise that resolves when audio is ready
 */
export async function initAudio(): Promise<void> {
	if (isAudioInitialized) return;

	await Tone.start();
	synth = createSynth();
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

	// Capture synth reference for use in callback
	const activeSynth = synth;

	// Convert MIDI numbers to note names (e.g., 60 -> "C4")
	const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());

	// Play the chord with strum effect - trigger each note with a small delay
	noteNames.forEach((note, i) => {
		activeSynth.triggerAttackRelease(note, duration, '+' + i * STRUM_DELAY);
	});
}

/**
 * Play an entire chord progression at a fixed tempo (default 120 BPM)
 * Null slots are treated as rests (silent measures)
 * @param chords - Array of chord definitions (may contain nulls)
 * @param bpm - Tempo in beats per minute
 */
export async function playProgression(chords: (Chord | null)[], bpm = DEFAULT_BPM): Promise<void> {
	// Check if there are any non-null chords
	if (!hasNonNullChords(chords)) return;

	await initAudio();
	const activeSynth = synth;
	if (!activeSynth) return;

	const secondsPerBeat = 60 / bpm;
	const measureDuration = secondsPerBeat * BEATS_PER_MEASURE;
	const startTime = Tone.now() + LEAD_IN_SECONDS;

	chords.forEach((chord, index) => {
		// Skip null chords (rests) but maintain timing
		if (!chord) return;

		const midiNotes = getChordNotes(chord);
		const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());
		const scheduledTime = startTime + index * measureDuration;
		// Strum each note with a small delay
		noteNames.forEach((note, i) => {
			activeSynth.triggerAttackRelease(note, measureDuration, scheduledTime + i * STRUM_DELAY);
		});
	});
}

/**
 * Start looping playback of a chord progression using Tone.Transport
 * Provides sample-accurate timing for perfect looping
 * Each chord position has its own repeating event that reads current state
 * Null slots are treated as rests (silent measures)
 * @param getProgression - Function that returns the current progression (may contain nulls)
 * @param bpm - Tempo in beats per minute
 */
export async function startLoopingPlayback(
	getProgression: () => (Chord | null)[],
	bpm = DEFAULT_BPM
): Promise<void> {
	const initialChords = getProgression();
	// Check if there are any non-null chords
	if (!hasNonNullChords(initialChords)) return;

	await initAudio();
	const activeSynth = synth;
	if (!activeSynth) return;

	// Stop any existing playback
	stopLoopingPlayback();

	// Store progression getter and BPM
	progressionGetter = getProgression;
	currentBpm = bpm;

	// Set Transport BPM
	Tone.Transport.bpm.value = bpm;

	// Calculate initial loop length
	const initialLength = initialChords.length;

	// Calculate measure duration for triggerAttackRelease
	const measureDuration = (60 / bpm) * BEATS_PER_MEASURE;

	// Schedule a repeating event for each chord position
	// Each fires at its measure position and repeats every N measures (progression length)
	chordEventIds = new Array(initialLength).fill(null);
	for (let index = 0; index < initialLength; index++) {
		const eventId = Tone.Transport.scheduleRepeat(
			(time) => {
				const currentChords = getProgression();
				const chord = currentChords[index];
				if (chord) {
					const midiNotes = getChordNotes(chord);
					const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());
					// Strum each note with a small delay
					noteNames.forEach((note, i) => {
						activeSynth.triggerAttackRelease(note, measureDuration, time + i * STRUM_DELAY);
					});
				}
			},
			`${initialLength}m`, // Repeat every N measures
			`${index}m` // Start offset (0m, 1m, 2m, etc.)
		);
		chordEventIds[index] = eventId;
	}

	// Set loop points (0 to end of progression)
	Tone.Transport.loop = true;
	Tone.Transport.loopStart = 0;
	Tone.Transport.loopEnd = `${initialLength}m`;

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
	chordEventIds = [];
	progressionGetter = null;

	// Release all playing notes
	if (synth) {
		synth.releaseAll();
	}
}

/**
 * Notify the audio system that a chord was updated at a specific index
 * If the chord hasn't played yet in the current loop iteration, reschedule it immediately
 * @param index - The position of the updated chord in the progression
 */
export function notifyChordUpdated(index: number): void {
	// Only relevant if playback is active
	if (!progressionGetter || chordEventIds.length === 0) return;

	const progression = progressionGetter();
	if (index < 0 || index >= progression.length) return;

	// Get current transport position in measures
	const position = Tone.Transport.position as string; // e.g., "0:0:0" or "2:1:2"
	const [measures] = position.split(':').map(Number);

	// Calculate position within current loop iteration
	const loopLength = progression.length;
	const positionInLoop = measures % loopLength;

	// Check if this chord position is in the future of the current iteration
	if (index > positionInLoop) {
		// Chord hasn't played yet - reschedule it for immediate effect
		const oldEventId = chordEventIds[index];
		if (oldEventId !== null) {
			Tone.Transport.clear(oldEventId);
		}

		// Calculate measure duration
		const measureDuration = (60 / currentBpm) * BEATS_PER_MEASURE;
		const activeSynth = synth;
		if (!activeSynth) return;

		// Schedule new repeating event for this position
		const eventId = Tone.Transport.scheduleRepeat(
			(time) => {
				const currentChords = progressionGetter!();
				const chord = currentChords[index];
				if (chord) {
					const midiNotes = getChordNotes(chord);
					const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());
					// Strum each note with a small delay
					noteNames.forEach((note, i) => {
						activeSynth.triggerAttackRelease(note, measureDuration, time + i * STRUM_DELAY);
					});
				}
			},
			`${loopLength}m`, // Repeat every N measures
			`${index}m` // Start offset
		);
		chordEventIds[index] = eventId;
	}
	// If index <= positionInLoop, the chord already played - do nothing,
	// it will pick up the change on the next loop iteration automatically
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
		synth = createSynth();
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
