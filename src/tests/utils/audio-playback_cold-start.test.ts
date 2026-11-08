/**
 * Play pressed before Tone.js finished preloading: the audio context is created and resumed
 * synchronously inside the gesture, then handed to Tone once the module arrives.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const tone = vi.hoisted(() => ({
	start: vi.fn(async () => {}),
	setContext: vi.fn(),
	PolySynth: vi.fn(function (this: Record<string, unknown>) {
		this.toDestination = () => this;
		return this;
	}),
	Synth: vi.fn()
}));

vi.mock('tone', () => tone);

class FakeAudioContext {
	resume = vi.fn(async () => {});
}

describe('initAudio before the preload finished', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('unlocks a context inside the gesture and gives it to Tone', async () => {
		const created: FakeAudioContext[] = [];
		vi.stubGlobal(
			'AudioContext',
			vi.fn(function () {
				const context = new FakeAudioContext();
				created.push(context);
				return context;
			})
		);
		const { initAudio } = await import('#lib/utils/audio-playback.ts');

		const started = initAudio();
		// Synchronously, before any await could end the user's gesture
		expect(created).toHaveLength(1);
		expect(created[0].resume).toHaveBeenCalledOnce();

		await started;
		expect(tone.setContext).toHaveBeenCalledWith(created[0]);
		expect(tone.start).toHaveBeenCalledOnce();
	});
});
