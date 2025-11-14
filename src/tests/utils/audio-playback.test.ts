import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initAudio, playChord, stopAll, disposeAudio } from '$lib/utils/audio-playback';

// Mock Tone.js using vi.hoisted to avoid hoisting issues
const {
	mockTriggerAttackRelease,
	mockReleaseAll,
	mockDispose,
	MockPolySynth,
	mockStart,
	mockFrequency
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

	const mockStart = vi.fn().mockResolvedValue(undefined);
	const mockFrequency = vi.fn((midi: number) => ({
		toNote: () => `Note${midi}`
	}));

	return {
		mockTriggerAttackRelease,
		mockReleaseAll,
		mockDispose,
		MockPolySynth,
		mockStart,
		mockFrequency
	};
});

vi.mock('tone', () => ({
	default: {
		start: mockStart,
		PolySynth: MockPolySynth,
		Frequency: mockFrequency
	},
	PolySynth: MockPolySynth,
	Frequency: mockFrequency,
	start: mockStart
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

			expect(mockTriggerAttackRelease).toHaveBeenCalledWith(['Note60', 'Note64', 'Note67'], '4n');
		});

		it('should use default duration if not provided', async () => {
			await playChord([60, 64, 67]);

			expect(mockTriggerAttackRelease).toHaveBeenCalledWith(
				expect.any(Array),
				'2n' // Default duration
			);
		});

		it('should handle empty chord array', async () => {
			await expect(playChord([])).resolves.not.toThrow();
		});

		it('should handle single note', async () => {
			await playChord([60]);

			expect(mockFrequency).toHaveBeenCalledWith(60, 'midi');
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
