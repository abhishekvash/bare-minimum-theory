import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chord } from '$lib/utils/theory-engine';

const {
	mockTriggerAttackRelease,
	mockReleaseAll,
	mockDispose,
	mockScheduleRepeat,
	mockScheduleOnce,
	mockClear,
	mockCancelAudition,
	mockTransport,
	scheduledOnceCallbacks,
	MockPolySynth
} = vi.hoisted(() => {
	let nextEventId = 1;
	const scheduledOnceCallbacks = new Map<number, () => void>();
	const mockTriggerAttackRelease = vi.fn();
	const mockReleaseAll = vi.fn();
	const mockDispose = vi.fn();
	const mockScheduleRepeat = vi.fn(
		(_callback: (time: number) => void, _interval: number, _offset: number) => nextEventId++
	);
	const mockScheduleOnce = vi.fn((callback: () => void, _time: string | number) => {
		const id = nextEventId++;
		scheduledOnceCallbacks.set(id, callback);
		return id;
	});
	const mockClear = vi.fn();
	const mockCancelAudition = vi.fn();

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
		seconds: 0,
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
		mockCancelAudition,
		mockTransport,
		scheduledOnceCallbacks,
		MockPolySynth
	};
});

const durationSeconds: Record<string, number> = {
	'1i': 0.01,
	'8n': 0.25,
	'4n': 0.5,
	'2n': 1,
	'1m': 2,
	'2m': 4
};

vi.mock('tone', () => ({
	PolySynth: MockPolySynth,
	Synth: vi.fn(),
	Frequency: vi.fn((midi: number) => ({ toNote: () => `Note${midi}` })),
	Time: vi.fn((duration: string | number) => ({
		toSeconds: () => (typeof duration === 'number' ? duration : (durationSeconds[duration] ?? 2))
	})),
	Transport: mockTransport,
	start: vi.fn().mockResolvedValue(undefined),
	now: vi.fn(() => 0)
}));

vi.mock('$lib/stores/progression.svelte', () => ({
	hasNonNullChords: (progression: (Chord | null)[]) => progression.some(Boolean)
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

vi.mock('$lib/utils/audition-controller', () => ({
	cancelAudition: mockCancelAudition
}));

vi.mock('$lib/utils/midi-output', () => ({
	startMIDILoop: vi.fn(),
	stopMIDILoop: vi.fn(),
	getMIDIPlaybackProgress: vi.fn(() => null),
	isMIDILoopPlaying: vi.fn(() => false)
}));

import {
	disposeAudio,
	notifyChordUpdated,
	startLoopingPlayback,
	stopLoopingPlayback
} from '$lib/utils/audio-playback';

const createChord = (root: number, duration: string): Chord => ({
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
		mockTransport.seconds = 0;
		mockTransport.position = 0;
	});

	afterEach(() => {
		stopLoopingPlayback();
		disposeAudio();
	});

	it('prepares a duration rebuild at a reachable tick before the boundary and commits at wrap', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		expect(mockTransport.loopEnd).toBe(4);

		mockScheduleRepeat.mockClear();
		mockScheduleOnce.mockClear();
		mockClear.mockClear();
		mockTransport.seconds = 1;
		progression[0].duration = '2n';

		notifyChordUpdated(0);

		expect(mockScheduleOnce).toHaveBeenCalledOnce();
		const preparationTime = mockScheduleOnce.mock.calls[0][1];
		expect(preparationTime).toBe('+2.99');
		const resolvedPreparationTime =
			mockTransport.seconds + Number((preparationTime as string).slice(1));
		expect(resolvedPreparationTime).toBeCloseTo(3.99);
		expect(resolvedPreparationTime).toBeLessThan(4);
		expect(mockTransport.loopEnd).toBe(4);
		expect(mockClear).not.toHaveBeenCalled();

		runNextScheduledOnce();

		expect(mockTransport.loopEnd).toBe(4);
		expect(mockClear).toHaveBeenCalledTimes(2);
		expect(mockScheduleRepeat.mock.calls.map((call) => call.slice(1))).toEqual([
			[3, 0],
			[3, 1]
		]);
		expect(mockScheduleOnce).toHaveBeenLastCalledWith(expect.any(Function), 0);

		runNextScheduledOnce();
		expect(mockTransport.loopEnd).toBe(3);
	});

	it('coalesces multiple structural edits before the boundary using the latest progression', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		mockScheduleRepeat.mockClear();
		mockScheduleOnce.mockClear();
		mockTransport.seconds = 1;

		progression[0].duration = '2n';
		notifyChordUpdated(0);
		progression[1].duration = '2m';
		notifyChordUpdated(1);

		expect(mockScheduleOnce).toHaveBeenCalledOnce();
		runNextScheduledOnce();
		expect(mockScheduleRepeat.mock.calls.map((call) => call.slice(1))).toEqual([
			[5, 0],
			[5, 1]
		]);
		expect(mockTransport.loopEnd).toBe(4);
		runNextScheduledOnce();
		expect(mockTransport.loopEnd).toBe(5);
	});

	it('defers preparation to the following boundary when the current one is within a tick', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		mockScheduleOnce.mockClear();
		mockTransport.seconds = 3.995;
		progression[0].duration = '2n';

		notifyChordUpdated(0);

		const preparationTime = mockScheduleOnce.mock.calls[0][1] as string;
		const preparationDelay = Number(preparationTime.slice(1));
		expect(preparationDelay).toBeGreaterThan(3.9);
		expect(preparationTime).not.toContain('e-');
		expect(mockTransport.seconds + preparationDelay).toBeCloseTo(7.99);
	});

	it('cancels a pending rebuild on Stop and allows structural edits after restarting', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);
		mockTransport.seconds = 1;
		progression[0].duration = '2n';
		notifyChordUpdated(0);
		expect(scheduledOnceCallbacks.size).toBe(1);

		stopLoopingPlayback();
		expect(scheduledOnceCallbacks.size).toBe(0);

		const restartedProgression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => restartedProgression, 120);
		mockScheduleOnce.mockClear();
		mockTransport.seconds = 0.5;
		restartedProgression[0].duration = '2n';
		notifyChordUpdated(0);

		expect(mockScheduleOnce).toHaveBeenCalledOnce();
	});

	it('rebuilds after removing the last slot even when the new loop is shorter than the position', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m'), createChord(64, '1m')];
		await startLoopingPlayback(() => progression, 120);
		expect(mockTransport.loopEnd).toBe(6);
		mockScheduleRepeat.mockClear();
		mockScheduleOnce.mockClear();
		mockTransport.seconds = 5.5;

		progression.splice(2, 1);
		notifyChordUpdated(2);

		expect(mockScheduleOnce).toHaveBeenCalledWith(expect.any(Function), '+0.49');
		runNextScheduledOnce();
		expect(mockTransport.loopEnd).toBe(6);
		expect(mockScheduleRepeat.mock.calls.map((call) => call.slice(1))).toEqual([
			[4, 0],
			[4, 2]
		]);
		runNextScheduledOnce();
		expect(mockTransport.loopEnd).toBe(4);
	});

	it('keeps harmony-only edits on the next not-yet-reached arrival', async () => {
		const progression = [createChord(60, '1m'), createChord(62, '1m')];
		await startLoopingPlayback(() => progression, 120);

		mockScheduleRepeat.mockClear();
		mockScheduleOnce.mockClear();
		mockClear.mockClear();
		mockTriggerAttackRelease.mockClear();
		mockTransport.seconds = 0.5;
		progression[1] = createChord(65, '1m');

		notifyChordUpdated(1);

		expect(mockScheduleOnce).not.toHaveBeenCalled();
		expect(mockClear).toHaveBeenCalledOnce();
		expect(mockScheduleRepeat).toHaveBeenCalledOnce();
		expect(mockScheduleRepeat.mock.calls[0].slice(1)).toEqual([4, 2]);

		const nextArrival = mockScheduleRepeat.mock.calls[0][0] as (time: number) => void;
		nextArrival(10);
		expect(mockTriggerAttackRelease).toHaveBeenCalledWith('Note65', 2, 10);
		expect(mockTriggerAttackRelease).not.toHaveBeenCalledWith('Note62', 2, 10);
	});
});
