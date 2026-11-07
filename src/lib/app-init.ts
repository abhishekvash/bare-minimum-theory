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
import { loadMIDISettings, type MIDISettings } from '#lib/utils/midi-settings-persistence.ts';
import {
	loadMIDIClockSettings,
	type MIDIClockSettings
} from '#lib/utils/midi-clock-persistence.ts';
import { startSettingsAutosave } from '#lib/stores/settings-autosave.svelte.ts';
import {
	connectMIDIOutput,
	refreshMIDIDevices,
	startClockSync
} from '#lib/utils/midi-connection.ts';

export async function initializeApplication(): Promise<void> {
	// 1. Preferences (localStorage) first, synchronously: the controls are interactive while the
	// awaits below run, and a change made then must not be overwritten by a late load
	initRandomizeOptions(loadRandomizeSettings());
	initPreviewOptions(loadPreviewSettings());
	initPianoSettings(loadPianoSettings());

	// MIDI preferences load even where Web MIDI is missing: they are plain localStorage, and
	// loading them keeps autosave from overwriting them with defaults on that browser
	const midiSettings = loadMIDISettings();
	initMIDISettings(midiSettings);
	const clockSettings = loadMIDIClockSettings();
	initMIDIClockSettings(clockSettings);

	// Every preference is in its store now, so changes from here on save themselves. Starting
	// before the first await also means the page's cleanup can always stop it.
	startSettingsAutosave();

	// 2. Saved progressions (IndexedDB)
	try {
		await initProgressionDB();
		initSavedProgressions(await getProgressions());
	} catch (error) {
		console.error('Failed to initialize saved progressions:', error);
	}

	// 3. Restore MIDI connections (if supported)
	const midiSupported = isMIDISupported();
	setMIDISupported(midiSupported);

	if (midiSupported) {
		await restoreMIDIConnections(midiSettings, clockSettings);
	}
}

async function restoreMIDIConnections(
	midiSettings: MIDISettings,
	clockSettings: MIDIClockSettings
): Promise<void> {
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
