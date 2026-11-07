/**
 * Startup MIDI restore: output and clock sync are enabled independently, so each is restored on
 * its own saved flag and either one is enough to request MIDI access.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MIDISettings } from '#lib/utils/midi-settings-persistence.ts';

const mocks = vi.hoisted(() => ({
	requestMIDIAccess: vi.fn(async () => ({}) as MIDIAccess),
	loadMIDISettings: vi.fn(),
	loadMIDIClockSettings: vi.fn(),
	connectMIDIOutput: vi.fn(),
	refreshMIDIDevices: vi.fn(),
	startClockSync: vi.fn(),
	initProgressionDB: vi.fn(async () => {})
}));

vi.mock('#lib/utils/progression-persistence.ts', () => ({
	initProgressionDB: mocks.initProgressionDB,
	getProgressions: vi.fn(async () => [])
}));
vi.mock('#lib/utils/midi-output.ts', () => ({
	isMIDISupported: vi.fn(() => true),
	requestMIDIAccess: mocks.requestMIDIAccess
}));
vi.mock('#lib/utils/midi-settings-persistence.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/utils/midi-settings-persistence.ts')>()),
	loadMIDISettings: mocks.loadMIDISettings
}));
vi.mock('#lib/utils/midi-clock-persistence.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/utils/midi-clock-persistence.ts')>()),
	loadMIDIClockSettings: mocks.loadMIDIClockSettings
}));
vi.mock('#lib/utils/midi-connection.ts', () => ({
	connectMIDIOutput: mocks.connectMIDIOutput,
	refreshMIDIDevices: mocks.refreshMIDIDevices,
	startClockSync: mocks.startClockSync
}));

import { flushSync } from 'svelte';
import { initializeApplication } from '#lib/app-init.ts';
import { stopSettingsAutosave } from '#lib/stores/settings-autosave.svelte.ts';
import { setPianoVisible, settingsState } from '#lib/stores/settings.svelte.ts';
import { loadPianoSettings } from '#lib/utils/piano-settings-persistence.ts';

// initializeApplication starts settings autosave; the page stops it on unmount, and so do the tests
afterEach(() => stopSettingsAutosave());

function midiSettings(enabled: boolean): MIDISettings {
	return {
		enabled,
		selectedDeviceId: 'out-1',
		hasSeenSetupModal: true,
		midiChannel: 1,
		velocity: 100,
		strumEnabled: false
	};
}

describe('initializeApplication MIDI restore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	it('restores clock sync when output is disabled', async () => {
		mocks.loadMIDISettings.mockReturnValue(midiSettings(false));
		mocks.loadMIDIClockSettings.mockReturnValue({ enabled: true, selectedInputId: 'in-1' });

		await initializeApplication();

		expect(mocks.requestMIDIAccess).toHaveBeenCalledTimes(1);
		expect(mocks.refreshMIDIDevices).toHaveBeenCalledWith({ inputs: true });
		expect(mocks.startClockSync).toHaveBeenCalledWith('in-1');
		expect(mocks.connectMIDIOutput).not.toHaveBeenCalled();
	});

	it('restores output without clock sync', async () => {
		mocks.loadMIDISettings.mockReturnValue(midiSettings(true));
		mocks.loadMIDIClockSettings.mockReturnValue({ enabled: false, selectedInputId: 'in-1' });

		await initializeApplication();

		expect(mocks.connectMIDIOutput).toHaveBeenCalledWith('out-1');
		expect(mocks.startClockSync).not.toHaveBeenCalled();
	});

	it('does not request access when neither is enabled', async () => {
		mocks.loadMIDISettings.mockReturnValue(midiSettings(false));
		mocks.loadMIDIClockSettings.mockReturnValue({ enabled: false, selectedInputId: null });

		await initializeApplication();

		expect(mocks.requestMIDIAccess).not.toHaveBeenCalled();
	});
});

describe('initializeApplication preferences', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		mocks.loadMIDISettings.mockReturnValue(midiSettings(false));
		mocks.loadMIDIClockSettings.mockReturnValue({ enabled: false, selectedInputId: null });
	});

	it('keeps a preference changed while saved progressions are still loading', async () => {
		let finishDB!: () => void;
		mocks.initProgressionDB.mockImplementationOnce(
			() => new Promise<void>((resolve) => (finishDB = resolve))
		);

		const started = initializeApplication();
		// The controls are live during the IndexedDB wait
		setPianoVisible(true);
		flushSync();

		finishDB();
		await started;
		flushSync();

		expect(settingsState.pianoKeyboard.visible).toBe(true);
		expect(loadPianoSettings()).toEqual({ visible: true });
	});
});
