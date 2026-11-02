/**
 * Audition Controller
 * The single authority for normal UI auditions: builder previews, per-chord preview buttons,
 * saved-progression walkthroughs and the chained preview that gives a candidate its context.
 *
 * Two rules drive everything here:
 *
 * - **Audible priority.** While a transport owns the sound (Tone loop or MIDI loop) auditions are
 *   suppressed outright. Callers get `'suppressed'` back and render visual-only feedback; the loop
 *   stays the only thing anyone hears, and it also keeps the piano visualisation to itself.
 * - **Latest wins.** Every new audition cancels the previous one first, so rapid clicks and sweeps
 *   never stack. Cancellation is exact: the controller sends note-offs only for the MIDI notes it
 *   turned on itself, and releases only the preview synth, so loop notes are untouchable.
 *
 * This module and `audio-playback.ts` import each other on purpose (starting the loop has to cancel
 * preview tails). Only hoisted function declarations cross the cycle and no module body
 * dereferences the other, so initialisation order does not matter — the same constraint applies to
 * the store imports below.
 */

import type { Chord } from '$lib/utils/theory-engine';
import { getChordNotes } from '$lib/utils/theory-engine/chord-operations';
import { midiState } from '$lib/stores/midi.svelte';
import { progressionState } from '$lib/stores/progression.svelte';
import { uiState } from '$lib/stores/ui.svelte';
import { setActiveNotes, clearActiveNotes } from '$lib/stores/settings.svelte';
import {
	DEFAULT_BPM,
	durationToMs,
	getTransportStatus,
	initPreviewAudio,
	isPreviewAudioReady,
	releasePreviewVoices,
	triggerPreviewNote
} from '$lib/utils/audio-playback';
import { STRUM_DELAY_MS, sendNoteOff, sendNoteOn } from '$lib/utils/midi-output';

/** How a candidate is being browsed: a deliberate click, or a note crossed during a sweep */
export type AuditionMode = 'click' | 'sweep';

/** Whether the request was accepted for playback, or suppressed because the loop owns transport */
export type AuditionResult = 'played' | 'suppressed';

/** Scoped ownership returned by a multi-step audition. */
export interface AuditionSequenceHandle {
	cancel: () => void;
}

export interface AuditionOptions {
	/** `click` plays the chained context → candidate; `sweep` plays the candidate alone */
	mode: AuditionMode;
	/** Slot the candidate is aimed at; defaults to the selection, then the first empty slot */
	targetSlot?: number;
}

/** Length of a single audition step — about half a bar, short enough to browse quickly */
const STEP_DURATION = '2n';

/** Extra time the piano keeps its keys lit after a step, so the release is visible */
const PIANO_CLEAR_GRACE_MS = 100;

/** Audio preview strum delay; timers stay here so cancellation prevents future Tone attacks. */
const PREVIEW_STRUM_DELAY_MS = 50;

/**
 * Bumped by every cancellation. Async and delayed work captures the generation it was scheduled
 * under and does nothing once that generation is stale — this is what makes latest-wins airtight
 * even across the audio-context startup await.
 */
let generation = 0;

/** Timeouts belonging to the current audition (chained step, strum, note-offs) */
let pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

/** Timeout that clears the piano visualisation after the current step */
let clearNotesTimeoutId: ReturnType<typeof setTimeout> | null = null;

/** MIDI notes this controller turned on, mapped to the channel they were sent on */
const soundingMIDINotes = new Map<number, number>();

/** True while the piano visualisation is showing an audition rather than the loop */
let auditionOwnsPiano = false;

/** Saved-progression sequence timer, kept separate from the timers for its current sounding step. */
let sequenceTimeoutId: ReturnType<typeof setTimeout> | null = null;

/** Current sequence ownership, per-step ownership, and completion callback. */
let activeSequence: { token: symbol; stepToken: symbol | null; onComplete: () => void } | null =
	null;

/** Page-owned error surface for asynchronous audio-context startup failures. */
let auditionErrorHandler: ((error: unknown) => void) | null = null;

/** Register the application error surface used by asynchronous auditions. */
export function setAuditionErrorHandler(handler: ((error: unknown) => void) | null): void {
	auditionErrorHandler = handler;
}

/**
 * Register a timeout so cancellation can kill it
 * @param id - Timeout handle
 */
function track(id: ReturnType<typeof setTimeout>): void {
	pendingTimeouts.push(id);
}

/**
 * Check whether auditions should be routed to MIDI.
 * Enabled but disconnected deliberately falls back to internal audio rather than going silent.
 */
function shouldUseMIDI(): boolean {
	return midiState.enabled && midiState.isConnected;
}

/**
 * Check whether a transport currently owns the sound
 * @returns true while the loop is starting or running (Tone or MIDI)
 */
export function isTransportActive(): boolean {
	return getTransportStatus() !== 'stopped';
}

/**
 * End the current audition. Safe to call from any state and as often as needed.
 * Releases preview voices, drops pending steps, and sends note-offs for exactly the MIDI notes
 * this controller turned on.
 */
function clearCurrentAuditionOutput(): void {
	pendingTimeouts.forEach((id) => clearTimeout(id));
	pendingTimeouts = [];

	if (clearNotesTimeoutId !== null) {
		clearTimeout(clearNotesTimeoutId);
		clearNotesTimeoutId = null;
	}

	soundingMIDINotes.forEach((channel, note) => sendNoteOff(note, channel));
	soundingMIDINotes.clear();
	releasePreviewVoices();

	// Never wipe keys the loop lit — only the ones an audition put there
	if (auditionOwnsPiano) {
		clearActiveNotes();
		auditionOwnsPiano = false;
	}
}

export function cancelAudition(): void {
	generation += 1;

	if (sequenceTimeoutId !== null) {
		clearTimeout(sequenceTimeoutId);
		sequenceTimeoutId = null;
	}
	const sequence = activeSequence;
	activeSequence = null;

	clearCurrentAuditionOutput();
	sequence?.onComplete();
}

/**
 * Turn a MIDI note on and record it as controller-owned
 */
function startMIDINote(note: number, velocity: number, channel: number): void {
	sendNoteOn(note, velocity, channel);
	soundingMIDINotes.set(note, channel);
}

/**
 * Turn a controller-owned MIDI note off on the channel it was started on
 */
function stopMIDINote(note: number): void {
	const channel = soundingMIDINotes.get(note);
	if (channel === undefined) return;

	sendNoteOff(note, channel);
	soundingMIDINotes.delete(note);
}

/**
 * Send one audition step to the MIDI device, strumming when the user has strum enabled
 * @param midiNotes - Notes of the step
 * @param durationMs - How long the notes should sound
 * @param gen - Generation this step belongs to
 */
function playMIDIStep(midiNotes: number[], durationMs: number, gen: number): void {
	const { velocity, midiChannel, strumEnabled } = midiState;
	const channel = midiChannel - 1; // Convert 1-indexed to 0-indexed

	midiNotes.forEach((note, i) => {
		const delay = strumEnabled ? i * STRUM_DELAY_MS : 0;
		if (delay === 0) {
			startMIDINote(note, velocity, channel);
			return;
		}

		track(
			setTimeout(() => {
				if (gen !== generation) return;
				startMIDINote(note, velocity, channel);
			}, delay)
		);
	});

	track(
		setTimeout(() => {
			if (gen !== generation) return;
			midiNotes.forEach((note) => stopMIDINote(note));
		}, durationMs)
	);
}

/**
 * Send one audition step to the preview synth, starting the audio context if this is the first one
 * @param midiNotes - Notes of the step
 * @param duration - Duration in Tone.js notation
 * @param gen - Generation this step belongs to
 */
function playToneStep(
	midiNotes: number[],
	duration: string,
	gen: number,
	sequenceStepToken?: symbol
): void {
	if (midiNotes.length === 0) return;

	const ownsStep = () =>
		gen === generation &&
		(sequenceStepToken === undefined || activeSequence?.stepToken === sequenceStepToken);

	function scheduleRemainingNotes(startIndex: number): void {
		for (let index = startIndex; index < midiNotes.length; index++) {
			const note = midiNotes[index];
			const delay = index * PREVIEW_STRUM_DELAY_MS;
			if (delay === 0) {
				triggerPreviewNote(note, duration);
				continue;
			}
			track(
				setTimeout(() => {
					if (ownsStep()) triggerPreviewNote(note, duration);
				}, delay)
			);
		}
	}

	// A successful first attack proves the synth exists; all later attacks use tracked timers.
	if (triggerPreviewNote(midiNotes[0], duration)) {
		scheduleRemainingNotes(1);
		return;
	}

	// First preview of the session: initialize, then schedule relative to the successful startup.
	void initPreviewAudio()
		.then(() => {
			if (!ownsStep()) return;
			scheduleRemainingNotes(0);
		})
		.catch((error: unknown) => {
			if (!ownsStep()) return;
			cancelAudition();
			auditionErrorHandler?.(error);
		});
}

/**
 * Play one step of an audition, updating the piano visualisation with it
 * @param midiNotes - Notes of the step
 * @param duration - Duration in Tone.js notation
 * @param gen - Generation this step belongs to; a stale one is silently dropped
 */
function playStep(
	midiNotes: number[],
	duration: string,
	gen: number,
	sequenceStepToken?: symbol
): void {
	// A transport that started since this step was scheduled takes the sound back
	if (gen !== generation || isTransportActive()) return;

	const durationMs = durationToMs(duration, DEFAULT_BPM);

	if (clearNotesTimeoutId !== null) clearTimeout(clearNotesTimeoutId);
	setActiveNotes(midiNotes);
	auditionOwnsPiano = true;
	clearNotesTimeoutId = setTimeout(() => {
		clearNotesTimeoutId = null;
		if (gen !== generation) return;
		clearActiveNotes();
		auditionOwnsPiano = false;
	}, durationMs + PIANO_CLEAR_GRACE_MS);

	if (shouldUseMIDI()) {
		playMIDIStep(midiNotes, durationMs, gen);
		return;
	}

	playToneStep(midiNotes, duration, gen, sequenceStepToken);
}

/**
 * Resolve the slot a candidate is aimed at: the selection if there is one, otherwise the first
 * empty slot, otherwise the slot an Add would append.
 */
export function resolveTargetSlot(): number {
	if (uiState.selectedSlot !== null) return uiState.selectedSlot;

	const firstEmpty = progressionState.progression.findIndex((chord) => chord === null);
	return firstEmpty === -1 ? progressionState.progression.length : firstEmpty;
}

/**
 * Find the chord a chained preview should lead with: the nearest non-null chord before the target.
 * Rests are skipped for preview purposes only — they still play as silence in the real loop.
 * @param targetSlot - Slot the candidate is aimed at
 * @returns The context chord, or null when nothing precedes the target
 */
function findContextChord(targetSlot: number): Chord | null {
	const { progression } = progressionState;

	for (let i = Math.min(targetSlot, progression.length) - 1; i >= 0; i--) {
		const chord = progression[i];
		if (chord) return chord;
	}
	return null;
}

/**
 * Audition a candidate chord.
 * Clicking plays the chained preview (context chord, then candidate); sweeping plays the candidate
 * alone, because a sweep favours speed. Either way the previous audition is cancelled first.
 * @param chord - Candidate chord to audition
 * @param options - Browse mode and, optionally, an explicit target slot
 * @returns 'suppressed' while a transport is running, 'played' otherwise
 */
export function auditionChord(chord: Chord, options: AuditionOptions): AuditionResult {
	if (isTransportActive()) return 'suppressed';

	cancelAudition();
	const gen = generation;

	const candidateNotes = getChordNotes(chord);
	const context =
		options.mode === 'click' ? findContextChord(options.targetSlot ?? resolveTargetSlot()) : null;

	if (!context) {
		playStep(candidateNotes, STEP_DURATION, gen);
		return 'played';
	}

	const contextNotes = getChordNotes(context);
	const playChain = () => {
		playStep(contextNotes, STEP_DURATION, gen);
		track(
			setTimeout(
				() => playStep(candidateNotes, STEP_DURATION, gen),
				durationToMs(STEP_DURATION, DEFAULT_BPM)
			)
		);
	};

	// First Tone preview of the session: start the chain clock only once audio is up, or a slow
	// startup lets the candidate's timer catch the context chord and both attack together.
	if (!shouldUseMIDI() && !isPreviewAudioReady()) {
		void initPreviewAudio()
			.then(() => {
				if (gen === generation) playChain();
			})
			.catch((error: unknown) => {
				if (gen !== generation) return;
				cancelAudition();
				auditionErrorHandler?.(error);
			});
		return 'played';
	}

	playChain();
	return 'played';
}

/**
 * Audition raw notes, for previews that are not a candidate for a slot (per-chord play buttons,
 * palette cards, the saved-progression walkthrough).
 * @param midiNotes - Notes to sound
 * @param duration - Duration in Tone.js notation
 * @returns 'suppressed' while a transport is running, 'played' otherwise
 */
export function auditionNotes(
	midiNotes: number[],
	duration: string = STEP_DURATION
): AuditionResult {
	if (isTransportActive()) return 'suppressed';

	cancelAudition();
	playStep(midiNotes, duration, generation);
	return 'played';
}

/**
 * Walk a list of audition steps under one controller-owned generation.
 * The returned cancellation is scoped: after another audition takes ownership it becomes a no-op.
 */
export function startAuditionSequence(
	steps: (number[] | null)[],
	stepDurationMs: number,
	onComplete: () => void
): AuditionSequenceHandle {
	if (isTransportActive()) {
		onComplete();
		return { cancel: () => undefined };
	}

	cancelAudition();
	const gen = generation;
	const token = Symbol('audition-sequence');
	activeSequence = { token, stepToken: null, onComplete };

	function finish(): void {
		if (gen !== generation || activeSequence?.token !== token) return;
		if (sequenceTimeoutId !== null) {
			clearTimeout(sequenceTimeoutId);
			sequenceTimeoutId = null;
		}
		clearCurrentAuditionOutput();
		activeSequence = null;
		onComplete();
	}

	function playSequenceStep(index: number): void {
		if (gen !== generation || activeSequence?.token !== token) return;
		clearCurrentAuditionOutput();
		if (index >= steps.length) {
			finish();
			return;
		}

		const stepToken = Symbol('audition-sequence-step');
		activeSequence.stepToken = stepToken;
		const notes = steps[index];
		if (notes) playStep(notes, STEP_DURATION, gen, stepToken);
		sequenceTimeoutId = setTimeout(() => playSequenceStep(index + 1), stepDurationMs);
	}

	playSequenceStep(0);
	return {
		cancel: () => {
			if (gen === generation && activeSequence?.token === token) cancelAudition();
		}
	};
}
