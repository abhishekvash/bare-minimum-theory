/**
 * Audio Playback Utilities
 * Owns the Tone.js loop engine and the dedicated preview synth the audition controller plays on.
 *
 * The two synths are deliberately separate: `cancelAudition` releases preview voices constantly,
 * and loop voices must be untouchable by that. Non-loop sound is never triggered from here —
 * `audition-controller.ts` is the single entry point for it.
 *
 * It is also the single owner of the loop transport lifecycle: `getTransportStatus` is the
 * authoritative answer to "is the loop playing?", and this module is the only writer of the
 * reactive `uiState.transportActive` mirror that components read.
 *
 * Stores never import this module: they reach it through `playback-port.ts`, whose hooks are
 * filled in at the bottom of this file. Cancelling auditions around loop start/stop is the
 * transport store's job, so nothing here imports `audition-controller.ts` either.
 */

import type * as ToneModule from 'tone';
import type { Chord } from '#lib/utils/theory-engine/index.ts';
import { getChordNotes } from '#lib/utils/theory-engine/chord-operations.ts';
import { buildLoopTimeline, findSlotProgress } from '#lib/utils/theory-engine/duration.ts';
import { hasNonNullChords } from '#lib/utils/theory-engine/progression.ts';
import { midiState } from '#lib/stores/midi.svelte.ts';
import { setActiveNotes, clearActiveNotes } from '#lib/stores/settings.svelte.ts';
import { setTransportActive } from '#lib/stores/ui.svelte.ts';
import { playbackPort } from '#lib/utils/playback-port.ts';
import {
	startMIDILoop,
	stopMIDILoop,
	getMIDIPlaybackProgress,
	isMIDILoopPlaying,
	setMIDILoopTempo
} from '#lib/utils/midi-output.ts';

export const DEFAULT_BPM = 120;
const BEATS_PER_MEASURE = 4;
const LEAD_IN_SECONDS = 0.1;
const STRUM_DELAY = 0.05; // 50ms between loop notes for guitar-like strum
const TEMPO_RAMP_TIME = 0.1; // 100ms smooth ramp for tempo changes

/**
 * Tone.js, loaded on first use. It is a large browser-only library, so it stays out of the
 * initial bundle and out of server rendering; initAudio() loads it on the first user gesture.
 */
let Tone: typeof ToneModule | null = null;
let toneLoading: Promise<typeof ToneModule> | null = null;

function loadTone(): Promise<typeof ToneModule> {
	toneLoading ??= import('tone').then(
		(module) => {
			Tone = module;
			return module;
		},
		(error: unknown) => {
			// A failed fetch (offline, deploy in progress) must not poison every later attempt
			toneLoading = null;
			throw error;
		}
	);
	return toneLoading;
}

/**
 * Fetch Tone.js ahead of the first click. Browsers only let audio start inside a user gesture,
 * and an import still in flight when the user presses Play could outlive that gesture (Safari is
 * strict here), so the app warms the module up once it has initialised.
 */
export function preloadAudioEngine(): Promise<void> {
	return loadTone().then(() => undefined);
}

/** Tone.js for code that only runs after initAudio() (synths, scheduled loop events) */
function tone(): typeof ToneModule {
	if (!Tone) throw new Error('Tone.js was used before initAudio() loaded it');
	return Tone;
}

let synth: ToneModule.PolySynth | null = null;
let previewSynth: ToneModule.PolySynth | null = null;
let isAudioInitialized = false;
let audioInitializationPromise: Promise<void> | null = null;
let audioLifecycleGeneration = 0;
let chordEventIds: (number | null)[] = [];
let pendingStructuralRebuildEventId: number | null = null;
let progressionGetter: (() => (Chord | null)[]) | null = null;
let currentBpm = DEFAULT_BPM;

/** Lifecycle of the looping transport, as seen by everything outside this module */
export type TransportStatus = 'stopped' | 'starting' | 'playing';

/** True while a start request is waiting on audio initialisation */
let transportStarting = false;
/** Invalidates an in-flight start when Stop (or a newer start) arrives during initialisation */
let startGeneration = 0;

/**
 * Loop timing in Transport ticks. Ticks are musical (PPQ-based), so the snapshot stays valid when
 * the tempo changes mid-loop; seconds would drift as soon as the BPM moves.
 */
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
function createSynth(): ToneModule.PolySynth {
	const T = tone();
	return new T.PolySynth(T.Synth, {
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
			let toneModule = Tone;
			if (!toneModule) {
				// Cold start (pressed before the preload finished): browsers only let audio start
				// inside the user's gesture, which an await would outlive. Create and resume a native
				// context now, synchronously, and hand it to Tone once the module has loaded.
				const unlocked = typeof AudioContext === 'undefined' ? null : new AudioContext();
				void unlocked?.resume();
				toneModule = await loadTone();
				if (unlocked) toneModule.setContext(unlocked);
			}
			// Already loaded (the usual case): this runs synchronously, inside the gesture
			await toneModule.start();
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
	// A running MIDI loop schedules its own timers, so it needs the tempo too
	setMIDILoopTempo(clampedBpm);

	// Not loaded yet: every loop start sets the transport tempo from currentBpm anyway
	if (!Tone) return;

	// Update the transport with smooth ramp if playing
	if (Tone.getTransport().state === 'started') {
		Tone.getTransport().bpm.rampTo(clampedBpm, TEMPO_RAMP_TIME);
	} else {
		Tone.getTransport().bpm.value = clampedBpm;
	}
}

// Re-exported for the audition controller; the table lives in the theory engine.
export { durationToMs } from '#lib/utils/theory-engine/duration.ts';

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
 * Whether previews can sound right now without waiting for audio startup
 */
export function isPreviewAudioReady(): boolean {
	return previewSynth !== null;
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

	const note = tone().Frequency(midiNote, 'midi').toNote();
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
	const startTime = tone().now() + LEAD_IN_SECONDS;

	chords.forEach((chord, index) => {
		if (!chord) return;

		const midiNotes = getChordNotes(chord);
		const noteNames = midiNotes.map((midi) => tone().Frequency(midi, 'midi').toNote());
		const scheduledTime = startTime + index * measureDuration;
		noteNames.forEach((note, i) => {
			activeSynth.triggerAttackRelease(note, measureDuration, scheduledTime + i * STRUM_DELAY);
		});
	});
}

/**
 * Where the looping transport is in its lifecycle.
 * 'starting' covers the asynchronous audio initialisation; 'playing' means the Tone transport or
 * the MIDI loop is running.
 */
export function getTransportStatus(): TransportStatus {
	// Guard against SSR - Tone.js is browser-only
	if (typeof window === 'undefined') return 'stopped';
	if (transportStarting) return 'starting';
	return Tone?.getTransport().state === 'started' || isMIDILoopPlaying() ? 'playing' : 'stopped';
}

/**
 * Start looping playback of a chord progression
 * Routes to MIDI when enabled, otherwise uses the Tone transport for audio
 * Provides sample-accurate timing for perfect looping
 * Each chord position has its own repeating event that reads current state
 * Null slots are treated as rests (silent measures)
 * A no-op unless the transport is stopped. A Stop that arrives while audio is still initialising
 * wins: the start resolves false and never touches the transport.
 * @param getProgression - Function that returns the current progression (may contain nulls)
 * @param bpm - Tempo in beats per minute
 * @returns true when the loop started
 */
export async function startLoopingPlayback(
	getProgression: () => (Chord | null)[],
	bpm = DEFAULT_BPM
): Promise<boolean> {
	if (getTransportStatus() !== 'stopped') return false;
	if (!hasNonNullChords(getProgression())) return false;

	const generation = ++startGeneration;
	transportStarting = true;
	try {
		const started = await startLoop(getProgression, bpm, generation);
		if (started) setTransportActive(true);
		return started;
	} catch (error) {
		// A superseded start's failure belongs to nobody: the caller has already moved on
		if (generation !== startGeneration) return false;
		throw error;
	} finally {
		if (generation === startGeneration) transportStarting = false;
	}
}

/**
 * Bring up the MIDI or Tone loop for a start request
 * @param generation - Start request this run belongs to; a mismatch after an await means it was superseded
 */
async function startLoop(
	getProgression: () => (Chord | null)[],
	bpm: number,
	generation: number
): Promise<boolean> {
	// Route to MIDI if enabled and connected
	if (shouldUseMIDI()) {
		const { velocity, midiChannel } = midiState;
		return startMIDILoop(getProgression, bpm, velocity, midiChannel - 1);
	}

	// Use Tone.js for audio output. A superseded request must stop before touching global transport.
	await initAudio();
	if (generation !== startGeneration) return false;
	const activeSynth = synth;
	if (!activeSynth) return false;

	// Re-read after the await: duration, insert and remove edits made while audio was starting
	// could not reach notifyChordUpdated (no schedule existed yet), so the snapshot must be fresh.
	const chords = getProgression();
	if (!hasNonNullChords(chords)) return false;

	teardownLoop();

	progressionGetter = getProgression;
	currentBpm = bpm;

	tone().getTransport().bpm.value = bpm;

	// Capture the timing owned by this schedule. Harmony remains live, duration does not.
	const timing = getLoopTiming(chords);
	activeToneTiming = timing;

	chordEventIds = chords.map((chord, index) =>
		scheduleChordRepeat(
			index,
			timing.totalDuration,
			timing.offsets[index],
			chord?.duration || '1m',
			activeSynth
		)
	);

	tone().getTransport().loop = true;
	tone().getTransport().loopStart = 0;
	tone().getTransport().loopEnd = ticks(timing.totalDuration);

	tone().getTransport().start();
	return true;
}

/**
 * Stop looping playback and reset Transport
 * Stops both MIDI and Tone.js playback, and cancels a start that is still initialising
 */
export function stopLoopingPlayback(): void {
	// Guard against SSR - Tone.js is browser-only
	if (typeof window === 'undefined') return;

	startGeneration += 1;
	transportStarting = false;
	teardownLoop();
	setTransportActive(false);
}

/**
 * Tear down whatever loop is running without touching the start lifecycle
 */
function teardownLoop(): void {
	// Stop MIDI if it's playing
	if (isMIDILoopPlaying()) {
		stopMIDILoop();
	}

	// Stop Tone.js transport (nothing to stop if audio never started)
	if (Tone) {
		Tone.getTransport().stop();
		Tone.getTransport().cancel();
		Tone.getTransport().position = 0;
	}

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

/** Format a tick count as Tone TransportTime notation. */
function ticks(count: number): string {
	return `${count}i`;
}

/** Transport ticks in one eighth note (PPQ / 2), asked of Tone so it follows the PPQ setting */
function ticksPerEighth(): number {
	return Math.round(tone().Time('8n').toTicks());
}

/** Current position inside the loop, in ticks. Tone resets ticks to loopStart on every wrap. */
function currentLoopTick(totalTicks: number): number {
	return totalTicks > 0 ? tone().getTransport().ticks % totalTicks : 0;
}

function getLoopTiming(progression: (Chord | null)[]): LoopTimingSnapshot {
	const timeline = buildLoopTimeline(progression);
	const scale = ticksPerEighth();
	return {
		offsets: timeline.offsetsEighths.map((eighths) => eighths * scale),
		durations: timeline.durationsEighths.map((eighths) => eighths * scale),
		totalDuration: timeline.totalEighths * scale
	};
}

function sameTiming(a: LoopTimingSnapshot, b: LoopTimingSnapshot): boolean {
	return (
		a.totalDuration === b.totalDuration &&
		a.offsets.length === b.offsets.length &&
		a.offsets.every((offset, index) => offset === b.offsets[index]) &&
		a.durations.every((duration, index) => duration === b.durations[index])
	);
}

/**
 * Schedule the repeating arrival for one slot. Harmony is read live at each arrival; the
 * sounding length is the duration captured when this slot was scheduled.
 * Positions are in ticks.
 */
function scheduleChordRepeat(
	index: number,
	totalTicks: number,
	offsetTicks: number,
	scheduledDuration: string,
	activeSynth: ToneModule.PolySynth
): number {
	return tone()
		.getTransport()
		.scheduleRepeat(
			(time) => {
				const chord = progressionGetter?.()[index];
				if (chord) {
					const midiNotes = getChordNotes(chord);
					setActiveNotes(midiNotes);
					const noteNames = midiNotes.map((midi) => tone().Frequency(midi, 'midi').toNote());
					const chordDuration = tone().Time(scheduledDuration).toSeconds();
					noteNames.forEach((note, noteIndex) => {
						activeSynth.triggerAttackRelease(note, chordDuration, time + noteIndex * STRUM_DELAY);
					});
				} else {
					clearActiveNotes();
				}
			},
			ticks(totalTicks),
			ticks(offsetTicks)
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
		if (id !== null) tone().getTransport().clear(id);
	});
	chordEventIds = progression.map((chord, index) =>
		scheduleChordRepeat(index, totalDuration, offsets[index], chord?.duration || '1m', activeSynth)
	);

	// Keep the old loopEnd until Tone wraps. Extending it before the wrap would skip the boundary;
	// committing at tick 0 lets the freshly-created slot-0 repeat fire in the same cycle.
	pendingStructuralRebuildEventId = tone()
		.getTransport()
		.scheduleOnce(() => {
			pendingStructuralRebuildEventId = null;
			if (!progressionGetter) return;
			tone().getTransport().loopEnd = ticks(totalDuration);
			activeToneTiming = nextTiming;

			// A structural edit landing after preparation found the guard set and scheduled nothing.
			// If the progression no longer matches what was just committed, rebuild again next lap.
			const latest = progressionGetter();
			if (
				latest.length !== chordEventIds.length ||
				!sameTiming(getLoopTiming(latest), nextTiming)
			) {
				pendingStructuralRebuildEventId = tone()
					.getTransport()
					.scheduleOnce(rebuildLoopScheduleBeforeBoundary, ticks(totalDuration - 1));
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
	if (!progressionGetter || chordEventIds.length === 0 || !activeToneTiming) return;

	const progression = progressionGetter();
	const lengthChanged = progression.length !== chordEventIds.length;
	if (index < 0 || (index >= progression.length && !lengthChanged)) return;

	const timing = getLoopTiming(progression);
	const activeTiming = activeToneTiming;

	if (lengthChanged || !sameTiming(timing, activeTiming)) {
		if (pendingStructuralRebuildEventId === null) {
			// Prepare on the last tick of the audible loop. This is an absolute position: if the
			// playhead is already past it, Tone reaches it on the next lap instead of never.
			pendingStructuralRebuildEventId = tone()
				.getTransport()
				.scheduleOnce(rebuildLoopScheduleBeforeBoundary, ticks(activeTiming.totalDuration - 1));
		}
		return;
	}

	const targetOffset = timing.offsets[index];

	if (targetOffset > currentLoopTick(timing.totalDuration)) {
		const oldEventId = chordEventIds[index];
		if (oldEventId !== null) {
			tone().getTransport().clear(oldEventId);
		}

		const activeSynth = synth;
		if (!activeSynth) return;

		chordEventIds[index] = scheduleChordRepeat(
			index,
			timing.totalDuration,
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
	if (Tone?.getTransport().state !== 'started') return null;

	const timing = activeToneTiming;
	if (!timing || timing.totalDuration <= 0) return null;
	const { offsets, durations, totalDuration } = timing;
	return findSlotProgress(offsets, durations, currentLoopTick(totalDuration));
}

playbackPort.slotChanged = notifyChordUpdated;
playbackPort.playheadSlot = () => getPlaybackProgress()?.chordIndex ?? null;
