/**
 * MIDI Output Utilities
 * Handles real-time MIDI output via Web MIDI API
 */

import type { Chord } from '$lib/utils/theory-engine';
import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
import { progressionState } from '$lib/stores/progression.svelte';

// MIDI message constants
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const ALL_NOTES_OFF_CC = 123;
const CONTROL_CHANGE = 0xb0;

// Default settings
const DEFAULT_VELOCITY = 100;
const DEFAULT_CHANNEL = 0; // MIDI channels are 0-indexed internally
const STRUM_DELAY_MS = 30; // Slightly faster than audio for MIDI
const NOTE_OFF_ANTICIPATION_MS = 50; // Send note-off slightly before next chord to avoid overlap

// Module state
let midiAccess: MIDIAccess | null = null;
let selectedOutput: MIDIOutput | null = null;
let scheduledTimeouts: number[] = [];
let loopIntervalId: number | null = null;
let loopStartTime = 0;
let currentLoopBpm = 120;
let currentLoopLength = 4;

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

		// Listen for device changes
		midiAccess.onstatechange = () => {
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

	selectedOutput.send([NOTE_ON + channel, note, velocity]);
}

/**
 * Send a MIDI Note Off message
 */
export function sendNoteOff(note: number, channel: number = DEFAULT_CHANNEL): void {
	if (!selectedOutput) return;

	note = Math.max(0, Math.min(127, Math.round(note)));
	channel = Math.max(0, Math.min(15, channel));

	selectedOutput.send([NOTE_OFF + channel, note, 0]);
}

/**
 * Send Note On for multiple notes (chord)
 */
export function sendChordOn(
	notes: number[],
	velocity: number = DEFAULT_VELOCITY,
	channel: number = DEFAULT_CHANNEL
): void {
	const useStrum = progressionState.midiOutput.strumEnabled;

	notes.forEach((note, i) => {
		if (useStrum) {
			// Slight strum delay between notes
			const timeout = window.setTimeout(() => {
				sendNoteOn(note, velocity, channel);
			}, i * STRUM_DELAY_MS);
			scheduledTimeouts.push(timeout);
		} else {
			// Play all notes simultaneously
			sendNoteOn(note, velocity, channel);
		}
	});
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
	sendChordOn(notes, velocity, channel);

	// Schedule note off
	const timeout = window.setTimeout(() => {
		sendChordOff(notes, channel);
	}, durationMs);
	scheduledTimeouts.push(timeout);
}

/**
 * Send All Notes Off on a channel
 */
export function sendAllNotesOff(channel: number = DEFAULT_CHANNEL): void {
	if (!selectedOutput) return;
	channel = Math.max(0, Math.min(15, channel));
	selectedOutput.send([CONTROL_CHANGE + channel, ALL_NOTES_OFF_CC, 0]);
}

/**
 * Stop all MIDI output - cancel scheduled notes and send all notes off
 */
export function stopAllMIDI(): void {
	// Cancel all scheduled timeouts
	scheduledTimeouts.forEach((id) => window.clearTimeout(id));
	scheduledTimeouts = [];

	// Stop loop if running
	if (loopIntervalId !== null) {
		window.clearTimeout(loopIntervalId);
		loopIntervalId = null;
	}

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
): void {
	stopAllMIDI();

	const progression = getProgression();
	const measureDurationMs = (60 / bpm) * 4 * 1000; // 4 beats per measure
	const totalLoopMs = measureDurationMs * progression.length;

	currentLoopBpm = bpm;
	currentLoopLength = progression.length;
	loopStartTime = performance.now();

	// Schedule initial chords
	scheduleLoopChords(getProgression, measureDurationMs, velocity, channel);

	// Set up self-correcting loop using setTimeout to prevent timing drift
	let expectedTime = performance.now() + totalLoopMs;

	function scheduleNextLoop() {
		const drift = performance.now() - expectedTime;
		loopStartTime = performance.now();
		scheduleLoopChords(getProgression, measureDurationMs, velocity, channel);
		expectedTime += totalLoopMs;
		loopIntervalId = window.setTimeout(scheduleNextLoop, Math.max(0, totalLoopMs - drift));
	}

	loopIntervalId = window.setTimeout(scheduleNextLoop, totalLoopMs);
}

/**
 * Schedule all chords for one loop iteration
 * Reads chord state at play time to reflect any changes made during playback
 */
function scheduleLoopChords(
	getProgression: () => (Chord | null)[],
	measureDurationMs: number,
	velocity: number,
	channel: number
): void {
	const progression = getProgression();
	// Track notes that are currently playing so we can turn them off correctly
	const playingNotes: Map<number, number[]> = new Map();

	progression.forEach((_, index) => {
		const startTime = index * measureDurationMs;

		// Schedule note on - read current state at play time
		const onTimeout = window.setTimeout(() => {
			const currentProgression = getProgression();
			const chord = currentProgression[index];
			if (!chord) return;

			const notes = getChordNotes(chord);
			playingNotes.set(index, notes);
			sendChordOn(notes, velocity, channel);
		}, startTime);
		scheduledTimeouts.push(onTimeout);

		// Schedule note off - turn off the notes that were actually played
		const offTimeout = window.setTimeout(
			() => {
				const notes = playingNotes.get(index);
				if (notes) {
					sendChordOff(notes, channel);
					playingNotes.delete(index);
				}
			},
			startTime + measureDurationMs - NOTE_OFF_ANTICIPATION_MS
		);
		scheduledTimeouts.push(offTimeout);
	});
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
	if (loopIntervalId === null) return null;

	const measureDurationMs = (60 / currentLoopBpm) * 4 * 1000;
	const totalLoopMs = measureDurationMs * currentLoopLength;
	const elapsed = (performance.now() - loopStartTime) % totalLoopMs;

	const chordIndex = Math.floor(elapsed / measureDurationMs);
	const progressInChord = (elapsed % measureDurationMs) / measureDurationMs;

	return {
		chordIndex,
		progress: progressInChord * 100
	};
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
}
