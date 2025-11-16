import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	initAudio,
	playChord,
	playProgression,
	stopAll,
	disposeAudio
} from '$lib/utils/audio-playback';
import type { Chord } from '$lib/utils/theory-engine';

// Mock Tone.js using vi.hoisted to avoid hoisting issues
const {
	mockTriggerAttackRelease,
	mockReleaseAll,
	mockDispose,
	MockPolySynth,
	MockSynth,
	mockStart,
	mockFrequency,
	mockNow
} = vi.hoisted(() => {
	const mockTriggerAttackRelease = vi.fn();
	const mockReleaseAll = vi.fn();
	const mockDispose = vi.fn();

	const MockPolySynth = vi.fn(function (this: any) {
		this.triggerAttackRelease = mockTriggerAttackRelease;
		this.releaseAll = mockReleaseAll;
		this.dispose = mockDispose;
		this.toDestination = vi.fn(() => this);
		return this;
	});

	const MockSynth = vi.fn();

	const mockStart = vi.fn().mockResolvedValue(undefined);
	const mockFrequency = vi.fn((midi: number) => ({
		toNote: () => `Note${midi}`
	}));
	const mockNow = vi.fn(() => 0);

	return {
		mockTriggerAttackRelease,
		mockReleaseAll,
		mockDispose,
		MockPolySynth,
		MockSynth,
		mockStart,
		mockFrequency,
		mockNow
	};
});

vi.mock('tone', () => ({
	default: {
		start: mockStart,
		PolySynth: MockPolySynth,
		Synth: MockSynth,
		Frequency: mockFrequency,
		now: mockNow
	},
	PolySynth: MockPolySynth,
	Synth: MockSynth,
	Frequency: mockFrequency,
	start: mockStart,
	now: mockNow
}));

describe('audio-playback', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockTriggerAttackRelease.mockClear();
		mockReleaseAll.mockClear();
		mockDispose.mockClear();
		MockPolySynth.mockClear();
		mockStart.mockClear();
		mockFrequency.mockClear();
		mockNow.mockReturnValue(0);
	});

	afterEach(() => {
		// Clean up after each test
		disposeAudio();
	});

	describe('initAudio', () => {
		it('should initialize Tone.js and create PolySynth', async () => {
			await initAudio();

			expect(mockStart).toHaveBeenCalledOnce();
			expect(MockPolySynth).toHaveBeenCalledOnce();
		});

		it('should not reinitialize if already initialized', async () => {
			await initAudio();
			await initAudio();
			await initAudio();

			// Should only be called once despite multiple calls
			expect(mockStart).toHaveBeenCalledOnce();
			expect(MockPolySynth).toHaveBeenCalledOnce();
		});
	});

	describe('playChord', () => {
		it('should initialize audio on first call', async () => {
			await playChord([60, 64, 67]);

			expect(mockStart).toHaveBeenCalled();
		});

		it('should convert MIDI notes to note names', async () => {
			await playChord([60, 64, 67]);

			expect(mockFrequency).toHaveBeenCalledWith(60, 'midi');
			expect(mockFrequency).toHaveBeenCalledWith(64, 'midi');
			expect(mockFrequency).toHaveBeenCalledWith(67, 'midi');
		});

	it('should call triggerAttackRelease with note names and duration', async () => {
		await playChord([60, 64, 67], '4n');

		// Strum effect - each note triggered individually with delays
	expect(mockTriggerAttackRelease).toHaveBeenCalledTimes(3);
	expect(mockTriggerAttackRelease).toHaveBeenNthCalledWith(1, 'Note60', '4n', '+0');
	expect(mockTriggerAttackRelease).toHaveBeenNthCalledWith(2, 'Note64', '4n', '+0.05');
	expect(mockTriggerAttackRelease).toHaveBeenNthCalledWith(3, 'Note67', '4n', '+0.1');
	});

	it('should use default duration if not provided', async () => {
		await playChord([60, 64, 67]);

		// Strum effect with default duration
		expect(mockTriggerAttackRelease).toHaveBeenCalledTimes(3);
		expect(mockTriggerAttackRelease).toHaveBeenNthCalledWith(1, 'Note60', '2n', '+0');
		expect(mockTriggerAttackRelease).toHaveBeenNthCalledWith(2, 'Note64', '2n', '+0.05');
		expect(mockTriggerAttackRelease).toHaveBeenNthCalledWith(3, 'Note67', '2n', '+0.1');
	});

		it('should handle empty chord array', async () => {
			await expect(playChord([])).resolves.not.toThrow();
		});

		it('should handle single note', async () => {
			await playChord([60]);

			expect(mockFrequency).toHaveBeenCalledWith(60, 'midi');
		});
	});

	describe('playProgression', () => {
		const createChord = (root: number): Chord => ({
			root,
			quality: '',
			inversion: 0,
			voicing: 'close',
			octave: 0
		});

		it('should return early for empty progression', async () => {
			await playProgression([]);
			expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
		});

	it('should schedule each chord with offsets based on tempo', async () => {
		const chords = [createChord(60), createChord(62)];
		await playProgression(chords, 120);

		// Strum effect - 2 chords × 3 notes each = 6 calls
		expect(mockTriggerAttackRelease).toHaveBeenCalledTimes(6);
		// First chord (root 60 = C)
		expect(mockTriggerAttackRelease).toHaveBeenNthCalledWith(1, 'Note60', 2, 0.1);
		expect(mockTriggerAttackRelease).toHaveBeenNthCalledWith(2, 'Note64', 2, 0.1 + 0.05);
		expect(mockTriggerAttackRelease).toHaveBeenNthCalledWith(3, 'Note67', 2, 0.1 + 0.1);
		// Second chord (root 62 = D)
		expect(mockTriggerAttackRelease).toHaveBeenNthCalledWith(4, 'Note62', 2, 2.1);
		expect(mockTriggerAttackRelease).toHaveBeenNthCalledWith(5, 'Note66', 2, 2.1 + 0.05);
		expect(mockTriggerAttackRelease).toHaveBeenNthCalledWith(6, 'Note69', 2, 2.1 + 0.1);
	});

		it('should honor custom tempo values', async () => {
			const chords = [createChord(60), createChord(64)];
			await playProgression(chords, 60);

			// 60 BPM => 4 seconds per measure (4 beats)
			// Strum effect - check second chord's first note (call #4)
			expect(mockTriggerAttackRelease).toHaveBeenNthCalledWith(4, 'Note64', 4, 4.1);
		});
	});

	describe('stopAll', () => {
		it('should call releaseAll on synth', async () => {
			await initAudio();

			stopAll();

			expect(mockReleaseAll).toHaveBeenCalled();
		});

		it('should not throw if audio not initialized', () => {
			expect(() => stopAll()).not.toThrow();
		});
	});

	describe('disposeAudio', () => {
		it('should dispose synth and reset state', async () => {
			await initAudio();

			disposeAudio();

			expect(mockDispose).toHaveBeenCalled();
		});

		it('should allow reinitialization after disposal', async () => {
			await initAudio();
			disposeAudio();
			await initAudio();

			// Should be called twice (once before disposal, once after)
			expect(MockPolySynth).toHaveBeenCalledTimes(2);
		});

		it('should not throw if audio not initialized', () => {
			expect(() => disposeAudio()).not.toThrow();
		});
	});
});
