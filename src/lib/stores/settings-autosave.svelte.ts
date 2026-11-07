/**
 * Settings Autosave
 * Every persisted preference lives in a store. Once the stored values have been loaded, this
 * watches each preference and writes it to localStorage whenever it changes, so no UI handler
 * has to remember to save (and none can forget to).
 */

import { midiState } from '#lib/stores/midi.svelte.ts';
import { settingsState } from '#lib/stores/settings.svelte.ts';
import { saveMIDIClockSettings } from '#lib/utils/midi-clock-persistence.ts';
import { saveMIDISettings, type MIDISettings } from '#lib/utils/midi-settings-persistence.ts';
import { savePianoSettings } from '#lib/utils/piano-settings-persistence.ts';
import { savePreviewSettings, saveRandomizeSettings } from '#lib/utils/settings-persistence.ts';

let stopAutosave: (() => void) | null = null;

/** The persisted part of the MIDI store (the rest is runtime: devices, connection, errors) */
function snapshotMIDISettings(): MIDISettings {
	const { enabled, selectedDeviceId, hasSeenSetupModal, midiChannel, velocity, strumEnabled } =
		midiState;
	return { enabled, selectedDeviceId, hasSeenSetupModal, midiChannel, velocity, strumEnabled };
}

/**
 * Start saving preferences as they change. Call only after the stored values have been loaded
 * into the stores: each preference is written once straight away, so starting earlier would
 * overwrite what the user saved with the defaults. Calling it again restarts it.
 */
export function startSettingsAutosave(): void {
	stopAutosave?.();
	stopAutosave = $effect.root(() => {
		// One effect per storage key, so a change rewrites only its own entry
		$effect(() => savePreviewSettings($state.snapshot(settingsState.previewOptions)));
		$effect(() => saveRandomizeSettings($state.snapshot(settingsState.randomizeOptions)));
		$effect(() => savePianoSettings({ visible: settingsState.pianoKeyboard.visible }));
		$effect(() => saveMIDISettings(snapshotMIDISettings()));
		$effect(() => {
			const { enabled, selectedInputId } = midiState.clockSync;
			saveMIDIClockSettings({ enabled, selectedInputId });
		});
	});
}

/** Stop saving preferences (page teardown) */
export function stopSettingsAutosave(): void {
	stopAutosave?.();
	stopAutosave = null;
}
