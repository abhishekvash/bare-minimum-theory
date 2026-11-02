/**
 * MIDI Connection Workflow
 * The steps that get MIDI output connected and keep the saved preferences in step with the
 * store: asking for access, refreshing the device lists, connecting the chosen output, following
 * the DAW clock, and persisting. Startup, the MIDI toggle, the setup modal and Settings all use
 * these instead of each re-sequencing the low-level calls.
 *
 * Sits above both `midi-output.ts` and the MIDI store; it cannot live in the store because
 * `midi-output.ts` already imports the store.
 */

import {
	midiState,
	setMIDIConnectionState,
	setMIDIError,
	setMIDIHasSeenSetupModal,
	setMIDIPermissionGranted,
	updateMIDIInputs,
	updateMIDIOutputs
} from '$lib/stores/midi.svelte';
import {
	getMIDIAccess,
	getMIDIInputs,
	getMIDIOutputs,
	isConnected,
	requestMIDIAccess,
	selectMIDIOutput
} from '$lib/utils/midi-output';
import { saveMIDISettings, type MIDISettings } from '$lib/utils/midi-settings-persistence';
import { initMIDIClock, selectMIDIInput } from '$lib/utils/midi-clock';
import { setupClockListener } from '$lib/utils/midi-clock-listener';

/** The persisted part of the MIDI store */
function snapshotMIDISettings(): MIDISettings {
	const { enabled, selectedDeviceId, hasSeenSetupModal, midiChannel, velocity, strumEnabled } =
		midiState;
	return { enabled, selectedDeviceId, hasSeenSetupModal, midiChannel, velocity, strumEnabled };
}

/** Save the MIDI store's current preferences */
export function persistMIDISettings(): void {
	saveMIDISettings(snapshotMIDISettings());
}

/** Record that the first-run setup has been seen, and save */
export function markMIDISetupSeen(): void {
	setMIDIHasSeenSetupModal(true);
	persistMIDISettings();
}

/**
 * Ask for MIDI access unless it was already granted this session
 * @returns Whether access is available; a refusal is recorded as `permission_denied`
 */
export async function ensureMIDIAccess(): Promise<boolean> {
	if (midiState.permissionGranted) return true;

	const access = await requestMIDIAccess();
	if (!access) {
		setMIDIError('permission_denied');
		return false;
	}
	setMIDIPermissionGranted(true);
	setMIDIError(null);
	return true;
}

/**
 * Re-read the available devices into the store
 * @param options.inputs - Also refresh clock inputs
 */
export function refreshMIDIDevices({ inputs = false }: { inputs?: boolean } = {}): void {
	updateMIDIOutputs(getMIDIOutputs());
	if (inputs) updateMIDIInputs(getMIDIInputs());
}

/**
 * Route MIDI output to a device and mirror the result in the store
 * @param deviceId - Output to connect
 * @returns Whether the output is now connected
 */
export function connectMIDIOutput(deviceId: string): boolean {
	const connected = selectMIDIOutput(deviceId) && isConnected();
	setMIDIConnectionState(connected);
	return connected;
}

/**
 * Refresh outputs and re-connect the saved device if it is present. A device that has gone away
 * leaves the output disconnected but keeps the saved id, so plugging it back in restores it.
 */
export function reconcileSelectedOutput(): void {
	refreshMIDIDevices();

	const { selectedDeviceId } = midiState;
	if (!selectedDeviceId) return;

	if (!midiState.outputs.some((output) => output.id === selectedDeviceId)) {
		setMIDIConnectionState(false);
	} else if (connectMIDIOutput(selectedDeviceId)) {
		setMIDIError(null);
	}
}

/**
 * Start following the DAW clock on an input. The listener is only attached when the input
 * could be selected.
 * @param inputId - Clock input to listen on
 */
export function startClockSync(inputId: string): void {
	const access = getMIDIAccess();
	if (access) initMIDIClock(access);
	if (selectMIDIInput(inputId)) setupClockListener();
}
