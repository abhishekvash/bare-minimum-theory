/**
 * Application Initialization Logic
 * Orchestrates the startup of various subsystems (Persistence, MIDI, Audio settings)
 */

import { initProgressionDB, getProgressions, getAllTags } from '$lib/utils/progression-persistence';
import {
    initSavedProgressions
} from '$lib/stores/progression.svelte';
import { loadRandomizeSettings } from '$lib/utils/settings-persistence';
import { loadPianoSettings } from '$lib/utils/piano-settings-persistence';
import { initPianoSettings, initRandomizeOptions } from '$lib/stores/settings.svelte';
import { isMIDISupported, requestMIDIAccess, getMIDIOutputs, getMIDIInputs, selectMIDIOutput, isConnected } from '$lib/utils/midi-output';
import { setMIDISupported, initMIDISettings, initMIDIClockSettings, updateMIDIOutputs, updateMIDIInputs, setMIDIConnectionState } from '$lib/stores/midi.svelte';
import { loadMIDISettings } from '$lib/utils/midi-settings-persistence';
import { loadMIDIClockSettings } from '$lib/utils/midi-clock-persistence';
import { initMIDIClock, selectMIDIInput } from '$lib/utils/midi-clock';
import { setupClockListener } from '$lib/utils/midi-clock-listener';

export async function initializeApplication(): Promise<void> {
    // 1. Load saved progressions (IndexedDB)
    try {
        await initProgressionDB();
        const savedProgressions = await getProgressions();
        const tags = await getAllTags();
        initSavedProgressions(savedProgressions, tags);
    } catch (error) {
        console.error('Failed to initialize saved progressions:', error);
    }

    // 2. Load UI Settings (localStorage)
    // Randomize options
    const savedRandomizeSettings = loadRandomizeSettings();
    initRandomizeOptions(savedRandomizeSettings);

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

    // If MIDI was enabled in previous session, try to restore connection
    if (midiSettings.enabled) {
        // Request access (might prompt user if not already granted permissions)
        // Note: On some browsers this might need a user gesture, but often it works if previously granted.
        const access = await requestMIDIAccess();

        if (access) {
            // Get available devices
            const outputs = getMIDIOutputs();
            updateMIDIOutputs(outputs);

            const inputs = getMIDIInputs();
            updateMIDIInputs(inputs);

            // Try to reconnect to saved output device
            if (midiSettings.selectedDeviceId) {
                const success = selectMIDIOutput(midiSettings.selectedDeviceId);
                setMIDIConnectionState(success && isConnected());
            }

            // If clock sync was enabled, try to restore it
            if (clockSettings.enabled && clockSettings.selectedInputId) {
                initMIDIClock(access);
                const inputSelected = selectMIDIInput(clockSettings.selectedInputId);

                if (inputSelected) {
                    setupClockListener();
                }
            }
        }
    }
}
