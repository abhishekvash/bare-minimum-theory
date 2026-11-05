import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chord, ChordDuration } from '$lib/utils/theory-engine';

const {
	mockTriggerAttackRelease,
	mockScheduleRepeat,
	mockScheduleOnce,
	mockClear,
	mockStart,
	mockTransport,
	scheduledOnceCallbacks,
	MockPolySynth
} = vi.hoisted(() => {
	let nextEventId = 1;
	const scheduledOnceCallbacks = new Map<number, () => void>();
	const mockTriggerAttackRelease = vi.fn();
	const mockReleaseAll = vi.fn();
	const mockDispose = vi.fn();
	const mockScheduleRepeat = vi.fn((...args: [(time: number) => void, number, number]) => {
		void args;
		return nextEventId++;
	});
	const mockScheduleOnce = vi.fn((...args: [() => void, string | number]) => {
		const [callback] = args;
		const id = nextEventId++;
		scheduledOnceCallbacks.set(id, callback);
		return id;
	});
	const mockClear = vi.fn();
	const mockStart = vi.fn().mockResolvedValue(undefined);

	const MockPolySynth = vi.fn(function (this: Record<string, unknown>) {
		this.triggerAttackRelease = mockTriggerAttackRelease;
		this.releaseAll = mockReleaseAll;
		this.dispose = mockDispose;
		this.toDestination = vi.fn(() => this);
		return this;
	});

	const mockTransport = {
		bpm: { value: 120, rampTo: vi.fn() },
		state: 'stopped',
		loop: false,
		loopStart: 0,
		loopEnd: 0 as number | string,
		ticks: 0,
		position: 0,
		scheduleRepeat: mockScheduleRepeat,
		scheduleOnce: mockScheduleOnce,
		clear: mockClear,
		start: vi.fn(() => {
			mockTransport.state = 'started';
		}),
		stop: vi.fn(() => {
			mockTransport.state = 'stopped';
		}),
		cancel: vi.fn(() => scheduledOnceCallbacks.clear())
	};

	return {
		mockTriggerAttackRelease,
		mockReleaseAll,
		mockDispose,
		mockScheduleRepeat,
		mockScheduleOnce,
		mockClear,
		mockStart,
		mockTransport,
		scheduledOnceCallbacks,
		MockPolySynth
	};
});

const durationSeconds: Record<string, number> = {
	'8n': 0.25,
	'4n': 0.5,
	'2n': 1,
	'1m': 2,
	'2m': 4
};

// 192 PPQ: one bar of 4/4 is 768 ticks at any tempo.
const durationTicks: Record<string, number> = {
	'8n': 96,
	'4n': 192,
	'2n': 384,
	'1m': 768,
	'2m': 1536
};
const BAR = 768;
const i = (ticks: number) => `${ticks}i`;

vi.mock('tone', () => ({
	PolySynth: MockPolySynth,
	Synth: vi.fn(),
	Frequency: vi.fn((midi: number) => ({ toNote: () => `Note${midi}` })),
	Time: vi.fn((duration: string | number) => ({
		toSeconds: () => (typeof duration === 'number' ? duration : (durationSeconds[duration] ?? 2)),
		toTicks: () => (typeof duration === 'number' ? duration : (durationTicks[duration] ?? BAR))
	})),
	Transport: mockTransport,
	start: mockStart,
	now: vi.fn(() => 0)
}));

vi.mock('$lib/stores/midi.svelte', () => ({
	midiState: {
		enabled: false,
		isConnected: false,
		velocity: 100,
		midiChannel: 1
	}
}));

vi.mock('$lib/stores/settings.svelte', () => ({
	setActiveNotes: vi.fn(),
	clearActiveNotes: vi.fn()
}));

vi.mock('$lib/utils/midi-output', () => ({
	startMIDILoop: vi.fn(),
	stopMIDILoop: vi.fn(),
	getMIDIPlaybackProgress: vi.fn(() => null),
	isMIDILoopPlaying: vi.fn(() => false)
}));

import {
	disposeAudio,
	getPlaybackProgress,
	initPreviewAudio,
	notifyChordUpdated,
	getTransportStatus,
	startLoopingPlayback,
	stopLoopingPlayback
} from '$lib/utils/audio-playback';
import { uiState } from '$lib/stores/ui.svelte';

const createChord = (root: number, duration: ChordDuration): Chord => ({
	root,
	quality: '',
	inversion: 0,
	voicing: 'close',
	octave: 0,
	duration
});

function runNextScheduledOnce(): void {
	const nextEntry = scheduledOnceCallbacks.entries().next().value as
		| [number, () => void]
		| undefined;
	if (!nextEntry) throw new Error('Expected a scheduled one-shot callback');
	scheduledOnceCallbacks.delete(nextEntry[0]);
	nextEntry[1]();
}

describe('Tone loop edit timing', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		scheduledOnceCallbacks.clear();
		mockTransport.state = 'stopped';
		mockTransport.loop = false;
		mockTransport.loopStart = 0;
		mockTransport.loopEnd = 0;
		mockTransport.ticks = 0;
		mockTransport.position = 0;
	});

	afterEach(() => {
		stopLoopingPlayback();
		disposeAudio();
	});

	it('prepares a duration rebuild on the last tick of the loop and commits at wrap', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		expect(mockTransport.loopEnd).toBe(i(2 * BAR));

		mockScheduleRepeat.mockClear();
		mockScheduleOnce.mockClear();
		mockClear.mockClear();
		mockTransport.ticks = 384;
		progression[0].duration = '2n';

		notifyChordUpdated(0);

		expect(mockScheduleOnce).toHaveBeenCalledOnce();
		expect(mockScheduleOnce.mock.calls[0][1]).toBe(i(2 * BAR - 1));
		expect(mockTransport.loopEnd).toBe(i(2 * BAR));
		expect(mockClear).not.toHaveBeenCalled();

		runNextScheduledOnce();

		expect(mockTransport.loopEnd).toBe(i(2 * BAR));
		expect(mockClear).toHaveBeenCalledTimes(2);
		expect(mockScheduleRepeat.mock.calls.map((call) => call.slice(1))).toEqual([
			[i(1152), i(0)],
			[i(1152), i(384)]
		]);
		expect(mockScheduleOnce).toHaveBeenLastCalledWith(expect.any(Function), 0);

		runNextScheduledOnce();
		expect(mockTransport.loopEnd).toBe(i(1152));
	});

	it('rebuilds again when a structural edit lands between preparation and commit', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		mockTransport.ticks = 384;
		progression[0].duration = '2n';
		notifyChordUpdated(0);

		// Preparation runs on the last tick; the commit is still pending at tick 0
		runNextScheduledOnce();
		mockScheduleOnce.mockClear();
		progression[1].duration = '2m';
		notifyChordUpdated(1);
		expect(mockScheduleOnce).not.toHaveBeenCalled();

		// The commit installs the prepared timing, then queues a rebuild for the newer edit
		runNextScheduledOnce();
		expect(mockTransport.loopEnd).toBe(i(1152));
		expect(mockScheduleOnce).toHaveBeenCalledWith(expect.any(Function), i(1151));

		mockScheduleRepeat.mockClear();
		runNextScheduledOnce();
		expect(mockScheduleRepeat.mock.calls.map((call) => call.slice(1))).toEqual([
			[i(1920), i(0)],
			[i(1920), i(384)]
		]);
		runNextScheduledOnce();
		expect(mockTransport.loopEnd).toBe(i(1920));
		expect(scheduledOnceCallbacks.size).toBe(0);
	});

	it('does not queue another rebuild when nothing changed after preparation', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		mockTransport.ticks = 384;
		progression[0].duration = '2n';
		notifyChordUpdated(0);

		runNextScheduledOnce();
		runNextScheduledOnce();

		expect(scheduledOnceCallbacks.size).toBe(0);
	});

	it('rebuilds when duration order changes without changing length or total duration', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '2n')];
		await startLoopingPlayback(() => progression, 120);
		mockScheduleOnce.mockClear();
		mockTransport.ticks = 192;
		[progression[0], progression[1]] = [progression[1], progression[0]];

		notifyChordUpdated(0);

		expect(mockScheduleOnce).toHaveBeenCalledOnce();
	});

	it('shares one Tone.start call across concurrent preview and loop initialization', async () => {
		disposeAudio();
		let resolveStart!: () => void;
		mockStart.mockImplementationOnce(
			() => new Promise<void>((resolve) => (resolveStart = resolve))
		);
		const progression = [createChord(60, '1m')];

		const preview = initPreviewAudio();
		const loop = startLoopingPlayback(() => progression, 120);
		expect(mockStart).toHaveBeenCalledOnce();
		resolveStart();
		await Promise.all([preview, loop]);

		expect(mockStart).toHaveBeenCalledOnce();
		expect(MockPolySynth).toHaveBeenCalledTimes(2);
	});

	it('coalesces multiple structural edits before the boundary using the latest progression', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		mockScheduleRepeat.mockClear();
		mockScheduleOnce.mockClear();
		mockTransport.ticks = 384;

		progression[0].duration = '2n';
		notifyChordUpdated(0);
		progression[1].duration = '2m';
		notifyChordUpdated(1);

		expect(mockScheduleOnce).toHaveBeenCalledOnce();
		runNextScheduledOnce();
		expect(mockScheduleRepeat.mock.calls.map((call) => call.slice(1))).toEqual([
			[i(1920), i(0)],
			[i(1920), i(384)]
		]);
		expect(mockTransport.loopEnd).toBe(i(2 * BAR));
		runNextScheduledOnce();
		expect(mockTransport.loopEnd).toBe(i(1920));
	});

	it('schedules preparation at an absolute in-loop tick even when edited on the last tick', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		mockScheduleOnce.mockClear();
		mockTransport.ticks = 2 * BAR - 1;
		progression[0].duration = '2n';

		notifyChordUpdated(0);

		// Absolute tick inside [0, loopEnd): Tone reaches it on the next lap if it has passed.
		expect(mockScheduleOnce).toHaveBeenCalledWith(expect.any(Function), i(2 * BAR - 1));
	});

	it('does not latch structural edits when the preparation runs on a later lap', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		mockTransport.ticks = 2 * BAR - 1;
		progression[0].duration = '2n';
		notifyChordUpdated(0);

		// Next lap: preparation and commit both fire.
		runNextScheduledOnce();
		runNextScheduledOnce();
		expect(mockTransport.loopEnd).toBe(i(1152));

		mockScheduleOnce.mockClear();
		mockTransport.ticks = 100;
		progression[1].duration = '2n';
		notifyChordUpdated(1);
		expect(mockScheduleOnce).toHaveBeenCalledWith(expect.any(Function), i(1151));
	});

	it('cancels a pending rebuild on Stop and allows structural edits after restarting', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		mockTransport.ticks = 384;
		progression[0].duration = '2n';
		notifyChordUpdated(0);
		expect(scheduledOnceCallbacks.size).toBe(1);

		stopLoopingPlayback();
		expect(scheduledOnceCallbacks.size).toBe(0);

		const restartedProgression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => restartedProgression, 120);
		mockScheduleOnce.mockClear();
		mockTransport.ticks = 192;
		restartedProgression[0].duration = '2n';
		notifyChordUpdated(0);

		expect(mockScheduleOnce).toHaveBeenCalledOnce();
	});

	it('rebuilds after removing the last slot even when the new loop is shorter than the position', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m'), createChord(64, '1m')];
		await startLoopingPlayback(() => progression, 120);
		expect(mockTransport.loopEnd).toBe(i(3 * BAR));
		mockScheduleRepeat.mockClear();
		mockScheduleOnce.mockClear();
		mockTransport.ticks = 2112;

		progression.splice(2, 1);
		notifyChordUpdated(2);

		expect(mockScheduleOnce).toHaveBeenCalledWith(expect.any(Function), i(3 * BAR - 1));
		runNextScheduledOnce();
		expect(mockTransport.loopEnd).toBe(i(3 * BAR));
		expect(mockScheduleRepeat.mock.calls.map((call) => call.slice(1))).toEqual([
			[i(2 * BAR), i(0)],
			[i(2 * BAR), i(BAR)]
		]);
		runNextScheduledOnce();
		expect(mockTransport.loopEnd).toBe(i(2 * BAR));
	});

	it('keeps the old duration for current-cycle callbacks until the boundary rebuild', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		const currentCycleArrival = mockScheduleRepeat.mock.calls[1][0] as (time: number) => void;
		mockTransport.ticks = 192;
		progression[1].duration = '2m';

		notifyChordUpdated(1);
		mockTriggerAttackRelease.mockClear();
		currentCycleArrival(10);
		expect(mockTriggerAttackRelease).toHaveBeenCalledWith('Note62', 2, 10);

		runNextScheduledOnce();
		const rebuiltArrival = mockScheduleRepeat.mock.calls.at(-1)?.[0] as (time: number) => void;
		mockTriggerAttackRelease.mockClear();
		rebuiltArrival(20);
		expect(mockTriggerAttackRelease).toHaveBeenCalledWith('Note62', 4, 20);
	});

	it('keeps progress on the audible timing snapshot until the rebuilt boundary', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		mockTransport.ticks = 960;
		progression[0].duration = '2n';

		notifyChordUpdated(0);
		expect(getPlaybackProgress()).toEqual({ chordIndex: 1, progress: 25 });

		runNextScheduledOnce();
		expect(getPlaybackProgress()).toEqual({ chordIndex: 1, progress: 25 });
		runNextScheduledOnce();
		expect(getPlaybackProgress()).toEqual({ chordIndex: 1, progress: 75 });
	});

	it('does not touch transport when Stop arrives while audio is still starting', async () => {
		let resolveStart!: () => void;
		mockStart.mockImplementationOnce(
			() => new Promise<void>((resolve) => (resolveStart = resolve))
		);
		const progression = [createChord(60, '1m')];
		mockTransport.start.mockClear();

		const loop = startLoopingPlayback(() => progression, 120);
		expect(getTransportStatus()).toBe('starting');
		stopLoopingPlayback();
		expect(getTransportStatus()).toBe('stopped');
		resolveStart();

		expect(await loop).toBe(false);
		expect(mockTransport.start).not.toHaveBeenCalled();
		expect(getTransportStatus()).toBe('stopped');
		expect(uiState.transportActive).toBe(false);
	});

	it('reports playing and publishes the mirror once the loop starts', async () => {
		const progression = [createChord(60, '1m')];

		expect(await startLoopingPlayback(() => progression, 120)).toBe(true);

		expect(getTransportStatus()).toBe('playing');
		expect(uiState.transportActive).toBe(true);

		stopLoopingPlayback();
		expect(getTransportStatus()).toBe('stopped');
		expect(uiState.transportActive).toBe(false);
	});

	it('ignores a second start while one is already starting or playing', async () => {
		let resolveStart!: () => void;
		mockStart.mockImplementationOnce(
			() => new Promise<void>((resolve) => (resolveStart = resolve))
		);
		const progression = [createChord(60, '1m')];
		mockTransport.start.mockClear();

		const first = startLoopingPlayback(() => progression, 120);
		expect(await startLoopingPlayback(() => progression, 120)).toBe(false);
		resolveStart();
		expect(await first).toBe(true);
		expect(await startLoopingPlayback(() => progression, 120)).toBe(false);

		expect(mockTransport.start).toHaveBeenCalledOnce();
	});

	it('keeps harmony-only edits on the next not-yet-reached arrival', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);

		mockScheduleRepeat.mockClear();
		mockScheduleOnce.mockClear();
		mockClear.mockClear();
		mockTriggerAttackRelease.mockClear();
		mockTransport.ticks = 192;
		progression[1] = createChord(65, '1m');

		notifyChordUpdated(1);

		expect(mockScheduleOnce).not.toHaveBeenCalled();
		expect(mockClear).toHaveBeenCalledOnce();
		expect(mockScheduleRepeat).toHaveBeenCalledOnce();
		expect(mockScheduleRepeat.mock.calls[0].slice(1)).toEqual([i(2 * BAR), i(BAR)]);

		const nextArrival = mockScheduleRepeat.mock.calls[0][0] as (time: number) => void;
		nextArrival(10);
		expect(mockTriggerAttackRelease).toHaveBeenCalledWith('Note65', 2, 10);
		expect(mockTriggerAttackRelease).not.toHaveBeenCalledWith('Note62', 2, 10);
	});

	it('keeps the playhead on the right chord after a tempo change', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);

		// Ticks are tempo-independent: halfway through bar 2 is the same tick at 240 BPM.
		mockTransport.bpm.value = 240;
		mockTransport.ticks = BAR + BAR / 2;
		expect(getPlaybackProgress()).toEqual({ chordIndex: 1, progress: 50 });
	});

	it('treats harmony edits after a tempo change as non-structural', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		mockScheduleOnce.mockClear();
		mockTransport.bpm.value = 240;
		mockTransport.ticks = 100;

		progression[1] = createChord(65, '1m');
		notifyChordUpdated(1);

		expect(mockScheduleOnce).not.toHaveBeenCalled();
	});

	it('uses duration edits made while audio was starting on the first Play', async () => {
		disposeAudio();
		let resolveStart!: () => void;
		mockStart.mockImplementationOnce(
			() => new Promise<void>((resolve) => (resolveStart = resolve))
		);
		const progression = [createChord(60, '1m'), createChord(62, '1m')];

		const started = startLoopingPlayback(() => progression, 120);
		progression[0].duration = '2n';
		progression.push(createChord(64, '1m'));
		resolveStart();
		await started;

		expect(mockTransport.loopEnd).toBe(i(384 + 2 * BAR));
		expect(mockScheduleRepeat.mock.calls.map((call) => call[2])).toEqual([
			i(0),
			i(384),
			i(384 + BAR)
		]);
	});
});
