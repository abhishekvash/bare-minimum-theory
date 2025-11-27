import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the Web MIDI API
const mockSend = vi.fn();
const mockMIDIOutput = {
	id: 'test-output-1',
	name: 'Test MIDI Output',
	state: 'connected',
	send: mockSend
};

const mockMIDIOutput2 = {
	id: 'test-output-2',
	name: 'Second MIDI Output',
	state: 'connected',
	send: vi.fn()
};

const mockOutputsMap = new Map<string, typeof mockMIDIOutput>([
	['test-output-1', mockMIDIOutput],
	['test-output-2', mockMIDIOutput2]
]);

const mockMIDIAccess = {
	outputs: mockOutputsMap,
	onstatechange: null as ((e: unknown) => void) | null
};

// Store original navigator
const originalNavigator = global.navigator;

describe('midi-output', () => {
	beforeEach(() => {
		vi.resetModules();
		mockSend.mockClear();

		// Mock navigator with MIDI support
		Object.defineProperty(global, 'navigator', {
			value: {
				userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
				requestMIDIAccess: vi.fn().mockResolvedValue(mockMIDIAccess)
			},
			writable: true,
			configurable: true
		});
	});

	afterEach(() => {
		Object.defineProperty(global, 'navigator', {
			value: originalNavigator,
			writable: true,
			configurable: true
		});
	});

	describe('isMIDISupported', () => {
		it('returns true when requestMIDIAccess is available', async () => {
			const { isMIDISupported } = await import('$lib/utils/midi-output');
			expect(isMIDISupported()).toBe(true);
		});

		it('returns false for Safari browser', async () => {
			Object.defineProperty(global, 'navigator', {
				value: {
					userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
					requestMIDIAccess: vi.fn()
				},
				writable: true,
				configurable: true
			});

			vi.resetModules();
			const { isMIDISupported } = await import('$lib/utils/midi-output');
			expect(isMIDISupported()).toBe(false);
		});

		it('returns false when requestMIDIAccess is not available', async () => {
			Object.defineProperty(global, 'navigator', {
				value: {
					userAgent: 'Mozilla/5.0 Chrome/120.0.0.0'
					// No requestMIDIAccess
				},
				writable: true,
				configurable: true
			});

			vi.resetModules();
			const { isMIDISupported } = await import('$lib/utils/midi-output');
			expect(isMIDISupported()).toBe(false);
		});
	});

	describe('requestMIDIAccess', () => {
		it('requests MIDI access with sysex disabled', async () => {
			const { requestMIDIAccess } = await import('$lib/utils/midi-output');
			const access = await requestMIDIAccess();

			expect(navigator.requestMIDIAccess).toHaveBeenCalledWith({ sysex: false });
			expect(access).toBe(mockMIDIAccess);
		});

		it('returns null when MIDI is not supported', async () => {
			Object.defineProperty(global, 'navigator', {
				value: {
					userAgent: 'Mozilla/5.0 Safari/605.1.15'
				},
				writable: true,
				configurable: true
			});

			vi.resetModules();
			const { requestMIDIAccess } = await import('$lib/utils/midi-output');
			const access = await requestMIDIAccess();

			expect(access).toBeNull();
		});

		it('returns null when permission is denied', async () => {
			Object.defineProperty(global, 'navigator', {
				value: {
					userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
					requestMIDIAccess: vi.fn().mockRejectedValue(new Error('Permission denied'))
				},
				writable: true,
				configurable: true
			});

			vi.resetModules();
			const { requestMIDIAccess } = await import('$lib/utils/midi-output');
			const access = await requestMIDIAccess();

			expect(access).toBeNull();
		});
	});

	describe('getMIDIOutputs', () => {
		it('returns empty array when no MIDI access', async () => {
			const { getMIDIOutputs } = await import('$lib/utils/midi-output');
			const outputs = getMIDIOutputs();
			expect(outputs).toEqual([]);
		});

		it('returns list of outputs after requesting access', async () => {
			const { requestMIDIAccess, getMIDIOutputs } = await import('$lib/utils/midi-output');
			await requestMIDIAccess();

			const outputs = getMIDIOutputs();
			expect(outputs).toHaveLength(2);
			expect(outputs[0]).toEqual({ id: 'test-output-1', name: 'Test MIDI Output' });
			expect(outputs[1]).toEqual({ id: 'test-output-2', name: 'Second MIDI Output' });
		});
	});

	describe('selectMIDIOutput', () => {
		it('returns false when no MIDI access', async () => {
			const { selectMIDIOutput } = await import('$lib/utils/midi-output');
			const success = selectMIDIOutput('test-output-1');
			expect(success).toBe(false);
		});

		it('returns true when selecting a valid output', async () => {
			const { requestMIDIAccess, selectMIDIOutput } = await import('$lib/utils/midi-output');
			await requestMIDIAccess();

			const success = selectMIDIOutput('test-output-1');
			expect(success).toBe(true);
		});

		it('returns false when selecting an invalid output', async () => {
			const { requestMIDIAccess, selectMIDIOutput } = await import('$lib/utils/midi-output');
			await requestMIDIAccess();

			const success = selectMIDIOutput('nonexistent-output');
			expect(success).toBe(false);
		});
	});

	describe('isConnected', () => {
		it('returns false when no output is selected', async () => {
			const { requestMIDIAccess, isConnected } = await import('$lib/utils/midi-output');
			await requestMIDIAccess();

			expect(isConnected()).toBe(false);
		});

		it('returns true when output is selected and connected', async () => {
			const { requestMIDIAccess, selectMIDIOutput, isConnected } = await import(
				'$lib/utils/midi-output'
			);
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');

			expect(isConnected()).toBe(true);
		});
	});

	describe('sendNoteOn', () => {
		it('sends correct MIDI note on message', async () => {
			const { requestMIDIAccess, selectMIDIOutput, sendNoteOn } = await import(
				'$lib/utils/midi-output'
			);
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');

			sendNoteOn(60, 100, 0);

			expect(mockSend).toHaveBeenCalledWith([0x90, 60, 100]);
		});

		it('uses default velocity and channel', async () => {
			const { requestMIDIAccess, selectMIDIOutput, sendNoteOn } = await import(
				'$lib/utils/midi-output'
			);
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');

			sendNoteOn(64);

			expect(mockSend).toHaveBeenCalledWith([0x90, 64, 100]); // Default velocity 100
		});

		it('clamps note values to valid MIDI range', async () => {
			const { requestMIDIAccess, selectMIDIOutput, sendNoteOn } = await import(
				'$lib/utils/midi-output'
			);
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');

			sendNoteOn(200, 100, 0); // Note > 127

			expect(mockSend).toHaveBeenCalledWith([0x90, 127, 100]);
		});

		it('does nothing when no output is selected', async () => {
			const { requestMIDIAccess, sendNoteOn } = await import('$lib/utils/midi-output');
			await requestMIDIAccess();

			sendNoteOn(60, 100, 0);

			expect(mockSend).not.toHaveBeenCalled();
		});
	});

	describe('sendNoteOff', () => {
		it('sends correct MIDI note off message', async () => {
			const { requestMIDIAccess, selectMIDIOutput, sendNoteOff } = await import(
				'$lib/utils/midi-output'
			);
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');

			sendNoteOff(60, 0);

			expect(mockSend).toHaveBeenCalledWith([0x80, 60, 0]);
		});
	});

	describe('stopAllMIDI', () => {
		it('sends all notes off on all channels', async () => {
			const { requestMIDIAccess, selectMIDIOutput, stopAllMIDI } = await import(
				'$lib/utils/midi-output'
			);
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');

			stopAllMIDI();

			// Should send CC 123 (All Notes Off) on all 16 channels
			expect(mockSend).toHaveBeenCalledTimes(16);
			expect(mockSend).toHaveBeenCalledWith([0xb0, 123, 0]); // Channel 0
			expect(mockSend).toHaveBeenCalledWith([0xbf, 123, 0]); // Channel 15
		});
	});

	describe('getSelectedOutputId', () => {
		it('returns null when no output is selected', async () => {
			const { getSelectedOutputId } = await import('$lib/utils/midi-output');
			expect(getSelectedOutputId()).toBeNull();
		});

		it('returns the ID of the selected output', async () => {
			const { requestMIDIAccess, selectMIDIOutput, getSelectedOutputId } = await import(
				'$lib/utils/midi-output'
			);
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');

			expect(getSelectedOutputId()).toBe('test-output-1');
		});
	});

	describe('disposeMIDI', () => {
		it('clears selected output and stops all MIDI', async () => {
			const { requestMIDIAccess, selectMIDIOutput, disposeMIDI, getSelectedOutputId, isConnected } =
				await import('$lib/utils/midi-output');
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');

			disposeMIDI();

			expect(getSelectedOutputId()).toBeNull();
			expect(isConnected()).toBe(false);
		});
	});
});
