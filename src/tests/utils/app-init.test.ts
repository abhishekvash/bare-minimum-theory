/**
 * Startup MIDI restore: output and clock sync are enabled independently, so each is restored on
 * its own saved flag and either one is enough to request MIDI access.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MIDISettings } from '$lib/utils/midi-settings-persistence';

const mocks = vi.hoisted(() => ({
	requestMIDIAccess: vi.fn(async () => ({}) as MIDIAccess),
	loadMIDISettings: vi.fn(),
	loadMIDIClockSettings: vi.fn(),
	connectMIDIOutput: vi.fn(),
	refreshMIDIDevices: vi.fn(),
	startClockSync: vi.fn()
}));

vi.mock('$lib/utils/progression-persistence', () => ({
	initProgressionDB: vi.fn(async () => {}),
	getProgressions: vi.fn(async () => []),
	getAllTags: vi.fn(async () => [])
}));
vi.mock('$lib/utils/midi-output', () => ({
	isMIDISupported: vi.fn(() => true),
	requestMIDIAccess: mocks.requestMIDIAccess
}));
vi.mock('$lib/utils/midi-settings-persistence', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/utils/midi-settings-persistence')>()),
	loadMIDISettings: mocks.loadMIDISettings
}));
vi.mock('$lib/utils/midi-clock-persistence', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/utils/midi-clock-persistence')>()),
	loadMIDIClockSettings: mocks.loadMIDIClockSettings
}));
vi.mock('$lib/utils/midi-connection', () => ({
	connectMIDIOutput: mocks.connectMIDIOutput,
	refreshMIDIDevices: mocks.refreshMIDIDevices,
	startClockSync: mocks.startClockSync
}));

import { initializeApplication } from '$lib/app-init';

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
