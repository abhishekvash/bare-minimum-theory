/**
 * Audio Playback Utilities
 * Handles chord preview using Tone.js
 */

import * as Tone from 'tone';
import type { Chord } from '$lib/utils/theory-engine';
import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
import {
	hasNonNullChords,
	progressionState,
	setActiveNotes,
	clearActiveNotes
} from '$lib/stores/progression.svelte';
import {
	playChord as playMIDIChordRaw,
	startMIDILoop,
	stopMIDILoop,
	getMIDIPlaybackProgress,
	isMIDILoopPlaying
} from '$lib/utils/midi-output';

export const DEFAULT_BPM = 120;
const BEATS_PER_MEASURE = 4;
const LEAD_IN_SECONDS = 0.1;
const STRUM_DELAY = 0.05; // 50ms between notes for guitar-like strum
const TEMPO_RAMP_TIME = 0.1; // 100ms smooth ramp for tempo changes

let synth: Tone.PolySynth | null = null;
let isAudioInitialized = false;
let chordEventIds: (number | null)[] = [];
let progressionGetter: (() => (Chord | null)[]) | null = null;
let currentBpm = DEFAULT_BPM;
let clearNotesTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Create a new PolySynth with consistent configuration
 * @returns Configured PolySynth instance
 */
function createSynth(): Tone.PolySynth {
	return new Tone.PolySynth(Tone.Synth, {
		volume: -12,
		oscillator: {
			type: 'sine2'
		},
		envelope: {
			attack: 0.001,
			decay: 5,
			sustain: 0.01,
			release: 2
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
 * Get the current BPM used for playback
 * @returns Current BPM value
 */
export function getCurrentBpm(): number {
	return currentBpm;
}

/**
 * Update playback tempo smoothly during playback
 * Uses a smooth ramp to avoid audio glitches
 * @param newBpm - New tempo in beats per minute
 */
export function updatePlaybackTempo(newBpm: number): void {
	// Guard against SSR
	if (typeof window === 'undefined') return;

	// Clamp to reasonable range
	const clampedBpm = Math.max(40, Math.min(300, newBpm));
	currentBpm = clampedBpm;

	// Update Tone.Transport with smooth ramp if playing
	if (Tone.Transport.state === 'started') {
		Tone.Transport.bpm.rampTo(clampedBpm, TEMPO_RAMP_TIME);
	} else {
		Tone.Transport.bpm.value = clampedBpm;
	}
}

/**
 * Convert Tone.js duration notation to milliseconds
 */
function durationToMs(duration: string, bpm: number): number {
	const secondsPerBeat = 60 / bpm;
	const durationMap: Record<string, number> = {
		'1n': 4 * secondsPerBeat * 1000, // whole note
		'2n': 2 * secondsPerBeat * 1000, // half note
		'4n': 1 * secondsPerBeat * 1000, // quarter note
		'8n': 0.5 * secondsPerBeat * 1000 // eighth note
	};
	return durationMap[duration] || 2 * secondsPerBeat * 1000;
}

/**
 * Check if MIDI output is enabled and connected
 */
function shouldUseMIDI(): boolean {
	return progressionState.midiOutput.enabled && progressionState.midiOutput.isConnected;
}

/**
 * Play a chord given an array of MIDI note numbers
 * Routes to MIDI output when enabled, otherwise uses Tone.js
 * Also updates piano keyboard visualization
 * @param midiNotes - Array of MIDI note numbers to play
 * @param duration - Duration of the notes (default: '2n' = half note)
 */
export async function playChord(midiNotes: number[], duration = '2n'): Promise<void> {
	// Clear pending timeout, then update piano visualization
	if (clearNotesTimeoutId) clearTimeout(clearNotesTimeoutId);
	setActiveNotes(midiNotes);
	const durationMs = durationToMs(duration, DEFAULT_BPM);
	// Set new timeout to clear notes after duration
	clearNotesTimeoutId = setTimeout(() => {
		clearActiveNotes();
		clearNotesTimeoutId = null;
	}, durationMs + 100);

	// Route to MIDI if enabled and connected
	if (shouldUseMIDI()) {
		const { velocity, midiChannel } = progressionState.midiOutput;
		playMIDIChordRaw(midiNotes, durationMs, velocity, midiChannel - 1); // Convert 1-indexed to 0-indexed
		return;
	}

	// Use Tone.js for audio output
	if (!isAudioInitialized) {
		await initAudio();
	}

	if (!synth) return;

	const activeSynth = synth;
	const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());

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
	if (!hasNonNullChords(chords)) return;

	await initAudio();
	const activeSynth = synth;
	if (!activeSynth) return;

	const secondsPerBeat = 60 / bpm;
	const measureDuration = secondsPerBeat * BEATS_PER_MEASURE;
	const startTime = Tone.now() + LEAD_IN_SECONDS;

	chords.forEach((chord, index) => {
		if (!chord) return;

		const midiNotes = getChordNotes(chord);
		const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());
		const scheduledTime = startTime + index * measureDuration;
		noteNames.forEach((note, i) => {
			activeSynth.triggerAttackRelease(note, measureDuration, scheduledTime + i * STRUM_DELAY);
		});
	});
}

/**
 * Start looping playback of a chord progression
 * Routes to MIDI when enabled, otherwise uses Tone.Transport for audio
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
	if (!hasNonNullChords(initialChords)) return;

	// Route to MIDI if enabled and connected
	if (shouldUseMIDI()) {
		const { velocity, midiChannel } = progressionState.midiOutput;
		startMIDILoop(getProgression, bpm, velocity, midiChannel - 1);
		return;
	}

	// Use Tone.js for audio output
	await initAudio();
	const activeSynth = synth;
	if (!activeSynth) return;

	stopLoopingPlayback();

	progressionGetter = getProgression;
	currentBpm = bpm;

	Tone.Transport.bpm.value = bpm;

	const initialLength = initialChords.length;
	const measureDuration = (60 / bpm) * BEATS_PER_MEASURE;

	chordEventIds = new Array(initialLength).fill(null);
	for (let index = 0; index < initialLength; index++) {
		const eventId = Tone.Transport.scheduleRepeat(
			(time) => {
				const currentChords = getProgression();
				const chord = currentChords[index];
				if (chord) {
					const midiNotes = getChordNotes(chord);
					// Update piano keyboard visualization
					setActiveNotes(midiNotes);
					const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());
					// Strum each note with a small delay
					noteNames.forEach((note, i) => {
						activeSynth.triggerAttackRelease(note, measureDuration, time + i * STRUM_DELAY);
					});
				} else {
					// Clear piano keys for rest (null slot)
					clearActiveNotes();
				}
			},
			`${initialLength}m`,
			`${index}m`
		);
		chordEventIds[index] = eventId;
	}

	Tone.Transport.loop = true;
	Tone.Transport.loopStart = 0;
	Tone.Transport.loopEnd = `${initialLength}m`;

	Tone.Transport.start();
}

/**
 * Stop looping playback and reset Transport
 * Stops both MIDI and Tone.js playback
 */
export function stopLoopingPlayback(): void {
	// Guard against SSR - Tone.js is browser-only
	if (typeof window === 'undefined') return;

	// Stop MIDI if it's playing
	if (isMIDILoopPlaying()) {
		stopMIDILoop();
	}

	// Stop Tone.js transport
	Tone.Transport.stop();
	Tone.Transport.cancel();
	Tone.Transport.position = 0;

	chordEventIds = [];
	progressionGetter = null;

	if (synth) {
		synth.releaseAll();
	}

	// Clear piano keyboard visualization
	clearActiveNotes();
}

/**
 * Notify the audio system that a chord was updated at a specific index
 * If the chord hasn't played yet in the current loop iteration, reschedule it immediately
 * @param index - The position of the updated chord in the progression
 */
export function notifyChordUpdated(index: number): void {
	if (!progressionGetter || chordEventIds.length === 0) return;

	const progression = progressionGetter();
	if (index < 0 || index >= progression.length) return;

	const position = Tone.Transport.position as string;
	const [measures] = position.split(':').map(Number);

	const loopLength = progression.length;
	const positionInLoop = measures % loopLength;

	if (index > positionInLoop) {
		const oldEventId = chordEventIds[index];
		if (oldEventId !== null) {
			Tone.Transport.clear(oldEventId);
		}

		const measureDuration = (60 / currentBpm) * BEATS_PER_MEASURE;
		const activeSynth = synth;
		if (!activeSynth) return;

		const eventId = Tone.Transport.scheduleRepeat(
			(time) => {
				const currentChords = progressionGetter!();
				const chord = currentChords[index];
				if (chord) {
					const midiNotes = getChordNotes(chord);
					// Update piano keyboard visualization
					setActiveNotes(midiNotes);
					const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());
					// Strum each note with a small delay
					noteNames.forEach((note, i) => {
						activeSynth.triggerAttackRelease(note, measureDuration, time + i * STRUM_DELAY);
					});
				} else {
					// Clear piano keys for rest (null slot)
					clearActiveNotes();
				}
			},
			`${loopLength}m`,
			`${index}m`
		);
		chordEventIds[index] = eventId;
	}
}

/**
 * Stop all currently playing notes and cancel all scheduled notes
 */
export function stopAll(): void {
	if (synth) {
		synth.releaseAll();
		synth.dispose();
		synth = createSynth();
	}
}

/**
 * Cleanup audio resources
 */
export function disposeAudio(): void {
	// Guard against SSR - Tone.js is browser-only
	if (typeof window === 'undefined') return;

	if (synth) {
		synth.dispose();
		synth = null;
	}
	isAudioInitialized = false;
}

/**
 * Get the current playback progress for visual highlighting
 * Returns which chord is currently playing and the progress within that chord
 * Checks both MIDI and Tone.js playback sources
 * @param progressionLength - Number of slots in the progression (typically 4)
 * @param bpm - Tempo in beats per minute
 * @returns Object with chordIndex and progress (0-100), or null if not playing
 */
export function getPlaybackProgress(
	progressionLength: number,
	bpm: number
): { chordIndex: number; progress: number } | null {
	// Check MIDI playback first
	if (isMIDILoopPlaying()) {
		return getMIDIPlaybackProgress();
	}

	// Fall back to Tone.js transport
	if (Tone.Transport.state !== 'started') return null;

	const secondsPerMeasure = (60 / bpm) * BEATS_PER_MEASURE;
	const totalLoopSeconds = secondsPerMeasure * progressionLength;
	const currentSeconds = Tone.Transport.seconds % totalLoopSeconds;

	const chordIndex = Math.floor(currentSeconds / secondsPerMeasure);
	const progressInChord = (currentSeconds % secondsPerMeasure) / secondsPerMeasure;

	return {
		chordIndex,
		progress: progressInChord * 100
	};
}
