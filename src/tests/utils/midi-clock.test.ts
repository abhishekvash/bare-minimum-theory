import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock MIDI input device
const mockMIDIInput = {
	id: 'test-input-1',
	name: 'Test MIDI Input',
	state: 'connected',
	onmidimessage: null as ((e: MIDIMessageEvent) => void) | null
};

const mockMIDIInput2 = {
	id: 'test-input-2',
	name: 'Second MIDI Input',
	state: 'connected',
	onmidimessage: null as ((e: MIDIMessageEvent) => void) | null
};

const mockInputsMap = new Map<string, typeof mockMIDIInput>([
	['test-input-1', mockMIDIInput],
	['test-input-2', mockMIDIInput2]
]);

const mockOutputsMap = new Map();

/** A fresh EventTarget per test, so listeners from earlier module instances never linger */
function createMockMIDIAccess() {
	return Object.assign(new EventTarget(), {
		inputs: mockInputsMap,
		outputs: mockOutputsMap,
		onstatechange: null as ((e: unknown) => void) | null
	});
}

let mockMIDIAccess = createMockMIDIAccess();

function sendClockMessage(status: number, timeStamp = 0) {
	mockMIDIInput.onmidimessage?.({
		data: new Uint8Array([status]),
		timeStamp
	} as unknown as MIDIMessageEvent);
}

/** Send `count` clock ticks at `bpm`, starting at `startMs`; returns the time after the last */
function sendTicks(count: number, bpm: number, startMs: number): number {
	const interval = 60000 / (bpm * 24);
	for (let i = 0; i < count; i++) sendClockMessage(0xf8, startMs + i * interval);
	return startMs + count * interval;
}

describe('midi-clock', () => {
	beforeEach(() => {
		vi.resetModules();
		mockMIDIAccess = createMockMIDIAccess();
		mockMIDIInput.state = 'connected';
		mockMIDIInput.onmidimessage = null;
		mockMIDIInput2.onmidimessage = null;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('initMIDIClock', () => {
		it('initializes with MIDIAccess object', async () => {
			const { initMIDIClock, selectMIDIInput } = await import('$lib/utils/midi-clock');

			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);

			// Verify initialization by selecting an input
			const success = selectMIDIInput('test-input-1');
			expect(success).toBe(true);
		});
	});

	describe('statechange handling', () => {
		it('leaves handlers already on the shared MIDIAccess in place', async () => {
			const { initMIDIClock } = await import('$lib/utils/midi-clock');
			const outputHandler = vi.fn();
			mockMIDIAccess.onstatechange = outputHandler;

			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);

			expect(mockMIDIAccess.onstatechange).toBe(outputHandler);
		});

		it('stops receiving when the selected input disconnects', async () => {
			const { initMIDIClock, selectMIDIInput, startClockListener, isReceivingClock } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');
			startClockListener(vi.fn());
			sendClockMessage(0xf8);
			expect(isReceivingClock()).toBe(true);

			mockMIDIInput.state = 'disconnected';
			mockMIDIAccess.dispatchEvent(new Event('statechange'));

			expect(isReceivingClock()).toBe(false);
		});

		it('does not stack listeners across repeated init, and removes them on dispose', async () => {
			const add = vi.spyOn(mockMIDIAccess, 'addEventListener');
			const remove = vi.spyOn(mockMIDIAccess, 'removeEventListener');
			const { initMIDIClock, disposeMIDIClock } = await import('$lib/utils/midi-clock');

			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			expect(add).toHaveBeenCalledTimes(2);
			expect(remove).toHaveBeenCalledTimes(1);

			disposeMIDIClock();
			expect(remove).toHaveBeenCalledTimes(2);
			const handler = add.mock.calls[0][1];
			expect(remove.mock.calls.every((call) => call[1] === handler)).toBe(true);
		});
	});

	describe('selectMIDIInput', () => {
		it('returns false when not initialized', async () => {
			const { selectMIDIInput } = await import('$lib/utils/midi-clock');
			const success = selectMIDIInput('test-input-1');
			expect(success).toBe(false);
		});

		it('returns true when selecting a valid input', async () => {
			const { initMIDIClock, selectMIDIInput } = await import('$lib/utils/midi-clock');
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);

			const success = selectMIDIInput('test-input-1');
			expect(success).toBe(true);
		});

		it('returns false when selecting an invalid input', async () => {
			const { initMIDIClock, selectMIDIInput } = await import('$lib/utils/midi-clock');
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);

			const success = selectMIDIInput('nonexistent-input');
			expect(success).toBe(false);
		});
	});

	describe('getSelectedInputId', () => {
		it('returns null when no input is selected', async () => {
			const { initMIDIClock, getSelectedInputId } = await import('$lib/utils/midi-clock');
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);

			expect(getSelectedInputId()).toBeNull();
		});

		it('returns the ID of the selected input', async () => {
			const { initMIDIClock, selectMIDIInput, getSelectedInputId } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');

			expect(getSelectedInputId()).toBe('test-input-1');
		});
	});

	describe('isInputConnected', () => {
		it('returns false when no input is selected', async () => {
			const { initMIDIClock, isInputConnected } = await import('$lib/utils/midi-clock');
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);

			expect(isInputConnected()).toBe(false);
		});

		it('returns true when input is selected and connected', async () => {
			const { initMIDIClock, selectMIDIInput, isInputConnected } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');

			expect(isInputConnected()).toBe(true);
		});
	});

	describe('clock listener', () => {
		it('attaches message handler when starting listener', async () => {
			const { initMIDIClock, selectMIDIInput, startClockListener } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');

			const onBpmChange = vi.fn();
			startClockListener(onBpmChange);

			expect(mockMIDIInput.onmidimessage).not.toBeNull();
		});

		it('removes message handler when stopping listener', async () => {
			const { initMIDIClock, selectMIDIInput, startClockListener, stopClockListener } =
				await import('$lib/utils/midi-clock');
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');

			const onBpmChange = vi.fn();
			startClockListener(onBpmChange);
			stopClockListener();

			expect(mockMIDIInput.onmidimessage).toBeNull();
		});

		it('returns false for isReceivingClock when not listening', async () => {
			const { initMIDIClock, isReceivingClock } = await import('$lib/utils/midi-clock');
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);

			expect(isReceivingClock()).toBe(false);
		});

		it('returns null for detectedBpm when not receiving clock', async () => {
			const { initMIDIClock, getDetectedBpm } = await import('$lib/utils/midi-clock');
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);

			expect(getDetectedBpm()).toBeNull();
		});
	});

	describe('BPM calculation', () => {
		it('calculates BPM from clock ticks', async () => {
			vi.useFakeTimers();

			const { initMIDIClock, selectMIDIInput, startClockListener, getDetectedBpm } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');

			const onBpmChange = vi.fn();
			startClockListener(onBpmChange);

			// Simulate clock ticks at 120 BPM
			// 120 BPM = 2 beats per second = 48 ticks per second = ~20.83ms per tick
			const tickInterval = 60000 / (120 * 24); // ~20.83ms

			// Send 25 ticks (need at least 4 for calculation)
			for (let i = 0; i < 25; i++) {
				if (mockMIDIInput.onmidimessage) {
					mockMIDIInput.onmidimessage({
						data: new Uint8Array([0xf8]),
						timeStamp: i * tickInterval
					} as unknown as MIDIMessageEvent);
				}
			}

			// After receiving enough ticks, BPM should be calculated
			expect(onBpmChange).toHaveBeenCalled();

			// Check that detected BPM is approximately 120 (within rounding)
			const detectedBpm = getDetectedBpm();
			expect(detectedBpm).not.toBeNull();
			if (detectedBpm !== null) {
				expect(detectedBpm).toBeGreaterThanOrEqual(119);
				expect(detectedBpm).toBeLessThanOrEqual(121);
			}

			vi.useRealTimers();
		});

		it('clamps BPM to valid range (40-300)', async () => {
			vi.useFakeTimers();

			const { initMIDIClock, selectMIDIInput, startClockListener, getDetectedBpm } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');

			const onBpmChange = vi.fn();
			startClockListener(onBpmChange);

			// Simulate very slow clock ticks (below 40 BPM)
			const verySlowTickInterval = 60000 / (20 * 24); // 20 BPM worth of ticks

			for (let i = 0; i < 25; i++) {
				if (mockMIDIInput.onmidimessage) {
					mockMIDIInput.onmidimessage({
						data: new Uint8Array([0xf8]),
						timeStamp: i * verySlowTickInterval
					} as unknown as MIDIMessageEvent);
				}
			}

			// BPM should be clamped to minimum of 40
			const detectedBpm = getDetectedBpm();
			expect(detectedBpm).toBe(40);

			vi.useRealTimers();
		});
	});

	describe('clock pauses', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it('does not average a timed-out pause into the resumed tempo', async () => {
			vi.useFakeTimers();
			const { initMIDIClock, selectMIDIInput, startClockListener } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');
			const onBpmChange = vi.fn();
			startClockListener(onBpmChange);

			// A different tempo before the pause, so the resumed tempo has to be reported
			const pausedAt = sendTicks(25, 90, 0);
			vi.advanceTimersByTime(1100); // clock timeout
			onBpmChange.mockClear();
			sendTicks(25, 120, pausedAt + 5000);

			expect(onBpmChange).toHaveBeenCalledWith(120);
			expect(onBpmChange.mock.calls.every(([bpm]) => bpm >= 119 && bpm <= 121)).toBe(true);
		});

		it('does not count the gap before a MIDI Start as a tick interval', async () => {
			vi.useFakeTimers();
			const { initMIDIClock, selectMIDIInput, startClockListener } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');
			const onBpmChange = vi.fn();
			startClockListener(onBpmChange);

			// A different tempo before the stop, so the restarted tempo has to be reported
			const stoppedAt = sendTicks(25, 90, 0);
			sendClockMessage(0xfc, stoppedAt);
			sendClockMessage(0xfa, stoppedAt + 800); // restart inside the timeout window
			onBpmChange.mockClear();
			sendTicks(25, 120, stoppedAt + 800);

			expect(onBpmChange).toHaveBeenCalledWith(120);
			expect(onBpmChange.mock.calls.every(([bpm]) => bpm >= 119 && bpm <= 121)).toBe(true);
		});
	});

	describe('clock state callback', () => {
		it('calls clock state callback when receiving starts', async () => {
			vi.useFakeTimers();

			const { initMIDIClock, selectMIDIInput, startClockListener } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');

			const onBpmChange = vi.fn();
			const onClockState = vi.fn();
			startClockListener(onBpmChange, onClockState);

			// Send a clock tick
			if (mockMIDIInput.onmidimessage) {
				mockMIDIInput.onmidimessage({
					data: new Uint8Array([0xf8]),
					timeStamp: 0
				} as unknown as MIDIMessageEvent);
			}

			// Should be called with isReceiving = true
			expect(onClockState).toHaveBeenCalledWith(true);

			vi.useRealTimers();
		});

		it('calls clock state callback when clock times out', async () => {
			vi.useFakeTimers();

			const { initMIDIClock, selectMIDIInput, startClockListener } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');

			const onBpmChange = vi.fn();
			const onClockState = vi.fn();
			startClockListener(onBpmChange, onClockState);

			// Send a clock tick
			if (mockMIDIInput.onmidimessage) {
				mockMIDIInput.onmidimessage({
					data: new Uint8Array([0xf8]),
					timeStamp: 0
				} as unknown as MIDIMessageEvent);
			}

			// Clear the mock to check for the timeout call
			onClockState.mockClear();

			// Advance time past the timeout (1 second)
			vi.advanceTimersByTime(1100);

			// Should be called with isReceiving = false
			expect(onClockState).toHaveBeenCalledWith(false);

			vi.useRealTimers();
		});
	});

	describe('transport callback', () => {
		it('calls transport callback with start when Start message received', async () => {
			const { initMIDIClock, selectMIDIInput, startClockListener } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');

			const onBpmChange = vi.fn();
			const onClockState = vi.fn();
			const onTransport = vi.fn();
			startClockListener(onBpmChange, onClockState, onTransport);

			// Send MIDI Start message (0xFA)
			if (mockMIDIInput.onmidimessage) {
				mockMIDIInput.onmidimessage({
					data: new Uint8Array([0xfa]),
					timeStamp: 0
				} as unknown as MIDIMessageEvent);
			}

			expect(onTransport).toHaveBeenCalledWith('start');
		});

		it('calls transport callback with start when Continue message received', async () => {
			const { initMIDIClock, selectMIDIInput, startClockListener } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');

			const onBpmChange = vi.fn();
			const onClockState = vi.fn();
			const onTransport = vi.fn();
			startClockListener(onBpmChange, onClockState, onTransport);

			// Send MIDI Continue message (0xFB)
			if (mockMIDIInput.onmidimessage) {
				mockMIDIInput.onmidimessage({
					data: new Uint8Array([0xfb]),
					timeStamp: 0
				} as unknown as MIDIMessageEvent);
			}

			expect(onTransport).toHaveBeenCalledWith('start');
		});

		it('calls transport callback with stop when Stop message received', async () => {
			const { initMIDIClock, selectMIDIInput, startClockListener } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');

			const onBpmChange = vi.fn();
			const onClockState = vi.fn();
			const onTransport = vi.fn();
			startClockListener(onBpmChange, onClockState, onTransport);

			// Send MIDI Stop message (0xFC)
			if (mockMIDIInput.onmidimessage) {
				mockMIDIInput.onmidimessage({
					data: new Uint8Array([0xfc]),
					timeStamp: 0
				} as unknown as MIDIMessageEvent);
			}

			expect(onTransport).toHaveBeenCalledWith('stop');
		});

		it('does not call transport callback when no callback provided', async () => {
			const { initMIDIClock, selectMIDIInput, startClockListener } = await import(
				'$lib/utils/midi-clock'
			);
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');

			const onBpmChange = vi.fn();
			const onClockState = vi.fn();
			// No transport callback provided
			startClockListener(onBpmChange, onClockState);

			// Send MIDI Start message - should not throw
			expect(() => {
				if (mockMIDIInput.onmidimessage) {
					mockMIDIInput.onmidimessage({
						data: new Uint8Array([0xfa]),
						timeStamp: 0
					} as unknown as MIDIMessageEvent);
				}
			}).not.toThrow();
		});
	});

	describe('disposeMIDIClock', () => {
		it('cleans up resources', async () => {
			const {
				initMIDIClock,
				selectMIDIInput,
				startClockListener,
				disposeMIDIClock,
				getSelectedInputId
			} = await import('$lib/utils/midi-clock');
			initMIDIClock(mockMIDIAccess as unknown as MIDIAccess);
			selectMIDIInput('test-input-1');
			startClockListener(vi.fn());

			disposeMIDIClock();

			expect(getSelectedInputId()).toBeNull();
			// After dispose, selecting should fail (midiAccess is null)
			expect(selectMIDIInput('test-input-1')).toBe(false);
		});
	});
});
