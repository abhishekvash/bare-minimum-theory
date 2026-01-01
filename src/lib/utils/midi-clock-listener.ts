/**
 * MIDI Clock Listener Helpers
 * Shared utilities for setting up MIDI clock sync listeners
 */

import {
	setClockReceivingState,
	setDetectedBpm,
	setExternalPlayingState
} from '$lib/stores/midi.svelte';
import {
	startClockListener as startRawClockListener,
	stopClockListener
} from '$lib/utils/midi-clock';
import { updatePlaybackTempo } from '$lib/utils/audio-playback';

/**
 * Start listening for MIDI clock signals with standard handlers.
 * This is the canonical way to set up clock sync - use this instead of
 * calling startClockListener directly with inline callbacks.
 *
 * Handles:
 * - BPM detection and tempo updates
 * - Clock receiving state
 * - External transport (start/stop) state
 */
export function setupClockListener(): void {
	startRawClockListener(
		(bpm) => {
			setDetectedBpm(bpm);
			updatePlaybackTempo(bpm);
		},
		(isReceiving) => {
			setClockReceivingState(isReceiving);
			if (!isReceiving) setExternalPlayingState(false);
		},
		(command) => setExternalPlayingState(command === 'start')
	);
}

/**
 * Stop listening for MIDI clock signals and reset state.
 */
export function teardownClockListener(): void {
	stopClockListener();
	setClockReceivingState(false);
	setDetectedBpm(null);
	setExternalPlayingState(false);
}
