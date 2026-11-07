import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const output = vi.hoisted(() => ({
	getMIDIAccess: vi.fn((): object | null => ({})),
	getMIDIInputs: vi.fn(() => [{ id: 'in-1', name: 'Clock In' }]),
	getMIDIOutputs: vi.fn(() => [{ id: 'out-1', name: 'DAW' }]),
	isConnected: vi.fn(() => true),
	requestMIDIAccess: vi.fn(async (): Promise<object | null> => ({})),
	selectMIDIOutput: vi.fn(() => true)
}));
const clock = vi.hoisted(() => ({ initMIDIClock: vi.fn(), selectMIDIInput: vi.fn(() => true) }));
const listener = vi.hoisted(() => ({ setupClockListener: vi.fn() }));

vi.mock('#lib/utils/midi-output.ts', () => output);
vi.mock('#lib/utils/midi-clock.ts', () => clock);
vi.mock('#lib/utils/midi-clock-listener.ts', () => listener);

import {
	connectMIDIOutput,
	ensureMIDIAccess,
	markMIDISetupSeen,
	reconcileSelectedOutput,
	refreshMIDIDevices,
	startClockSync,
	switchMIDIOutput
} from '#lib/utils/midi-connection.ts';
import { playbackPort } from '#lib/utils/playback-port.ts';
import {
	initMIDISettings,
	midiState,
	setMIDIConnectionState,
	setMIDIDevice,
	setMIDIError,
	setMIDIPermissionGranted,
	updateMIDIInputs,
	updateMIDIOutputs
} from '#lib/stores/midi.svelte.ts';
import { DEFAULT_MIDI_SETTINGS } from '#lib/utils/midi-settings-persistence.ts';

describe('midi-connection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		initMIDISettings({ ...DEFAULT_MIDI_SETTINGS });
		setMIDIPermissionGranted(false);
		setMIDIConnectionState(false);
		setMIDIError(null);
		updateMIDIOutputs([]);
		updateMIDIInputs([]);
	});

	describe('persistence', () => {
		it('markMIDISetupSeen sets the setup flag (settings autosave persists it)', () => {
			markMIDISetupSeen();
			expect(midiState.hasSeenSetupModal).toBe(true);
		});
	});

	describe('ensureMIDIAccess', () => {
		it('does not ask again once granted', async () => {
			setMIDIPermissionGranted(true);
			expect(await ensureMIDIAccess()).toBe(true);
			expect(output.requestMIDIAccess).not.toHaveBeenCalled();
		});

		it('records the grant and clears any error', async () => {
			setMIDIError('permission_denied');
			expect(await ensureMIDIAccess()).toBe(true);
			expect(midiState.permissionGranted).toBe(true);
			expect(midiState.error).toBeNull();
		});

		it('records a refusal as permission_denied', async () => {
			output.requestMIDIAccess.mockResolvedValueOnce(null);
			expect(await ensureMIDIAccess()).toBe(false);
			expect(midiState.permissionGranted).toBe(false);
			expect(midiState.error).toBe('permission_denied');
		});
	});

	describe('refreshMIDIDevices', () => {
		it('refreshes outputs only by default', () => {
			refreshMIDIDevices();
			expect(midiState.outputs).toEqual([{ id: 'out-1', name: 'DAW' }]);
			expect(output.getMIDIInputs).not.toHaveBeenCalled();
		});

		it('refreshes inputs when asked', () => {
			refreshMIDIDevices({ inputs: true });
			expect(midiState.inputs).toEqual([{ id: 'in-1', name: 'Clock In' }]);
		});
	});

	describe('connectMIDIOutput', () => {
		it('mirrors a successful connection', () => {
			expect(connectMIDIOutput('out-1')).toBe(true);
			expect(midiState.isConnected).toBe(true);
		});

		it('mirrors a failed selection', () => {
			output.selectMIDIOutput.mockReturnValueOnce(false);
			expect(connectMIDIOutput('missing')).toBe(false);
			expect(midiState.isConnected).toBe(false);
		});
	});

	describe('switchMIDIOutput', () => {
		const originalInterrupt = playbackPort.interruptAudition;
		afterEach(() => {
			playbackPort.interruptAudition = originalInterrupt;
			output.selectMIDIOutput.mockImplementation(() => true);
		});

		/** Record the order of audition interrupts and output selections */
		function trackCalls(): string[] {
			const calls: string[] = [];
			playbackPort.interruptAudition = () => calls.push('interrupt');
			output.selectMIDIOutput.mockImplementation(((id: string) => {
				calls.push(`select:${id}`);
				return true;
			}) as () => boolean);
			return calls;
		}

		it('ends the audition before routing to a different output', () => {
			setMIDIDevice('out-1');
			setMIDIConnectionState(true);
			const calls = trackCalls();

			switchMIDIOutput('out-2');

			expect(calls).toEqual(['interrupt', 'select:out-2']);
			expect(midiState.selectedDeviceId).toBe('out-2');
			expect(midiState.isConnected).toBe(true);
		});

		it('leaves the audition alone when the same output is picked again', () => {
			setMIDIDevice('out-1');
			setMIDIConnectionState(true);
			const calls = trackCalls();

			switchMIDIOutput('out-1');

			expect(calls).toEqual(['select:out-1']);
		});

		it('clears the selection and disconnects for no device', () => {
			setMIDIDevice('out-1');
			setMIDIConnectionState(true);
			const calls = trackCalls();

			switchMIDIOutput(null);

			expect(calls).toEqual(['interrupt']);
			expect(midiState.selectedDeviceId).toBeNull();
			expect(midiState.isConnected).toBe(false);
		});
	});

	describe('reconcileSelectedOutput', () => {
		it('reconnects the saved device when present and clears the error', () => {
			setMIDIDevice('out-1');
			setMIDIError('disconnected');
			reconcileSelectedOutput();
			expect(output.selectMIDIOutput).toHaveBeenCalledWith('out-1');
			expect(midiState.isConnected).toBe(true);
			expect(midiState.error).toBeNull();
		});

		it('disconnects but keeps the saved id when the device is gone', () => {
			setMIDIDevice('gone');
			setMIDIConnectionState(true);
			reconcileSelectedOutput();
			expect(output.selectMIDIOutput).not.toHaveBeenCalled();
			expect(midiState.isConnected).toBe(false);
			expect(midiState.selectedDeviceId).toBe('gone');
		});

		it('only refreshes when no device is saved', () => {
			reconcileSelectedOutput();
			expect(midiState.outputs).toHaveLength(1);
			expect(output.selectMIDIOutput).not.toHaveBeenCalled();
		});
	});

	describe('startClockSync', () => {
		it('listens once the input is selected', () => {
			startClockSync('in-1');
			expect(clock.initMIDIClock).toHaveBeenCalled();
			expect(clock.selectMIDIInput).toHaveBeenCalledWith('in-1');
			expect(listener.setupClockListener).toHaveBeenCalled();
		});

		it('does not listen when the input cannot be selected', () => {
			clock.selectMIDIInput.mockReturnValueOnce(false);
			startClockSync('missing');
			expect(listener.setupClockListener).not.toHaveBeenCalled();
		});
	});
});
