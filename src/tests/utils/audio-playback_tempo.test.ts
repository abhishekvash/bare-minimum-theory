import { describe, expect, it, vi } from 'vitest';

const { mockTransport, mockSetMIDILoopTempo } = vi.hoisted(() => ({
	mockTransport: { bpm: { value: 120, rampTo: vi.fn() }, state: 'started' },
	mockSetMIDILoopTempo: vi.fn()
}));

vi.mock('tone', () => ({ Transport: mockTransport }));

vi.mock('$lib/utils/midi-output', () => ({
	startMIDILoop: vi.fn(),
	stopMIDILoop: vi.fn(),
	getMIDIPlaybackProgress: vi.fn(() => null),
	isMIDILoopPlaying: vi.fn(() => true),
	setMIDILoopTempo: mockSetMIDILoopTempo
}));

import { updatePlaybackTempo } from '$lib/utils/audio-playback';

describe('updatePlaybackTempo', () => {
	it('passes a DAW tempo change to both Tone.Transport and the MIDI loop', () => {
		updatePlaybackTempo(95);

		expect(mockTransport.bpm.rampTo).toHaveBeenCalledWith(95, expect.any(Number));
		expect(mockSetMIDILoopTempo).toHaveBeenCalledWith(95);
	});

	it('clamps the tempo it hands the MIDI loop', () => {
		updatePlaybackTempo(500);

		expect(mockSetMIDILoopTempo).toHaveBeenLastCalledWith(300);
	});
});
