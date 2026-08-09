/**
 * Audio Playback Utilities
 * Owns the Tone.js loop engine and the dedicated preview synth the audition controller plays on.
 *
 * The two synths are deliberately separate: `cancelAudition` releases preview voices constantly,
 * and loop voices must be untouchable by that. Non-loop sound is never triggered from here —
 * `audition-controller.ts` is the single entry point for it.
 *
 * This module and `audition-controller.ts` import each other on purpose (starting the loop has to
 * cancel preview tails). Only hoisted function declarations cross the cycle and neither module
 * body dereferences the other, so initialisation order does not matter.
 */

import * as Tone from 'tone';
import type { Chord } from '$lib/utils/theory-engine';
import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
import { hasNonNullChords } from '$lib/stores/progression.svelte';
import { midiState } from '$lib/stores/midi.svelte';
import { setActiveNotes, clearActiveNotes } from '$lib/stores/settings.svelte';
import { cancelAudition } from '$lib/utils/audition-controller';
import {
	startMIDILoop,
	stopMIDILoop,
	getMIDIPlaybackProgress,
	isMIDILoopPlaying
} from '$lib/utils/midi-output';

export const DEFAULT_BPM = 120;
const BEATS_PER_MEASURE = 4;
const LEAD_IN_SECONDS = 0.1;
const STRUM_DELAY = 0.05; // 50ms between loop notes for guitar-like strum
const TEMPO_RAMP_TIME = 0.1; // 100ms smooth ramp for tempo changes

let synth: Tone.PolySynth | null = null;
let previewSynth: Tone.PolySynth | null = null;
let isAudioInitialized = false;
let audioInitializationPromise: Promise<void> | null = null;
let audioLifecycleGeneration = 0;
let chordEventIds: (number | null)[] = [];
let pendingStructuralRebuildEventId: number | null = null;
let progressionGetter: (() => (Chord | null)[]) | null = null;
let currentBpm = DEFAULT_BPM;

type LoopTimingSnapshot = {
	offsets: number[];
	durations: number[];
	totalDuration: number;
};

/** Timing currently owned by the audible Tone schedule; replaced only at a rebuilt boundary. */
let activeToneTiming: LoopTimingSnapshot | null = null;

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
	if (!audioInitializationPromise) {
		const generation = audioLifecycleGeneration;
		const initialization = (async () => {
			await Tone.start();
			if (generation !== audioLifecycleGeneration) return;
			if (!synth) synth = createSynth();
			isAudioInitialized = true;
		})();
		audioInitializationPromise = initialization;
		const clearInitialization = () => {
			if (audioInitializationPromise === initialization) audioInitializationPromise = null;
		};
		void initialization.then(clearInitialization, clearInitialization);
	}
	await audioInitializationPromise;
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
 * Convert the inspector's supported Tone.js duration vocabulary to milliseconds.
 * Unknown values fall back to one bar for legacy data safety.
 * @param duration - Supported duration notation (e.g. '2n', '1m')
 * @param bpm - Tempo the duration should be measured against
 * @returns Duration in milliseconds
 */
export function durationToMs(duration: string, bpm: number): number {
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

// ============================================================================
// Preview Synth (played only by the audition controller)
// ============================================================================

/**
 * Start the audio context and create the preview synth if it does not exist yet
 * @returns Promise that resolves once previews can sound
 */
export async function initPreviewAudio(): Promise<void> {
	if (!isAudioInitialized) {
		await initAudio();
	}
	// A dispose that won the race with Tone.start() invalidates this initialization.
	if (!isAudioInitialized) return;
	if (!previewSynth) {
		previewSynth = createSynth();
	}
}

/**
 * Trigger one preview note immediately. Delays belong to the audition controller so they can be
 * cancelled before a future attack reaches Tone's internal scheduler.
 * @param midiNote - MIDI note number to play
 * @param duration - Duration of the note in Tone.js notation
 * @returns false when the preview synth does not exist yet, so the caller can initialize and retry
 */
export function triggerPreviewNote(midiNote: number, duration: string): boolean {
	if (!previewSynth) return false;

	const note = Tone.Frequency(midiNote, 'midi').toNote();
	previewSynth.triggerAttackRelease(note, duration);
	return true;
}

/**
 * Release every preview voice, leaving loop voices sounding
 */
export function releasePreviewVoices(): void {
	if (previewSynth) {
		previewSynth.releaseAll();
	}
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
 * @param isCancelled - Optional startup ownership guard checked after asynchronous audio init
 */
export async function startLoopingPlayback(
	getProgression: () => (Chord | null)[],
	bpm = DEFAULT_BPM,
	isCancelled: () => boolean = () => false
): Promise<boolean> {
	const initialChords = getProgression();
	if (!hasNonNullChords(initialChords)) return false;

	// The loop becomes the only sound source: kill any preview tail before it starts
	cancelAudition();

	// Route to MIDI if enabled and connected
	if (shouldUseMIDI()) {
		const { velocity, midiChannel } = midiState;
		return startMIDILoop(getProgression, bpm, velocity, midiChannel - 1);
	}

	// Use Tone.js for audio output. A superseded request must stop before touching global transport.
	await initAudio();
	if (isCancelled()) return false;
	const activeSynth = synth;
	if (!activeSynth) return false;

	stopLoopingPlayback();

	progressionGetter = getProgression;
	currentBpm = bpm;

	Tone.Transport.bpm.value = bpm;

	// Capture the timing owned by this schedule. Harmony remains live, duration does not.
	const timing = getLoopTiming(initialChords);
	const { offsets, totalDuration } = timing;
	activeToneTiming = timing;

	chordEventIds = new Array(initialChords.length).fill(null);
	for (let index = 0; index < initialChords.length; index++) {
		const offset = offsets[index];
		const scheduledDuration = initialChords[index]?.duration || '1m';
		const eventId = Tone.Transport.scheduleRepeat(
			(time) => {
				const currentChords = getProgression();
				const chord = currentChords[index];
				if (chord) {
					const midiNotes = getChordNotes(chord);
					// Update piano keyboard visualization
					setActiveNotes(midiNotes);
					const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());
					const chordDuration = Tone.Time(scheduledDuration).toSeconds();

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
	return true;
}

/**
 * Stop looping playback and reset Transport
 * Stops both MIDI and Tone.js playback
 */
export function stopLoopingPlayback(): void {
	// Guard against SSR - Tone.js is browser-only
	if (typeof window === 'undefined') return;

	// Stop also ends any audition that is still sounding
	cancelAudition();

	// Stop MIDI if it's playing
	if (isMIDILoopPlaying()) {
		stopMIDILoop();
	}

	// Stop Tone.js transport
	Tone.Transport.stop();
	Tone.Transport.cancel();
	Tone.Transport.position = 0;

	chordEventIds = [];
	pendingStructuralRebuildEventId = null;
	progressionGetter = null;
	activeToneTiming = null;

	if (synth) {
		synth.releaseAll();
	}

	// Clear piano keyboard visualization
	clearActiveNotes();
}

function getLoopTiming(progression: (Chord | null)[]): LoopTimingSnapshot {
	let totalDuration = 0;
	const durations = progression.map((chord) => Tone.Time(chord?.duration || '1m').toSeconds());
	const offsets = durations.map((duration) => {
		const start = totalDuration;
		totalDuration += duration;
		return start;
	});
	return { offsets, durations, totalDuration };
}

function scheduleChordRepeat(
	index: number,
	totalDuration: number,
	offset: number,
	scheduledDuration: string,
	activeSynth: Tone.PolySynth
): number {
	return Tone.Transport.scheduleRepeat(
		(time) => {
			const currentChords = progressionGetter!();
			const chord = currentChords[index];
			if (chord) {
				const midiNotes = getChordNotes(chord);
				setActiveNotes(midiNotes);
				const noteNames = midiNotes.map((midi) => Tone.Frequency(midi, 'midi').toNote());
				const chordDuration = Tone.Time(scheduledDuration).toSeconds();
				noteNames.forEach((note, noteIndex) => {
					activeSynth.triggerAttackRelease(note, chordDuration, time + noteIndex * STRUM_DELAY);
				});
			} else {
				clearActiveNotes();
			}
		},
		totalDuration,
		offset
	);
}

function rebuildLoopScheduleBeforeBoundary(): void {
	// Clear the preparation guard first so an exception cannot latch structural updates forever.
	pendingStructuralRebuildEventId = null;
	const getProgression = progressionGetter;
	const activeSynth = synth;
	if (!getProgression || !activeSynth) return;

	const progression = getProgression();
	const nextTiming = getLoopTiming(progression);
	const { offsets, totalDuration } = nextTiming;

	chordEventIds.forEach((id) => {
		if (id !== null) Tone.Transport.clear(id);
	});
	chordEventIds = new Array(progression.length).fill(null);

	for (let index = 0; index < progression.length; index++) {
		chordEventIds[index] = scheduleChordRepeat(
			index,
			totalDuration,
			offsets[index],
			progression[index]?.duration || '1m',
			activeSynth
		);
	}

	// Keep the old loopEnd until Tone wraps. Extending it before the wrap would skip the boundary;
	// committing at tick 0 lets the freshly-created slot-0 repeat fire in the same cycle.
	pendingStructuralRebuildEventId = Tone.Transport.scheduleOnce(() => {
		pendingStructuralRebuildEventId = null;
		if (progressionGetter) {
			Tone.Transport.loopEnd = totalDuration;
			activeToneTiming = nextTiming;
		}
	}, 0);
}

/**
 * Notify the audio system that a chord was updated at a specific index.
 * Harmony changes are rescheduled for the next arrival in the current cycle; duration and
 * structure changes rebuild the loop once at the next cycle boundary.
 * @param index - The position of the updated chord in the progression
 */
export function notifyChordUpdated(index: number): void {
	if (!progressionGetter || chordEventIds.length === 0) return;

	const progression = progressionGetter();
	const lengthChanged = progression.length !== chordEventIds.length;
	if (index < 0 || (index >= progression.length && !lengthChanged)) return;

	const { offsets, durations, totalDuration } = getLoopTiming(progression);
	const currentLoopEnd =
		typeof Tone.Transport.loopEnd === 'number'
			? Tone.Transport.loopEnd
			: Tone.Time(Tone.Transport.loopEnd).toSeconds();

	const timingChanged =
		!activeToneTiming ||
		activeToneTiming.offsets.length !== offsets.length ||
		offsets.some(
			(offset, timingIndex) =>
				Math.abs(offset - (activeToneTiming?.offsets[timingIndex] ?? Number.NaN)) > 0.01
		) ||
		durations.some(
			(duration, timingIndex) =>
				Math.abs(duration - (activeToneTiming?.durations[timingIndex] ?? Number.NaN)) > 0.01
		);

	if (Math.abs(totalDuration - currentLoopEnd) > 0.01 || lengthChanged || timingChanged) {
		if (pendingStructuralRebuildEventId === null) {
			const currentLoopPosition = Tone.Transport.seconds % currentLoopEnd;
			const secondsUntilBoundary = currentLoopEnd - currentLoopPosition;
			const oneTickSeconds = Tone.Time('1i').toSeconds();
			const preparationDelay =
				secondsUntilBoundary <= oneTickSeconds
					? secondsUntilBoundary + currentLoopEnd - oneTickSeconds
					: secondsUntilBoundary - oneTickSeconds;
			pendingStructuralRebuildEventId = Tone.Transport.scheduleOnce(
				rebuildLoopScheduleBeforeBoundary,
				`+${preparationDelay}`
			);
		}
		return;
	}

	const currentSeconds = Tone.Transport.seconds % totalDuration;
	const targetOffset = offsets[index];

	if (targetOffset > currentSeconds) {
		const oldEventId = chordEventIds[index];
		if (oldEventId !== null) {
			Tone.Transport.clear(oldEventId);
		}

		const activeSynth = synth;
		if (!activeSynth) return;

		chordEventIds[index] = scheduleChordRepeat(
			index,
			totalDuration,
			targetOffset,
			progression[index]?.duration || '1m',
			activeSynth
		);
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

	audioLifecycleGeneration += 1;
	audioInitializationPromise = null;
	if (synth) {
		synth.dispose();
		synth = null;
	}
	if (previewSynth) {
		previewSynth.dispose();
		previewSynth = null;
	}
	isAudioInitialized = false;
}

/**
 * Get the current playback progress for visual highlighting
 * Returns which chord is currently playing and the progress within that chord
 * Checks both MIDI and Tone.js playback sources
 * @returns Object with chordIndex and progress (0-100), or null if not playing
 */
export function getPlaybackProgress(): { chordIndex: number; progress: number } | null {
	// Check MIDI playback first
	if (isMIDILoopPlaying()) {
		return getMIDIPlaybackProgress();
	}

	// Fall back to Tone.js transport
	if (Tone.Transport.state !== 'started') return null;

	const timing = activeToneTiming;
	if (!timing || timing.totalDuration <= 0) return null;
	const { offsets, durations, totalDuration } = timing;
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
	const progressInChord = (currentSeconds - startTime) / durations[chordIndex];

	return {
		chordIndex,
		progress: Math.min(100, Math.max(0, progressInChord * 100))
	};
}
