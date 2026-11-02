import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	auditionChord,
	auditionNotes,
	cancelAudition,
	isTransportActive,
	setAuditionErrorHandler,
	startAuditionSequence
} from '$lib/utils/audition-controller';
import { disposeAudio, initPreviewAudio, startLoopingPlayback } from '$lib/utils/audio-playback';
import { progressionState } from '$lib/stores/progression.svelte';
import { resetUIState, selectSlot, uiState } from '$lib/stores/ui.svelte';
import { settingsState } from '$lib/stores/settings.svelte';
import {
	setMIDIConnectionState,
	setMIDIEnabled,
	setMIDIStrumEnabled
} from '$lib/stores/midi.svelte';
import type { Chord, ChordQuality } from '$lib/utils/theory-engine';

const {
	mockTriggerAttackRelease,
	mockReleaseAll,
	MockPolySynth,
	MockSynth,
	mockStart,
	mockFrequency,
	mockNow,
	mockTransport,
	mockTime
} = vi.hoisted(() => {
	const mockTriggerAttackRelease = vi.fn();
	const mockReleaseAll = vi.fn();
	const mockDispose = vi.fn();

	interface MockPolySynthInstance {
		triggerAttackRelease: typeof mockTriggerAttackRelease;
		releaseAll: typeof mockReleaseAll;
		dispose: typeof mockDispose;
		toDestination: ReturnType<typeof vi.fn>;
	}

	const MockPolySynth = vi.fn(function (this: MockPolySynthInstance) {
		this.triggerAttackRelease = mockTriggerAttackRelease;
		this.releaseAll = mockReleaseAll;
		this.dispose = mockDispose;
		this.toDestination = vi.fn(() => this);
		return this;
	});

	const mockTransport = {
		state: 'stopped',
		seconds: 0,
		position: 0,
		loop: false,
		loopStart: 0,
		loopEnd: 0,
		bpm: { value: 120, rampTo: vi.fn() },
		scheduleRepeat: vi.fn(() => 1),
		clear: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
		cancel: vi.fn()
	};

	return {
		mockTriggerAttackRelease,
		mockReleaseAll,
		mockDispose,
		MockPolySynth,
		MockSynth: vi.fn(),
		mockStart: vi.fn().mockResolvedValue(undefined),
		mockFrequency: vi.fn((midi: number) => ({ toNote: () => `Note${midi}` })),
		mockNow: vi.fn(() => 0),
		mockTransport,
		mockTime: vi.fn(() => ({ toSeconds: () => 2, toTicks: () => 768 }))
	};
});

vi.mock('tone', () => ({
	default: {
		start: mockStart,
		PolySynth: MockPolySynth,
		Synth: MockSynth,
		Frequency: mockFrequency,
		now: mockNow,
		Time: mockTime,
		Transport: mockTransport
	},
	PolySynth: MockPolySynth,
	Synth: MockSynth,
	Frequency: mockFrequency,
	start: mockStart,
	now: mockNow,
	Time: mockTime,
	Transport: mockTransport
}));

const { mockSendNoteOn, mockSendNoteOff, mockStartMIDILoop, midiLoop } = vi.hoisted(() => ({
	mockSendNoteOn: vi.fn(),
	mockSendNoteOff: vi.fn(),
	mockStartMIDILoop: vi.fn(),
	midiLoop: { playing: false }
}));

vi.mock('$lib/utils/midi-output', () => ({
	STRUM_DELAY_MS: 30,
	sendNoteOn: mockSendNoteOn,
	sendNoteOff: mockSendNoteOff,
	startMIDILoop: mockStartMIDILoop,
	stopMIDILoop: vi.fn(),
	getMIDIPlaybackProgress: vi.fn(() => null),
	isMIDILoopPlaying: vi.fn(() => midiLoop.playing)
}));

/** One audition step lasts a half note, which is 1000ms at the default 120 BPM */
const STEP_MS = 1000;

function chord(root: number, quality: ChordQuality = ''): Chord {
	return { root, quality, inversion: 0, voicing: 'close', octave: 0, duration: '1m' };
}

/** Note names the mocked Tone.Frequency produces for a close-voiced major triad */
function triadNoteNames(root: number): string[] {
	return [`Note${root}`, `Note${root + 4}`, `Note${root + 7}`];
}

/** Note names passed to the preview synth, in trigger order */
function triggeredNotes(): string[] {
	vi.advanceTimersByTime(100);
	return mockTriggerAttackRelease.mock.calls.map((call) => call[0] as string);
}

function enableConnectedMIDI(): void {
	setMIDIEnabled(true);
	setMIDIConnectionState(true);
	setMIDIStrumEnabled(false);
}

describe('audition-controller', () => {
	beforeEach(async () => {
		vi.useFakeTimers();

		// The preview synth exists up front, so auditions sound synchronously like they do
		// after the first user gesture in the real app
		await initPreviewAudio();

		progressionState.progression = [null, null, null, null];
		resetUIState();
		settingsState.pianoKeyboard.activeNotes = [];

		setMIDIEnabled(false);
		setMIDIConnectionState(false);
		setMIDIStrumEnabled(true);

		mockTransport.state = 'stopped';
		midiLoop.playing = false;

		cancelAudition();
		vi.clearAllMocks();
	});

	afterEach(() => {
		setAuditionErrorHandler(null);
		cancelAudition();
		vi.clearAllTimers();
		vi.useRealTimers();
		disposeAudio();
	});

	describe('isTransportActive', () => {
		it('is false while nothing is playing', () => {
			expect(isTransportActive()).toBe(false);
		});

		it('is true while the Tone transport runs', () => {
			mockTransport.state = 'started';
			expect(isTransportActive()).toBe(true);
		});

		it('is true while the MIDI loop runs', () => {
			midiLoop.playing = true;
			expect(isTransportActive()).toBe(true);
		});
	});

	describe('suppression while a transport owns the sound', () => {
		it('suppresses a click audition during Tone playback', () => {
			mockTransport.state = 'started';

			expect(auditionChord(chord(60), { mode: 'click' })).toBe('suppressed');
			expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
		});

		it('suppresses a sweep audition during MIDI playback', () => {
			midiLoop.playing = true;

			expect(auditionChord(chord(60), { mode: 'sweep' })).toBe('suppressed');
			expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
			expect(mockSendNoteOn).not.toHaveBeenCalled();
		});

		it('suppresses direct-note auditions and leaves the piano to the loop', () => {
			mockTransport.state = 'started';
			settingsState.pianoKeyboard.activeNotes = [48, 52, 55];

			expect(auditionNotes([60, 64, 67])).toBe('suppressed');
			expect(settingsState.pianoKeyboard.activeNotes).toEqual([48, 52, 55]);
		});

		it('drops a chained candidate whose transport started mid-preview', () => {
			progressionState.progression = [chord(60), null, null, null];

			expect(auditionChord(chord(65), { mode: 'click' })).toBe('played');
			expect(triggeredNotes()).toEqual(triadNoteNames(60));

			mockTransport.state = 'started';
			vi.advanceTimersByTime(STEP_MS);

			// The candidate step was due now, but the loop has taken the sound back
			expect(triggeredNotes()).toEqual(triadNoteNames(60));
		});
	});

	describe('chained click preview', () => {
		it('plays the nearest preceding chord, then the candidate', () => {
			progressionState.progression = [chord(60), null, null, null];

			expect(auditionChord(chord(65), { mode: 'click' })).toBe('played');
			expect(triggeredNotes()).toEqual(triadNoteNames(60));

			vi.advanceTimersByTime(STEP_MS);
			expect(triggeredNotes()).toEqual([...triadNoteNames(60), ...triadNoteNames(65)]);
		});

		it('starts the chain clock only after slow first-time audio startup', async () => {
			disposeAudio();
			let resolveStart!: () => void;
			mockStart.mockImplementationOnce(
				() => new Promise<void>((resolve) => (resolveStart = resolve))
			);
			progressionState.progression = [chord(60), null, null, null];

			auditionChord(chord(65), { mode: 'click' });
			// Startup takes longer than one step.
			await vi.advanceTimersByTimeAsync(STEP_MS + 500);
			expect(triggeredNotes()).toEqual([]);

			resolveStart();
			await vi.advanceTimersByTimeAsync(0);
			// Context first, alone.
			expect(triggeredNotes()).toEqual(triadNoteNames(60));

			await vi.advanceTimersByTimeAsync(STEP_MS);
			expect(triggeredNotes()).toEqual([...triadNoteNames(60), ...triadNoteNames(65)]);
		});

		it('skips rests when looking for the context chord', () => {
			progressionState.progression = [chord(60), null, null, null];
			uiState.selectedSlot = 3;

			auditionChord(chord(65), { mode: 'click' });

			expect(triggeredNotes()).toEqual(triadNoteNames(60));
		});

		it('plays the candidate alone when nothing precedes the target', () => {
			progressionState.progression = [null, chord(60), null, null];

			auditionChord(chord(65), { mode: 'click' });
			vi.advanceTimersByTime(STEP_MS * 2);

			// Slot 0 is the target, so the chord in slot 1 is not context
			expect(triggeredNotes()).toEqual(triadNoteNames(65));
		});

		it('targets the selected slot ahead of the first empty one', () => {
			progressionState.progression = [chord(60), chord(62), null, null];
			uiState.selectedSlot = 1;

			auditionChord(chord(65), { mode: 'click' });

			// Context is the chord before slot 1, not the one before the first empty slot
			expect(triggeredNotes()).toEqual(triadNoteNames(60));
		});

		it('targets the first empty slot when nothing is selected', () => {
			progressionState.progression = [chord(60), null, chord(67), null];

			auditionChord(chord(65), { mode: 'click' });

			expect(triggeredNotes()).toEqual(triadNoteNames(60));
		});

		it('honours an explicit target slot', () => {
			progressionState.progression = [chord(60), chord(62), null, null];

			auditionChord(chord(65), { mode: 'click', targetSlot: 2 });

			expect(triggeredNotes()).toEqual(triadNoteNames(62));
		});
	});

	describe('sweep preview', () => {
		it('plays the candidate only, even when a context chord exists', () => {
			progressionState.progression = [chord(60), null, null, null];

			expect(auditionChord(chord(65), { mode: 'sweep' })).toBe('played');
			vi.advanceTimersByTime(STEP_MS * 2);

			expect(triggeredNotes()).toEqual(triadNoteNames(65));
		});

		it('cancels a sounding chained preview (latest wins across modes)', () => {
			progressionState.progression = [chord(60), null, null, null];

			auditionChord(chord(65), { mode: 'click' });
			mockTriggerAttackRelease.mockClear();

			auditionChord(chord(67), { mode: 'sweep' });
			vi.advanceTimersByTime(STEP_MS * 2);

			expect(mockReleaseAll).toHaveBeenCalled();
			expect(triggeredNotes()).toEqual(triadNoteNames(67));
		});
	});

	describe('cancellation', () => {
		it('prevents delayed Tone strum attacks after cancellation', () => {
			auditionNotes([60, 64, 67]);
			expect(mockTriggerAttackRelease).toHaveBeenCalledTimes(1);

			cancelAudition();
			vi.advanceTimersByTime(200);

			expect(mockTriggerAttackRelease).toHaveBeenCalledTimes(1);
		});

		it('kills the pending second step of a chained preview', () => {
			progressionState.progression = [chord(60), null, null, null];

			auditionChord(chord(65), { mode: 'click' });
			mockTriggerAttackRelease.mockClear();

			cancelAudition();
			vi.advanceTimersByTime(STEP_MS * 4);

			expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
		});

		it('reports preview initialization failures and clears owned visuals', async () => {
			disposeAudio();
			const error = new Error('audio denied');
			const handler = vi.fn();
			setAuditionErrorHandler(handler);
			mockStart.mockRejectedValueOnce(error);

			auditionNotes([60, 64, 67]);
			await vi.runAllTimersAsync();

			expect(handler).toHaveBeenCalledWith(error);
			expect(settingsState.pianoKeyboard.activeNotes).toEqual([]);
			setAuditionErrorHandler(null);
		});

		it('drops a stale sequence step when slow audio initialization resolves later', async () => {
			disposeAudio();
			let resolveFirstStart!: () => void;
			mockStart.mockImplementationOnce(
				() => new Promise<void>((resolve) => (resolveFirstStart = resolve))
			);

			startAuditionSequence([[60], [62]], 600, vi.fn());
			await vi.advanceTimersByTimeAsync(600);
			expect(triggeredNotes()).toEqual([]);

			resolveFirstStart();
			await vi.advanceTimersByTimeAsync(0);
			expect(triggeredNotes()).toEqual(['Note62']);
		});

		it('scopes sequence cancellation so an old handle cannot cancel a newer audition', () => {
			const firstComplete = vi.fn();
			const handle = startAuditionSequence(
				[
					[60, 64, 67],
					[62, 65, 69]
				],
				600,
				firstComplete
			);
			auditionNotes([67, 71, 74]);
			mockReleaseAll.mockClear();

			handle.cancel();
			expect(mockReleaseAll).not.toHaveBeenCalled();
			expect(firstComplete).toHaveBeenCalledOnce();
		});

		it('is idempotent and safe from a resting state', () => {
			expect(() => {
				cancelAudition();
				cancelAudition();
				cancelAudition();
			}).not.toThrow();
			expect(mockSendNoteOff).not.toHaveBeenCalled();
		});

		it('clears the piano visualization it owns', () => {
			auditionNotes([60, 64, 67]);
			expect(settingsState.pianoKeyboard.activeNotes).toEqual([60, 64, 67]);

			cancelAudition();
			expect(settingsState.pianoKeyboard.activeNotes).toEqual([]);
		});

		it('leaves piano keys it does not own alone', () => {
			settingsState.pianoKeyboard.activeNotes = [48, 52, 55];

			cancelAudition();

			expect(settingsState.pianoKeyboard.activeNotes).toEqual([48, 52, 55]);
		});

		it('releases the piano on its own once a step has run its course', () => {
			auditionNotes([60, 64, 67]);

			vi.advanceTimersByTime(STEP_MS + 200);

			expect(settingsState.pianoKeyboard.activeNotes).toEqual([]);
		});

		it('is triggered by switching the target slot', () => {
			progressionState.progression = [chord(60), chord(62), null, null];
			auditionNotes([60, 64, 67]);

			selectSlot(1);

			expect(mockReleaseAll).toHaveBeenCalled();
			expect(settingsState.pianoKeyboard.activeNotes).toEqual([]);
		});
	});

	describe('MIDI routing', () => {
		it('sends notes to the device when MIDI is enabled and connected', () => {
			enableConnectedMIDI();
			mockSendNoteOn.mockClear();

			expect(auditionNotes([60, 64, 67])).toBe('played');

			expect(mockSendNoteOn).toHaveBeenCalledTimes(3);
			expect(mockSendNoteOn).toHaveBeenCalledWith(60, 100, 0);
			expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
		});

		it('falls back to internal audio when MIDI is enabled but disconnected', () => {
			setMIDIEnabled(true);
			setMIDIConnectionState(false);

			expect(auditionNotes([60, 64, 67])).toBe('played');

			expect(mockSendNoteOn).not.toHaveBeenCalled();
			expect(triggeredNotes()).toEqual(['Note60', 'Note64', 'Note67']);
		});

		it('sends note-offs for its own notes when the step expires', () => {
			enableConnectedMIDI();

			auditionNotes([60, 64, 67]);
			vi.advanceTimersByTime(STEP_MS);

			expect(mockSendNoteOff.mock.calls.map((call) => call[0])).toEqual([60, 64, 67]);
		});

		it('leaves no orphan notes when auditions replace each other', () => {
			enableConnectedMIDI();

			auditionNotes([60, 64, 67]);
			mockSendNoteOff.mockClear();

			auditionNotes([62, 65, 69]);

			// The previous chord is turned off exactly once, before the new one starts
			expect(mockSendNoteOff.mock.calls.map((call) => call[0])).toEqual([60, 64, 67]);

			vi.advanceTimersByTime(STEP_MS * 4);
			const offNotes = mockSendNoteOff.mock.calls.map((call) => call[0]);
			expect(offNotes).toEqual([60, 64, 67, 62, 65, 69]);
			expect(mockSendNoteOn.mock.calls).toHaveLength(6);
		});

		it('does not turn on strummed notes that were cancelled mid-strum', () => {
			setMIDIEnabled(true);
			setMIDIConnectionState(true);
			setMIDIStrumEnabled(true);
			mockSendNoteOn.mockClear();

			auditionNotes([60, 64, 67]);
			// Only the first note of the strum has fired so far
			expect(mockSendNoteOn).toHaveBeenCalledTimes(1);

			cancelAudition();
			vi.advanceTimersByTime(STEP_MS * 4);

			expect(mockSendNoteOn).toHaveBeenCalledTimes(1);
			expect(mockSendNoteOff.mock.calls.map((call) => call[0])).toEqual([60]);
		});

		it('cancels the audition when the MIDI device disconnects', () => {
			enableConnectedMIDI();

			auditionNotes([60, 64, 67]);
			mockSendNoteOff.mockClear();

			setMIDIConnectionState(false);

			expect(mockSendNoteOff.mock.calls.map((call) => call[0])).toEqual([60, 64, 67]);
		});
	});

	describe('loop start cancels the preview', () => {
		it('silences a sounding MIDI audition before the MIDI loop starts', async () => {
			enableConnectedMIDI();

			auditionNotes([60, 64, 67]);
			mockSendNoteOff.mockClear();

			await startLoopingPlayback(() => [chord(60), null, null, null], 120);

			expect(mockSendNoteOff.mock.calls.map((call) => call[0])).toEqual([60, 64, 67]);
			expect(mockStartMIDILoop).toHaveBeenCalled();
		});

		it('releases preview voices and the piano before the Tone loop starts', async () => {
			auditionNotes([60, 64, 67]);
			expect(settingsState.pianoKeyboard.activeNotes).toEqual([60, 64, 67]);

			await startLoopingPlayback(() => [chord(60), null, null, null], 120);

			expect(mockReleaseAll).toHaveBeenCalled();
			expect(settingsState.pianoKeyboard.activeNotes).toEqual([]);
		});

		it('drops the pending chained step so it cannot sound over the loop', async () => {
			progressionState.progression = [chord(60), null, null, null];
			auditionChord(chord(65), { mode: 'click' });
			mockTriggerAttackRelease.mockClear();

			await startLoopingPlayback(() => [chord(60), null, null, null], 120);
			mockTransport.state = 'started';
			vi.advanceTimersByTime(STEP_MS * 4);

			expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
		});
	});
});
