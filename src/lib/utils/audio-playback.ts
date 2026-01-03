/**
 * Audio Playback Utilities
 * Handles chord preview using Tone.js
 */

import * as Tone from 'tone';
import type { Chord } from '$lib/utils/theory-engine';
import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
import { hasNonNullChords, progressionState } from '$lib/stores/progression.svelte';
import { midiState } from '$lib/stores/midi.svelte';
import { setActiveNotes, clearActiveNotes } from '$lib/stores/settings.svelte';
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
	const eighthNote = 0.5 * secondsPerBeat * 1000;
	const durationMap: Record<string, number> = {
		'8n': eighthNote, // 1/8 bar
		'4n': 2 * eighthNote, // 1/4 bar
		'4n.': 3 * eighthNote, // 3/8 bar (dotted quarter)
		'2n': 4 * eighthNote, // 1/2 bar
		'0:2:2': 5 * eighthNote, // 5/8 bar
		'2n.': 6 * eighthNote, // 3/4 bar (dotted half)
		'0:3:2': 7 * eighthNote, // 7/8 bar
		'1m': 8 * eighthNote, // 1 bar
		'1n': 8 * eighthNote, // whole note (alias)
		'1:0:2': 9 * eighthNote, // 1⅛ bars
		'1:1:0': 10 * eighthNote, // 1¼ bars
		'1:1:2': 11 * eighthNote, // 1⅜ bars
		'1:2:0': 12 * eighthNote, // 1½ bars
		'1:2:2': 13 * eighthNote, // 1⅝ bars
		'1:3:0': 14 * eighthNote, // 1¾ bars
		'1:3:2': 15 * eighthNote, // 1⅞ bars
		'2m': 16 * eighthNote // 2 bars
	};
	return durationMap[duration] || 8 * eighthNote; // default to 1 bar
}

/**
 * Check if MIDI output is enabled and connected
 */
function shouldUseMIDI(): boolean {
	return midiState.enabled && midiState.isConnected;
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
		const { velocity, midiChannel } = midiState;
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
		const { velocity, midiChannel } = midiState;
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

	// Calculate cumulative offsets and total loop duration
	let cumulativeTime = 0;
	const offsets = initialChords.map((chord) => {
		const start = cumulativeTime;
		const duration = chord?.duration || '1m';
		cumulativeTime += Tone.Time(duration).toSeconds();
		return start;
	});
	const totalDuration = cumulativeTime;

	chordEventIds = new Array(initialChords.length).fill(null);
	for (let index = 0; index < initialChords.length; index++) {
		const offset = offsets[index];
		const eventId = Tone.Transport.scheduleRepeat(
			(time) => {
				const currentChords = getProgression();
				const chord = currentChords[index];
				if (chord) {
					const midiNotes = getChordNotes(chord);
					// Update piano keyboard visualization
					setActiveNotes(midiNotes);
					const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());
					const chordDuration = Tone.Time(chord.duration).toSeconds();

					// Strum each note with a small delay
					noteNames.forEach((note, i) => {
						activeSynth.triggerAttackRelease(note, chordDuration, time + i * STRUM_DELAY);
					});
				} else {
					// Clear piano keys for rest (null slot)
					clearActiveNotes();
				}
			},
			totalDuration,
			offset
		);
		chordEventIds[index] = eventId;
	}

	Tone.Transport.loop = true;
	Tone.Transport.loopStart = 0;
	Tone.Transport.loopEnd = totalDuration;

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

	// Calculate current loop duration and offsets
	let cumulativeTime = 0;
	const offsets = progression.map((chord) => {
		const start = cumulativeTime;
		const duration = chord?.duration || '1m';
		cumulativeTime += Tone.Time(duration).toSeconds();
		return start;
	});
	const totalDuration = cumulativeTime;

	// Check if loop length or structure has changed significantly
	// (Comparing totalDuration against Transport loopEnd is a good heuristic)
	const currentLoopEnd =
		typeof Tone.Transport.loopEnd === 'number'
			? Tone.Transport.loopEnd
			: Tone.Time(Tone.Transport.loopEnd).toSeconds();

	if (
		Math.abs(totalDuration - currentLoopEnd) > 0.01 ||
		progression.length !== chordEventIds.length
	) {
		// Loop duration changed! Must reschedule EVERYTHING.
		// We re-call startLoopingPlayback logic without stopping Transport to avoid stutter.

		// Update loop points
		Tone.Transport.loopEnd = totalDuration;

		// Clear all existing events
		chordEventIds.forEach((id) => {
			if (id !== null) Tone.Transport.clear(id);
		});
		chordEventIds = new Array(progression.length).fill(null);

		const activeSynth = synth;
		if (!activeSynth) return;

		// Reschedule all events
		for (let i = 0; i < progression.length; i++) {
			const offset = offsets[i];
			const eventId = Tone.Transport.scheduleRepeat(
				(time) => {
					const currentChords = progressionGetter!();
					const chord = currentChords[i];
					if (chord) {
						const midiNotes = getChordNotes(chord);
						setActiveNotes(midiNotes);
						const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());
						const chordDuration = Tone.Time(chord.duration).toSeconds();
						noteNames.forEach((note, j) => {
							activeSynth.triggerAttackRelease(note, chordDuration, time + j * STRUM_DELAY);
						});
					} else {
						clearActiveNotes();
					}
				},
				totalDuration,
				offset
			);
			chordEventIds[i] = eventId;
		}
		return;
	}

	const currentSeconds = Tone.Transport.seconds % totalDuration;
	const targetOffset = offsets[index];

	// Only reschedule if the chord hasn't played yet in this loop iteration
	if (targetOffset > currentSeconds) {
		const oldEventId = chordEventIds[index];
		if (oldEventId !== null) {
			Tone.Transport.clear(oldEventId);
		}

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
					const chordDuration = Tone.Time(chord.duration).toSeconds();

					// Strum each note with a small delay
					noteNames.forEach((note, i) => {
						activeSynth.triggerAttackRelease(note, chordDuration, time + i * STRUM_DELAY);
					});
				} else {
					// Clear piano keys for rest (null slot)
					clearActiveNotes();
				}
			},
			totalDuration,
			targetOffset
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
 * @param progression - The current progression array
 * @param bpm - Tempo in beats per minute
 * @returns Object with chordIndex and progress (0-100), or null if not playing
 */
export function getPlaybackProgress(
	progression: (Chord | null)[],
	bpm: number
): { chordIndex: number; progress: number } | null {
	// Check MIDI playback first
	if (isMIDILoopPlaying()) {
		return getMIDIPlaybackProgress();
	}

	// Fall back to Tone.js transport
	if (Tone.Transport.state !== 'started') return null;

	// Calculate offsets and total duration
	let cumulativeTime = 0;
	const offsets = progression.map((chord) => {
		const start = cumulativeTime;
		const duration = chord?.duration || '1m';
		cumulativeTime += Tone.Time(duration).toSeconds();
		return start;
	});
	const totalDuration = cumulativeTime;

	const currentSeconds = Tone.Transport.seconds % totalDuration;

	// Find the current chord index
	let chordIndex = 0;
	for (let i = 0; i < offsets.length; i++) {
		if (currentSeconds >= offsets[i]) {
			chordIndex = i;
		} else {
			break;
		}
	}

	const startTime = offsets[chordIndex];
	const chordDuration = Tone.Time(progression[chordIndex]?.duration || '1m').toSeconds();
	const progressInChord = (currentSeconds - startTime) / chordDuration;

	return {
		chordIndex,
		progress: Math.min(100, Math.max(0, progressInChord * 100))
	};
}
