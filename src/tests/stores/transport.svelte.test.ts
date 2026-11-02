import { describe, it, expect, vi, beforeEach } from 'vitest';

const audio = vi.hoisted(() => ({
	getCurrentBpm: vi.fn(() => 120),
	getTransportStatus: vi.fn(() => 'stopped'),
	startLoopingPlayback: vi.fn(async () => {}),
	stopLoopingPlayback: vi.fn()
}));
const toastError = vi.hoisted(() => vi.fn());

vi.mock('$lib/utils/audio-playback', () => audio);
vi.mock('svelte-sonner', () => ({ toast: { error: toastError } }));

import {
	getActiveBpm,
	startProgressionPlayback,
	stopProgressionPlayback
} from '$lib/stores/transport.svelte';
import { setClockSyncEnabled, setDetectedBpm } from '$lib/stores/midi.svelte';

describe('transport store', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		audio.getTransportStatus.mockReturnValue('stopped');
		setClockSyncEnabled(false);
		setDetectedBpm(null);
	});

	describe('getActiveBpm', () => {
		it('uses the default tempo without clock sync', () => {
			setDetectedBpm(98);
			expect(getActiveBpm()).toBe(120);
		});

		it('uses the detected DAW tempo when clock sync is on', () => {
			setClockSyncEnabled(true);
			setDetectedBpm(98);
			expect(getActiveBpm()).toBe(98);
		});

		it('falls back to the default until a tempo is detected', () => {
			setClockSyncEnabled(true);
			expect(getActiveBpm()).toBe(120);
		});
	});

	describe('startProgressionPlayback', () => {
		it('starts the loop at the active tempo', async () => {
			await startProgressionPlayback();
			expect(audio.startLoopingPlayback).toHaveBeenCalledWith(expect.any(Function), 120);
		});

		it('does nothing unless the transport is stopped', async () => {
			audio.getTransportStatus.mockReturnValue('starting');
			await startProgressionPlayback();
			expect(audio.startLoopingPlayback).not.toHaveBeenCalled();
		});

		it('reports a failed start and leaves the transport stopped', async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			audio.startLoopingPlayback.mockRejectedValueOnce(new Error('no audio'));

			await startProgressionPlayback();

			expect(toastError).toHaveBeenCalledWith('Failed to play progression', expect.anything());
			expect(audio.stopLoopingPlayback).toHaveBeenCalled();
		});
	});

	it('stopProgressionPlayback stops the loop', () => {
		stopProgressionPlayback();
		expect(audio.stopLoopingPlayback).toHaveBeenCalled();
	});
});
