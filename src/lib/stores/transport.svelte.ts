/**
 * Transport Commands
 * The application's play/stop policy on top of `audio-playback.ts`, which owns the low-level
 * transport lifecycle: which tempo to start at, what a failed start tells the user, and how the
 * canvas follows a DAW's Start/Stop (as events from the clock listener, not effect-detected edges). The page (keyboard shortcuts, MIDI failures, loading) and
 * the canvas (its play/stop buttons) both issue commands here instead of reaching into each other.
 */

import { toast } from 'svelte-sonner';
import { progressionState } from '#lib/stores/progression.svelte.ts';
import { hasNonNullChords } from '#lib/utils/theory-engine/index.ts';
import {
	midiState,
	setClockReceivingState,
	setExternalPlayingState
} from '#lib/stores/midi.svelte.ts';
import { uiState } from '#lib/stores/ui.svelte.ts';
import {
	getCurrentBpm,
	getTransportStatus,
	startLoopingPlayback,
	stopLoopingPlayback
} from '#lib/utils/audio-playback.ts';
import { cancelAudition } from '#lib/utils/audition-controller.ts';

/**
 * Tempo to start at: the DAW's detected clock when sync is on and a tempo has been detected,
 * otherwise the default
 */
export function getActiveBpm(): number {
	const { clockSync } = midiState;
	if (clockSync.enabled && clockSync.detectedBpm !== null) {
		return clockSync.detectedBpm;
	}
	return getCurrentBpm();
}

/**
 * Start looping the canvas progression. A no-op unless the transport is stopped. A failed start
 * is reported to the user and leaves the transport stopped.
 */
export async function startProgressionPlayback(): Promise<void> {
	if (getTransportStatus() !== 'stopped') return;
	// While the DAW's clock is arriving it owns start: a local start (Space, the button) must not
	// play over a stopped DAW. A DAW Start reaches here with isExternallyPlaying already true.
	if (isFollowingDaw() && !midiState.clockSync.isExternallyPlaying) return;
	if (!hasNonNullChords(progressionState.progression)) return;

	// The loop becomes the only sound source: kill any preview tail before it starts
	cancelAudition();
	try {
		await startLoopingPlayback(() => progressionState.progression, getActiveBpm());
	} catch (error) {
		// audio-playback only rethrows for the start that still owns the transport
		console.error('Failed to start playback:', error);
		toast.error('Failed to play progression', {
			description: 'Please check your audio settings and try again.'
		});
		stopLoopingPlayback();
	}
}

/** Stop the progression loop */
export function stopProgressionPlayback(): void {
	stopLoopingPlayback();
	cancelAudition();
}

// ============================================================================
// DAW transport following
// ============================================================================

/**
 * A DAW Start that has not been honoured yet: it arrived before clock ticks did, or while the
 * canvas was empty. Reactive so the canvas can watch for its first chord only while armed.
 */
const dawStart = $state({ armed: false });

/** Whether the canvas mirrors the DAW: sync is on and clock messages are genuinely arriving */
function isFollowingDaw(): boolean {
	const { clockSync } = midiState;
	return clockSync.enabled && clockSync.isReceivingClock;
}

function isTransportRunning(): boolean {
	return uiState.transportActive || getTransportStatus() !== 'stopped';
}

/** Start the loop for a pending DAW Start, if the DAW is being followed and there is a chord */
function honourArmedDawStart(): void {
	if (!dawStart.armed || !isFollowingDaw()) return;
	// Already playing: the Start is satisfied, so a later local Stop stays stopped
	if (isTransportRunning()) {
		dawStart.armed = false;
		return;
	}
	if (!hasNonNullChords(progressionState.progression)) return;
	dawStart.armed = false;
	void startProgressionPlayback();
}

/**
 * A MIDI Start/Continue or Stop from the DAW. Each Start is its own event: one arriving after a
 * local Stop starts the loop again, even if no Stop came in between.
 */
export function handleDawTransport(command: 'start' | 'stop'): void {
	setExternalPlayingState(command === 'start');
	if (command === 'start') {
		dawStart.armed = true;
		honourArmedDawStart();
		return;
	}
	dawStart.armed = false;
	if (isFollowingDaw() && isTransportRunning()) stopProgressionPlayback();
}

/**
 * Clock ticks started or stopped arriving. Enabled-but-waiting still permits local transport;
 * the DAW only owns start/stop once its clock is really there.
 */
export function handleDawClockReceiving(isReceiving: boolean): void {
	setClockReceivingState(isReceiving);
	if (!isReceiving) {
		setExternalPlayingState(false);
		dawStart.armed = false;
		return;
	}
	if (!isFollowingDaw()) return;
	// An arriving clock whose transport is stopped stops a loop that was started locally
	if (!midiState.clockSync.isExternallyPlaying) {
		if (isTransportRunning()) stopProgressionPlayback();
		return;
	}
	honourArmedDawStart();
}

/** Forget any pending DAW Start (clock listener torn down, sync disabled) */
export function resetDawTransport(): void {
	dawStart.armed = false;
}

/**
 * Canvas side of DAW following. Call during component initialisation: while a DAW Start is
 * armed on an empty canvas, the first chord to land starts the loop. The effect only reads the
 * progression while armed, so ordinary edits do not re-run it.
 */
export function followDawStartOnCanvas(): void {
	$effect(() => {
		if (!dawStart.armed) return;
		if (hasNonNullChords(progressionState.progression)) honourArmedDawStart();
	});
}
