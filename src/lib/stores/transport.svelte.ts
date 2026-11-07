/**
 * Transport Commands
 * The application's play/stop policy on top of `audio-playback.ts`, which owns the low-level
 * transport lifecycle: which tempo to start at, what a failed start tells the user, and how the
 * canvas follows a DAW's Start/Stop. The page (keyboard shortcuts, MIDI failures, loading) and
 * the canvas (its play/stop buttons) both issue commands here instead of reaching into each other.
 */

import { toast } from 'svelte-sonner';
import { progressionState } from '#lib/stores/progression.svelte.ts';
import { hasNonNullChords } from '#lib/utils/theory-engine/index.ts';
import { midiState } from '#lib/stores/midi.svelte.ts';
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

/**
 * Follow the DAW's transport while clock sync is receiving: a DAW Start starts the loop (staying
 * armed until the canvas has a chord), a DAW Stop stops it.
 * @returns Cleanup that stops following
 */
export function initDawTransportSync(): () => void {
	// DAW Start is an event, not a level. Plain (non-reactive) state so only real transport
	// transitions arm a start: a local Stop or a failed MIDI start must not be undone by the
	// DAW still reporting "playing".
	let wasExternallyPlaying = false;
	let awaitingDawStart = false;

	return $effect.root(() => {
		$effect(() => {
			const { clockSync } = midiState;
			// Enabled-but-waiting still permits local transport. The DAW mirror owns start/stop
			// only while clock messages are genuinely arriving.
			if (!clockSync.enabled || !clockSync.isReceivingClock) {
				wasExternallyPlaying = false;
				awaitingDawStart = false;
				return;
			}

			const externallyPlaying = clockSync.isExternallyPlaying;
			if (externallyPlaying && !wasExternallyPlaying) awaitingDawStart = true;
			wasExternallyPlaying = externallyPlaying;

			const isPlaying = uiState.transportActive || getTransportStatus() !== 'stopped';
			if (externallyPlaying) {
				// Already playing: the Start is satisfied, so a later local Stop stays stopped.
				if (isPlaying) awaitingDawStart = false;
				// An empty progression keeps the start armed until the first chord lands.
				else if (awaitingDawStart && hasNonNullChords(progressionState.progression)) {
					awaitingDawStart = false;
					startProgressionPlayback();
				}
			} else {
				awaitingDawStart = false;
				if (isPlaying) stopProgressionPlayback();
			}
		});
	});
}
