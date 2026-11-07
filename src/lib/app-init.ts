/**
 * Application Initialization Logic
 * Orchestrates the startup of various subsystems (Persistence, MIDI, Audio settings)
 */

import { initProgressionDB, getProgressions } from '#lib/utils/progression-persistence.ts';
import { initSavedProgressions } from '#lib/stores/progression.svelte.ts';
import { loadPreviewSettings, loadRandomizeSettings } from '#lib/utils/settings-persistence.ts';
import { loadPianoSettings } from '#lib/utils/piano-settings-persistence.ts';
import {
	initPianoSettings,
	initPreviewOptions,
	initRandomizeOptions
} from '#lib/stores/settings.svelte.ts';
import { isMIDISupported, requestMIDIAccess } from '#lib/utils/midi-output.ts';
import {
	setMIDISupported,
	setMIDIPermissionGranted,
	initMIDISettings,
	initMIDIClockSettings
} from '#lib/stores/midi.svelte.ts';
import { loadMIDISettings } from '#lib/utils/midi-settings-persistence.ts';
import { loadMIDIClockSettings } from '#lib/utils/midi-clock-persistence.ts';
import {
	connectMIDIOutput,
	refreshMIDIDevices,
	startClockSync
} from '#lib/utils/midi-connection.ts';

export async function initializeApplication(): Promise<void> {
	// 1. Load saved progressions (IndexedDB)
	try {
		await initProgressionDB();
		const savedProgressions = await getProgressions();
		initSavedProgressions(savedProgressions);
	} catch (error) {
		console.error('Failed to initialize saved progressions:', error);
	}

	// 2. Load UI Settings (localStorage)
	// Randomize options
	const savedRandomizeSettings = loadRandomizeSettings();
	initRandomizeOptions(savedRandomizeSettings);

	// Preview behaviour
	initPreviewOptions(loadPreviewSettings());

	// Piano visibility
	const pianoSettings = loadPianoSettings();
	initPianoSettings(pianoSettings);

	// 3. Initialize MIDI (if supported)
	const midiSupported = isMIDISupported();
	setMIDISupported(midiSupported);

	if (midiSupported) {
		await initializeMIDI();
	}
}

async function initializeMIDI(): Promise<void> {
	// Load saved MIDI settings
	const midiSettings = loadMIDISettings();
	initMIDISettings(midiSettings);

	// Load clock sync settings
	const clockSettings = loadMIDIClockSettings();
	initMIDIClockSettings(clockSettings);

	// Output and clock sync are enabled independently; either one needs MIDI access restored
	if (!midiSettings.enabled && !clockSettings.enabled) return;

	// Request access (might prompt user if not already granted permissions)
	// Note: On some browsers this might need a user gesture, but often it works if previously granted.
	const access = await requestMIDIAccess();
	if (!access) return;

	// Granted: a later toggle off/on must not ask again
	setMIDIPermissionGranted(true);

	// Inputs too, for clock sync
	refreshMIDIDevices({ inputs: true });

	// If MIDI output was enabled in previous session, try to reconnect to the saved device
	if (midiSettings.enabled && midiSettings.selectedDeviceId) {
		connectMIDIOutput(midiSettings.selectedDeviceId);
	}

	// If clock sync was enabled, try to restore it
	if (clockSettings.enabled && clockSettings.selectedInputId) {
		startClockSync(clockSettings.selectedInputId);
	}
}
