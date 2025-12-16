/**
 * MIDI Clock Input Utilities
 * Handles receiving MIDI clock signals from DAW to sync tempo
 *
 * MIDI Clock Protocol:
 * - 0xF8: Clock tick (24 pulses per quarter note)
 * - 0xFA: Start
 * - 0xFB: Continue
 * - 0xFC: Stop
 *
 * BPM calculation: bpm = 60000 / (avgIntervalMs * 24)
 */

// MIDI message constants
const MIDI_CLOCK = 0xf8;
const MIDI_START = 0xfa;
const MIDI_CONTINUE = 0xfb;
const MIDI_STOP = 0xfc;

// Configuration
const TICKS_PER_QUARTER_NOTE = 24;
const ROLLING_AVERAGE_SIZE = 24; // Average over one quarter note for stability
const CLOCK_TIMEOUT_MS = 1000; // Consider clock lost after 1 second
const MIN_BPM = 40;
const MAX_BPM = 300;

// Module state
let midiAccess: MIDIAccess | null = null;
let selectedInput: MIDIInput | null = null;
let isListening = false;

// Clock timing state
let tickTimes: number[] = [];
let lastTickTime: number | null = null;
let calculatedBpm: number | null = null;
let clockTimeoutId: number | null = null;
let receivingClock = false;

// Callbacks
type BpmChangeCallback = (bpm: number) => void;
type ClockStateCallback = (isReceiving: boolean) => void;
type TransportCallback = (command: 'start' | 'stop') => void;
let bpmChangeCallback: BpmChangeCallback | null = null;
let clockStateCallback: ClockStateCallback | null = null;
let transportCallback: TransportCallback | null = null;

/**
 * Initialize MIDI clock with an existing MIDIAccess object
 * This allows sharing access with midi-output.ts
 */
export function initMIDIClock(access: MIDIAccess): void {
	midiAccess = access;
	midiAccess.onstatechange = () => {
		if (selectedInput && selectedInput.state !== 'connected') {
			setReceivingState(false);
		}
	};
}

/**
 * Get list of available MIDI inputs
 */
export function getMIDIInputs(): Array<{ id: string; name: string }> {
	if (!midiAccess) return [];

	const inputs: Array<{ id: string; name: string }> = [];
	midiAccess.inputs.forEach((input) => {
		inputs.push({
			id: input.id,
			name: input.name || `MIDI Input ${input.id}`
		});
	});
	return inputs;
}

/**
 * Select a MIDI input device by ID
 * @returns true if device was found and selected
 */
export function selectMIDIInput(inputId: string): boolean {
	if (!midiAccess) return false;

	if (selectedInput) {
		selectedInput.onmidimessage = null;
	}

	const input = midiAccess.inputs.get(inputId);
	if (input) {
		selectedInput = input;
		if (isListening) {
			attachMessageHandler();
		}
		return true;
	}
	return false;
}

/**
 * Get the currently selected input ID
 */
export function getSelectedInputId(): string | null {
	return selectedInput?.id ?? null;
}

/**
 * Check if we have an active MIDI input connection
 */
export function isInputConnected(): boolean {
	return selectedInput !== null && selectedInput.state === 'connected';
}

/**
 * Start listening for MIDI clock and transport messages
 * @param onBpmChange - Called when BPM changes
 * @param onClockState - Called when clock receiving state changes
 * @param onTransport - Called when transport messages (Start/Stop) are received
 */
export function startClockListener(
	onBpmChange: BpmChangeCallback,
	onClockState?: ClockStateCallback,
	onTransport?: TransportCallback
): void {
	bpmChangeCallback = onBpmChange;
	clockStateCallback = onClockState ?? null;
	transportCallback = onTransport ?? null;
	isListening = true;

	resetTimingState();

	if (selectedInput) {
		attachMessageHandler();
	}
}

/**
 * Stop listening for MIDI clock messages
 */
export function stopClockListener(): void {
	isListening = false;
	bpmChangeCallback = null;
	clockStateCallback = null;
	transportCallback = null;

	if (selectedInput) {
		selectedInput.onmidimessage = null;
	}

	clearClockTimeout();
	resetTimingState();
}

/**
 * Check if currently receiving clock signals
 */
export function isReceivingClock(): boolean {
	return receivingClock;
}

/**
 * Get the detected BPM from clock signals
 */
export function getDetectedBpm(): number | null {
	return calculatedBpm;
}

/**
 * Cleanup MIDI clock resources
 */
export function disposeMIDIClock(): void {
	stopClockListener();
	selectedInput = null;
	midiAccess = null;
}

// Internal helpers

function attachMessageHandler(): void {
	if (!selectedInput) return;

	selectedInput.onmidimessage = (event: MIDIMessageEvent) => {
		if (!event.data || event.data.length === 0) return;

		const status = event.data[0];

		switch (status) {
			case MIDI_CLOCK:
				handleClockTick(event.timeStamp);
				break;
			case MIDI_START:
			case MIDI_CONTINUE:
				// Both Start and Continue trigger playback
				transportCallback?.('start');
				break;
			case MIDI_STOP:
				transportCallback?.('stop');
				break;
		}
	};
}

function handleClockTick(timestamp: number): void {
	resetClockTimeout();

	if (!receivingClock) {
		setReceivingState(true);
	}

	if (lastTickTime !== null) {
		const interval = timestamp - lastTickTime;

		tickTimes.push(interval);
		if (tickTimes.length > ROLLING_AVERAGE_SIZE) {
			tickTimes.shift();
		}

		// Need at least a few ticks for reasonable BPM estimate
		if (tickTimes.length >= 4) {
			const avgInterval = tickTimes.reduce((a, b) => a + b, 0) / tickTimes.length;
			const bpm = Math.round(60000 / (avgInterval * TICKS_PER_QUARTER_NOTE));
			const clampedBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));

			if (clampedBpm !== calculatedBpm) {
				calculatedBpm = clampedBpm;
				bpmChangeCallback?.(clampedBpm);
			}
		}
	}

	lastTickTime = timestamp;
}

function resetTimingState(): void {
	tickTimes = [];
	lastTickTime = null;
	calculatedBpm = null;
	setReceivingState(false);
}

function setReceivingState(isReceiving: boolean): void {
	if (receivingClock !== isReceiving) {
		receivingClock = isReceiving;
		clockStateCallback?.(isReceiving);
	}
}

function resetClockTimeout(): void {
	clearClockTimeout();
	clockTimeoutId = window.setTimeout(() => {
		setReceivingState(false);
	}, CLOCK_TIMEOUT_MS);
}

function clearClockTimeout(): void {
	if (clockTimeoutId !== null) {
		window.clearTimeout(clockTimeoutId);
		clockTimeoutId = null;
	}
}
