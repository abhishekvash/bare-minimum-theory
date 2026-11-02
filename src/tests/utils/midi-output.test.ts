import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Chord, ChordDuration } from '$lib/utils/theory-engine';

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
		mockSend.mockReset();
		mockMIDIOutput.state = 'connected';
		mockMIDIOutput2.state = 'connected';
		mockMIDIAccess.onstatechange = null;

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
		vi.useRealTimers();
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

	describe('send failures', () => {
		it('reports selected-output loss immediately while MIDI owns the loop', async () => {
			const {
				requestMIDIAccess,
				selectMIDIOutput,
				onMIDIError,
				onStateChange,
				isConnected,
				startMIDILoop
			} = await import('$lib/utils/midi-output');
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');
			const progression: Chord[] = [
				{ root: 60, quality: '', inversion: 0, voicing: 'close', octave: 0, duration: '1m' }
			];
			startMIDILoop(() => progression, 120);
			const errorHandler = vi.fn();
			const stateHandler = vi.fn();
			onMIDIError(errorHandler);
			onStateChange(stateHandler);
			mockMIDIOutput.state = 'disconnected';

			mockMIDIAccess.onstatechange?.({ port: mockMIDIOutput });

			expect(errorHandler).toHaveBeenCalledWith({
				kind: 'connection',
				error: expect.any(Error)
			});
			expect(stateHandler).toHaveBeenCalledOnce();
			expect(isConnected()).toBe(false);
		});

		it('does not stop unrelated playback when a disabled MIDI output disconnects', async () => {
			const { setMIDIEnabled } = await import('$lib/stores/midi.svelte');
			const { requestMIDIAccess, selectMIDIOutput, onMIDIError } = await import(
				'$lib/utils/midi-output'
			);
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');
			setMIDIEnabled(false);
			const handler = vi.fn();
			onMIDIError(handler);
			mockMIDIOutput.state = 'disconnected';

			mockMIDIAccess.onstatechange?.({ port: mockMIDIOutput });

			expect(handler).not.toHaveBeenCalled();
		});

		it('contains a direct send error, disconnects, and notifies the UI handler', async () => {
			const { requestMIDIAccess, selectMIDIOutput, sendNoteOn, onMIDIError, isConnected } =
				await import('$lib/utils/midi-output');
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');
			const handler = vi.fn();
			const unsubscribe = onMIDIError(handler);
			const error = new Error('device vanished');
			mockSend.mockImplementationOnce(() => {
				throw error;
			});

			expect(() => sendNoteOn(60)).not.toThrow();
			expect(handler).toHaveBeenCalledWith({ kind: 'send', error });
			expect(isConnected()).toBe(false);
			unsubscribe();
		});

		it('contains errors thrown from scheduled sends', async () => {
			vi.useFakeTimers();
			const { setMIDIStrumEnabled } = await import('$lib/stores/midi.svelte');
			const { requestMIDIAccess, selectMIDIOutput, sendChordOn, onMIDIError } = await import(
				'$lib/utils/midi-output'
			);
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');
			setMIDIStrumEnabled(true);
			const handler = vi.fn();
			onMIDIError(handler);
			mockSend.mockImplementation(() => {
				throw new Error('timer send failed');
			});

			sendChordOn([60, 64]);
			expect(() => vi.runAllTimers()).not.toThrow();
			expect(handler).toHaveBeenCalledWith({ kind: 'send', error: expect.any(Error) });
			vi.useRealTimers();
		});

		it('silences sounding notes before dropping the output after a playback failure', async () => {
			vi.useFakeTimers();
			const { requestMIDIAccess, selectMIDIOutput, startMIDILoop, onMIDIError } = await import(
				'$lib/utils/midi-output'
			);
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');
			onMIDIError(vi.fn());
			const progression: Chord[] = [
				{ root: 60, quality: '', inversion: 0, voicing: 'close', octave: 0, duration: '1m' }
			];
			let failing = false;
			startMIDILoop(() => {
				if (failing) throw new Error('render failed');
				return progression;
			}, 120);
			vi.advanceTimersByTime(1);
			expect(mockSend).toHaveBeenCalledWith([0x90, expect.any(Number), expect.any(Number)]);
			mockSend.mockClear();

			failing = true;
			vi.advanceTimersByTime(2000);

			// All Notes Off on every channel, sent before the port is dropped.
			for (let channel = 0; channel < 16; channel++) {
				expect(mockSend).toHaveBeenCalledWith([0xb0 + channel, 123, 0]);
			}
			vi.useRealTimers();
		});

		it('cancels strum attacks a short chord has not reached before its note-off', async () => {
			vi.useFakeTimers();
			const { setMIDIStrumEnabled } = await import('$lib/stores/midi.svelte');
			const { requestMIDIAccess, selectMIDIOutput, startMIDILoop, stopMIDILoop } = await import(
				'$lib/utils/midi-output'
			);
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');
			setMIDIStrumEnabled(true);
			// 8n at 300 BPM lasts 100ms; note-off lands at 50ms, before the 60ms/90ms attacks.
			const progression: Chord[] = [
				{ root: 60, quality: '7', inversion: 0, voicing: 'close', octave: 0, duration: '8n' }
			];
			startMIDILoop(() => progression, 300);
			vi.advanceTimersByTime(99);

			const ons = mockSend.mock.calls.filter(([m]) => (m[0] & 0xf0) === 0x90).map(([m]) => m[1]);
			const offs = mockSend.mock.calls.filter(([m]) => (m[0] & 0xf0) === 0x80).map(([m]) => m[1]);
			// Every attack that fired has a later release; none fire after it.
			expect(ons.length).toBeLessThan(4);
			expect(offs).toEqual(expect.arrayContaining(ons));
			const lastOff = mockSend.mock.calls.findLastIndex(([m]) => (m[0] & 0xf0) === 0x80);
			const lastOn = mockSend.mock.calls.findLastIndex(([m]) => (m[0] & 0xf0) === 0x90);
			expect(lastOn).toBeLessThan(lastOff);
			stopMIDILoop();
			setMIDIStrumEnabled(false);
			vi.useRealTimers();
		});

		it('drops a vanished port quietly when no loop is playing', async () => {
			const { requestMIDIAccess, selectMIDIOutput, sendNoteOff, onMIDIError, isConnected } =
				await import('$lib/utils/midi-output');
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');
			const handler = vi.fn();
			onMIDIError(handler);
			mockMIDIOutput.state = 'disconnected';

			sendNoteOff(60);

			expect(handler).not.toHaveBeenCalled();
			expect(isConnected()).toBe(false);
		});

		it('contains loop-boundary computation errors as playback failures', async () => {
			vi.useFakeTimers();
			const { requestMIDIAccess, selectMIDIOutput, startMIDILoop, onMIDIError } = await import(
				'$lib/utils/midi-output'
			);
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');
			const handler = vi.fn();
			onMIDIError(handler);
			const progression: Chord[] = [
				{ root: 60, quality: '', inversion: 0, voicing: 'close', octave: 0, duration: '1m' }
			];
			let reads = 0;
			startMIDILoop(() => {
				reads += 1;
				if (reads > 1) throw new Error('bad progression');
				return progression;
			}, 120);

			expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
			expect(handler).toHaveBeenCalledWith({ kind: 'playback', error: expect.any(Error) });
			vi.useRealTimers();
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

	describe('duration-aware loop playback', () => {
		const createChord = (root: number, duration: ChordDuration): Chord => ({
			root,
			quality: '',
			inversion: 0,
			voicing: 'close',
			octave: 0,
			duration
		});

		beforeEach(async () => {
			vi.useFakeTimers();
			const { setMIDIStrumEnabled } = await import('$lib/stores/midi.svelte');
			setMIDIStrumEnabled(false);
		});

		afterEach(() => {
			vi.clearAllTimers();
			vi.useRealTimers();
			vi.restoreAllMocks();
		});

		it('schedules mixed durations and rests at cumulative offsets with an anticipated note-off', async () => {
			const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
			const { startMIDILoop } = await import('$lib/utils/midi-output');
			const progression = [createChord(60, '1m'), createChord(62, '2n'), null];

			startMIDILoop(() => progression, 120);

			const delays = setTimeoutSpy.mock.calls.map((call) => call[1]);
			expect(delays).toEqual([0, 1950, 2000, 2950, 3000, 4950, 5000]);
		});

		it('applies a duration edit at the next cycle without changing current-cycle offsets', async () => {
			const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
			const { startMIDILoop } = await import('$lib/utils/midi-output');
			const progression = [createChord(60, '1m'), createChord(62, '1m')];

			startMIDILoop(() => progression, 120);
			progression[0].duration = '2n';

			// The active cycle retains its original 2-second second-slot offset and 4-second length.
			expect(setTimeoutSpy.mock.calls.map((call) => call[1])).toEqual([0, 1950, 2000, 3950, 4000]);

			vi.advanceTimersByTime(4000);
			const nextCycleDelays = setTimeoutSpy.mock.calls.slice(5).map((call) => call[1]);
			expect(nextCycleDelays).toEqual([0, 950, 1000, 2950, 3000]);
		});

		it('reads harmony live when a not-yet-reached slot arrives', async () => {
			const { requestMIDIAccess, selectMIDIOutput, startMIDILoop } = await import(
				'$lib/utils/midi-output'
			);
			await requestMIDIAccess();
			selectMIDIOutput('test-output-1');
			mockSend.mockClear();
			const progression = [createChord(60, '1m'), createChord(62, '1m')];

			startMIDILoop(() => progression, 120);
			mockSend.mockClear(); // Ignore All Notes Off emitted by loop startup.
			progression[1] = createChord(65, '1m');
			vi.advanceTimersByTime(2000);

			expect(mockSend).toHaveBeenCalledWith([0x90, 65, 100]);
			expect(mockSend).not.toHaveBeenCalledWith([0x90, 62, 100]);
		});

		it('reports progress from the active cycle duration snapshot', async () => {
			const { startMIDILoop, getMIDIPlaybackProgress } = await import('$lib/utils/midi-output');
			const progression = [createChord(60, '1m'), createChord(62, '2n'), null];

			startMIDILoop(() => progression, 120);
			vi.advanceTimersByTime(2500);

			expect(getMIDIPlaybackProgress()).toEqual({ chordIndex: 1, progress: 50 });
		});

		it('prunes fired cycle timeouts instead of retaining them until Stop', async () => {
			const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
			const { startMIDILoop, stopMIDILoop } = await import('$lib/utils/midi-output');
			const progression = [createChord(60, '1m'), createChord(62, '1m')];

			startMIDILoop(() => progression, 120);
			vi.advanceTimersByTime(4001);
			stopMIDILoop();

			// Three not-yet-fired chord timers from cycle two, plus its boundary timer.
			expect(clearTimeoutSpy).toHaveBeenCalledTimes(4);
		});
	});
});
