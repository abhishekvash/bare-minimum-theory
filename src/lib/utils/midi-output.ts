/**
 * MIDI Output Utilities
 * Handles real-time MIDI output via Web MIDI API
 */

import type { Chord } from '$lib/utils/theory-engine';
import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
import {
	buildLoopTimeline,
	eighthNoteMs,
	findSlotProgress
} from '$lib/utils/theory-engine/duration';
import { midiState } from '$lib/stores/midi.svelte';

// MIDI message constants
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const ALL_NOTES_OFF_CC = 123;
const CONTROL_CHANGE = 0xb0;

// Default settings
const DEFAULT_VELOCITY = 100;
const DEFAULT_CHANNEL = 0; // MIDI channels are 0-indexed internally
/** Delay between notes of a strummed chord (slightly faster than audio) */
export const STRUM_DELAY_MS = 30;
const NOTE_OFF_ANTICIPATION_MS = 50; // Send note-off slightly before next chord to avoid overlap

// Module state
let midiAccess: MIDIAccess | null = null;
let selectedOutput: MIDIOutput | null = null;
let scheduledTimeouts: number[] = [];
let loopIntervalId: number | null = null;
let loopStartTime = 0;
let currentCycleOffsetsMs: number[] = [];
let currentCycleDurationsMs: number[] = [];
let currentLoopTotalMs = 0;

export type MIDIPlaybackErrorKind = 'connection' | 'send' | 'playback';
export type MIDIPlaybackError = { kind: MIDIPlaybackErrorKind; error: unknown };

let midiErrorCallback: ((event: MIDIPlaybackError) => void) | null = null;
let reportingMIDIError = false;

function cancelScheduledMIDI(): void {
	scheduledTimeouts.forEach((id) => window.clearTimeout(id));
	scheduledTimeouts = [];
	// Loop-boundary timers are tracked in the same collection.
	loopIntervalId = null;
}

/**
 * Best-effort silence on a port we are about to drop. Cancelling the scheduled note-offs would
 * otherwise leave every sounding note held forever, since Stop can no longer reach the port.
 * Failures here are swallowed: the original error is the one worth reporting.
 */
function silencePortBeforeDropping(output: MIDIOutput | null): void {
	if (!output || output.state !== 'connected') return;
	for (let channel = 0; channel < 16; channel++) {
		try {
			output.send([CONTROL_CHANGE + channel, ALL_NOTES_OFF_CC, 0]);
		} catch {
			return;
		}
	}
}

function reportMIDIError(error: unknown, kind: MIDIPlaybackErrorKind): void {
	if (reportingMIDIError) return;
	reportingMIDIError = true;
	cancelScheduledMIDI();
	silencePortBeforeDropping(selectedOutput);
	selectedOutput = null;
	try {
		midiErrorCallback?.({ kind, error });
	} finally {
		reportingMIDIError = false;
	}
}

function cancelTrackedTimeout(timeoutId: number): void {
	window.clearTimeout(timeoutId);
	const trackedIndex = scheduledTimeouts.indexOf(timeoutId);
	if (trackedIndex !== -1) scheduledTimeouts.splice(trackedIndex, 1);
}

function scheduleTrackedTimeout(callback: () => void, delayMs: number): number {
	let timeoutId = 0;
	timeoutId = window.setTimeout(() => {
		const trackedIndex = scheduledTimeouts.indexOf(timeoutId);
		if (trackedIndex !== -1) scheduledTimeouts.splice(trackedIndex, 1);
		try {
			callback();
		} catch (error) {
			reportMIDIError(error, 'playback');
		}
	}, delayMs);
	scheduledTimeouts.push(timeoutId);
	return timeoutId;
}

// State change callback
type StateChangeCallback = () => void;
let stateChangeCallback: StateChangeCallback | null = null;

/**
 * Check if Web MIDI API is supported in this browser
 */
export function isMIDISupported(): boolean {
	// Safari doesn't support Web MIDI
	if (typeof navigator === 'undefined') return false;

	const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
	if (isSafari) return false;

	return 'requestMIDIAccess' in navigator;
}

/**
 * Request MIDI access from the browser
 * @returns MIDIAccess object or null if not available/denied
 */
export async function requestMIDIAccess(): Promise<MIDIAccess | null> {
	if (!isMIDISupported()) return null;

	try {
		midiAccess = await navigator.requestMIDIAccess({ sysex: false });

		// Selected-output loss is a playback failure, not only a device-list refresh.
		midiAccess.onstatechange = (event: MIDIConnectionEvent) => {
			const port = event.port;
			if (
				selectedOutput &&
				port &&
				port.id === selectedOutput.id &&
				port.state !== 'connected' &&
				loopIntervalId !== null
			) {
				reportMIDIError(new Error('MIDI output disconnected'), 'connection');
			}
			stateChangeCallback?.();
		};

		return midiAccess;
	} catch (error) {
		console.error('MIDI access denied:', error);
		return null;
	}
}

/**
 * Get list of available MIDI outputs
 */
export function getMIDIOutputs(): Array<{ id: string; name: string }> {
	if (!midiAccess) return [];

	const outputs: Array<{ id: string; name: string }> = [];
	midiAccess.outputs.forEach((output) => {
		outputs.push({
			id: output.id,
			name: output.name || `MIDI Output ${output.id}`
		});
	});
	return outputs;
}

/**
 * Get list of available MIDI inputs (for clock sync)
 */
export function getMIDIInputs(): Array<{ id: string; name: string }> {
	if (!midiAccess) return [];

	const inputs: Array<{ id: string; name: string }> = [];
	midiAccess.inputs.forEach((input) => {
		inputs.push({
			id: input.id,
			name: input.name || `MIDI Input ${input.id}`
		});
	});
	return inputs;
}

/**
 * Get the current MIDIAccess object (for sharing with midi-clock module)
 */
export function getMIDIAccess(): MIDIAccess | null {
	return midiAccess;
}

/**
 * Select a MIDI output device by ID
 * @returns true if device was found and selected
 */
export function selectMIDIOutput(outputId: string): boolean {
	if (!midiAccess) return false;

	const output = midiAccess.outputs.get(outputId);
	if (output) {
		selectedOutput = output;
		return true;
	}
	return false;
}

/**
 * Get the currently selected output ID
 */
export function getSelectedOutputId(): string | null {
	return selectedOutput?.id ?? null;
}

/**
 * Check if we have an active MIDI connection
 */
export function isConnected(): boolean {
	return selectedOutput !== null && selectedOutput.state === 'connected';
}

/**
 * Register a callback for state changes (device connect/disconnect)
 */
export function onStateChange(callback: StateChangeCallback): () => void {
	stateChangeCallback = callback;
	return () => {
		stateChangeCallback = null;
	};
}

/** Register the application handler for asynchronous MIDI output failures. */
export function onMIDIError(callback: (event: MIDIPlaybackError) => void): () => void {
	midiErrorCallback = callback;
	return () => {
		if (midiErrorCallback === callback) midiErrorCallback = null;
	};
}

function sendMIDIMessage(message: number[]): boolean {
	if (!selectedOutput) return false;
	if (selectedOutput.state !== 'connected') {
		// Only a running loop has playback to fail. A stray note-off to a port that just vanished
		// (e.g. cancelling an audition during disconnect) drops the port quietly; the device-list
		// refresh already tells the user it is gone.
		if (loopIntervalId !== null) {
			reportMIDIError(new Error('MIDI output disconnected'), 'connection');
		} else {
			selectedOutput = null;
		}
		return false;
	}
	try {
		selectedOutput.send(message);
		return true;
	} catch (error) {
		reportMIDIError(error, 'send');
		return false;
	}
}

/**
 * Send a MIDI Note On message
 */
export function sendNoteOn(
	note: number,
	velocity: number = DEFAULT_VELOCITY,
	channel: number = DEFAULT_CHANNEL
): void {
	if (!selectedOutput) return;

	// Clamp values to valid MIDI range
	note = Math.max(0, Math.min(127, Math.round(note)));
	velocity = Math.max(0, Math.min(127, Math.round(velocity)));
	channel = Math.max(0, Math.min(15, channel));

	sendMIDIMessage([NOTE_ON + channel, note, velocity]);
}

/**
 * Send a MIDI Note Off message
 */
export function sendNoteOff(note: number, channel: number = DEFAULT_CHANNEL): void {
	if (!selectedOutput) return;

	note = Math.max(0, Math.min(127, Math.round(note)));
	channel = Math.max(0, Math.min(15, channel));

	sendMIDIMessage([NOTE_OFF + channel, note, 0]);
}

/**
 * Send Note On for multiple notes (chord)
 * @returns Timers for strummed attacks still pending, so a note-off can cancel them first
 */
export function sendChordOn(
	notes: number[],
	velocity: number = DEFAULT_VELOCITY,
	channel: number = DEFAULT_CHANNEL
): number[] {
	const useStrum = midiState.strumEnabled;
	const pendingAttacks: number[] = [];

	notes.forEach((note, i) => {
		if (useStrum && i > 0) {
			// Slight strum delay between notes
			pendingAttacks.push(
				scheduleTrackedTimeout(() => {
					sendNoteOn(note, velocity, channel);
				}, i * STRUM_DELAY_MS)
			);
		} else {
			sendNoteOn(note, velocity, channel);
		}
	});
	return pendingAttacks;
}

/**
 * Release a chord: cancel strum attacks that have not fired yet (a short chord can end before
 * its strum finishes), then send note-off for every note.
 */
function releaseChord(notes: number[], pendingAttacks: number[], channel: number): void {
	pendingAttacks.forEach(cancelTrackedTimeout);
	sendChordOff(notes, channel);
}

/**
 * Send Note Off for multiple notes (chord)
 */
export function sendChordOff(notes: number[], channel: number = DEFAULT_CHANNEL): void {
	notes.forEach((note) => {
		sendNoteOff(note, channel);
	});
}

/**
 * Play a chord for a specified duration
 * @param notes - Array of MIDI note numbers
 * @param durationMs - Duration in milliseconds
 * @param velocity - Note velocity (0-127)
 * @param channel - MIDI channel (0-15)
 */
export function playChord(
	notes: number[],
	durationMs: number,
	velocity: number = DEFAULT_VELOCITY,
	channel: number = DEFAULT_CHANNEL
): void {
	const pendingAttacks = sendChordOn(notes, velocity, channel);

	// Schedule note off
	scheduleTrackedTimeout(() => {
		releaseChord(notes, pendingAttacks, channel);
	}, durationMs);
}

/**
 * Send All Notes Off on a channel
 */
export function sendAllNotesOff(channel: number = DEFAULT_CHANNEL): void {
	if (!selectedOutput) return;
	channel = Math.max(0, Math.min(15, channel));
	sendMIDIMessage([CONTROL_CHANGE + channel, ALL_NOTES_OFF_CC, 0]);
}

/**
 * Stop all MIDI output - cancel scheduled notes and send all notes off
 */
export function stopAllMIDI(): void {
	cancelScheduledMIDI();

	// Send all notes off on all channels
	for (let channel = 0; channel < 16; channel++) {
		sendAllNotesOff(channel);
	}
}

/**
 * Start looping playback of a chord progression via MIDI
 * @param getProgression - Function that returns current progression state
 * @param bpm - Tempo in beats per minute
 */
export function startMIDILoop(
	getProgression: () => (Chord | null)[],
	bpm: number,
	velocity: number = DEFAULT_VELOCITY,
	channel: number = DEFAULT_CHANNEL
): boolean {
	stopAllMIDI();

	loopStartTime = performance.now();
	let totalLoopMs = scheduleLoopChords(getProgression, bpm, velocity, channel);
	if (totalLoopMs <= 0) return false;

	// Set up a self-correcting timeout. Each boundary takes a fresh structural snapshot,
	// so duration and slot edits never disturb the cycle that is already sounding.
	let expectedTime = loopStartTime + totalLoopMs;

	function scheduleNextLoop() {
		const cycleStartTime = performance.now();
		const drift = cycleStartTime - expectedTime;
		loopStartTime = cycleStartTime;
		totalLoopMs = scheduleLoopChords(getProgression, bpm, velocity, channel);

		if (totalLoopMs <= 0) {
			loopIntervalId = null;
			return;
		}

		expectedTime += totalLoopMs;
		loopIntervalId = scheduleTrackedTimeout(scheduleNextLoop, Math.max(0, totalLoopMs - drift));
	}

	loopIntervalId = scheduleTrackedTimeout(scheduleNextLoop, totalLoopMs);
	return true;
}

/**
 * Schedule all chords for one loop iteration.
 * The progression is read once for structural timing, while harmony is read live at note-on.
 * @returns Total duration of the scheduled cycle in milliseconds
 */
function scheduleLoopChords(
	getProgression: () => (Chord | null)[],
	bpm: number,
	velocity: number,
	channel: number
): number {
	const progression = getProgression();
	const timeline = buildLoopTimeline(progression);
	const msPerEighth = eighthNoteMs(bpm);
	const offsetsMs = timeline.offsetsEighths.map((eighths) => eighths * msPerEighth);
	const durationsMs = timeline.durationsEighths.map((eighths) => eighths * msPerEighth);
	const cumulativeTimeMs = timeline.totalEighths * msPerEighth;

	currentCycleOffsetsMs = offsetsMs;
	currentCycleDurationsMs = durationsMs;
	currentLoopTotalMs = cumulativeTimeMs;

	// Track notes that are currently playing so note-off matches the harmony actually heard.
	const playingNotes: Map<number, { notes: number[]; pendingAttacks: number[] }> = new Map();

	progression.forEach((_, index) => {
		const startTimeMs = offsetsMs[index];
		const durationMs = durationsMs[index];

		scheduleTrackedTimeout(() => {
			const currentProgression = getProgression();
			const chord = currentProgression[index];
			if (!chord) return;

			const notes = getChordNotes(chord);
			playingNotes.set(index, { notes, pendingAttacks: sendChordOn(notes, velocity, channel) });
		}, startTimeMs);

		scheduleTrackedTimeout(
			() => {
				const playing = playingNotes.get(index);
				if (playing) {
					releaseChord(playing.notes, playing.pendingAttacks, channel);
					playingNotes.delete(index);
				}
			},
			Math.max(startTimeMs, startTimeMs + durationMs - NOTE_OFF_ANTICIPATION_MS)
		);
	});

	return cumulativeTimeMs;
}

/**
 * Stop looping playback
 */
export function stopMIDILoop(): void {
	stopAllMIDI();
}

/**
 * Get current playback progress for visual sync
 * @returns Object with chordIndex and progress (0-100), or null if not playing
 */
export function getMIDIPlaybackProgress(): { chordIndex: number; progress: number } | null {
	if (loopIntervalId === null || currentLoopTotalMs <= 0 || currentCycleOffsetsMs.length === 0) {
		return null;
	}

	const elapsed = (performance.now() - loopStartTime) % currentLoopTotalMs;
	return findSlotProgress(currentCycleOffsetsMs, currentCycleDurationsMs, elapsed);
}

/**
 * Check if MIDI loop is currently playing
 */
export function isMIDILoopPlaying(): boolean {
	return loopIntervalId !== null;
}

/**
 * Cleanup MIDI resources
 */
export function disposeMIDI(): void {
	stopAllMIDI();
	selectedOutput = null;
	midiAccess = null;
	stateChangeCallback = null;
	midiErrorCallback = null;
}
