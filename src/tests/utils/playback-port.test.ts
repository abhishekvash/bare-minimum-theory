import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { playbackPort } from '$lib/utils/playback-port';
import { addChord, clearProgression, updateChord } from '$lib/stores/progression.svelte';
import { deselectSlot, resetUIState, selectSlot } from '$lib/stores/ui.svelte';
import { setMIDIConnectionState } from '$lib/stores/midi.svelte';
import type { Chord } from '$lib/utils/theory-engine';

const chord = (root: number): Chord => ({
	root,
	quality: '',
	inversion: 0,
	voicing: 'close',
	duration: '1m',
	octave: 0
});

describe('playback port', () => {
	beforeEach(() => {
		clearProgression();
		resetUIState();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('stores call through the port', () => {
		it('selecting and deselecting a slot interrupts the audition', () => {
			addChord(chord(60));
			addChord(chord(62));
			const interrupt = vi.spyOn(playbackPort, 'interruptAudition');

			selectSlot(1);
			expect(interrupt).toHaveBeenCalledTimes(1);

			deselectSlot();
			expect(interrupt).toHaveBeenCalledTimes(2);
		});

		it('losing the MIDI device interrupts the audition', () => {
			setMIDIConnectionState(true);
			const interrupt = vi.spyOn(playbackPort, 'interruptAudition');

			setMIDIConnectionState(false);
			expect(interrupt).toHaveBeenCalledTimes(1);
		});

		it('editing a slot reports the change and reads the playhead', () => {
			addChord(chord(60));
			const slotChanged = vi.spyOn(playbackPort, 'slotChanged');
			const playheadSlot = vi.spyOn(playbackPort, 'playheadSlot');

			updateChord(0, chord(65));
			expect(slotChanged).toHaveBeenCalledWith(0);
			expect(playheadSlot).toHaveBeenCalled();
		});
	});

	it('the playback layer wires its hooks when it loads', async () => {
		const audio = await import('$lib/utils/audio-playback');
		const controller = await import('$lib/utils/audition-controller');

		expect(playbackPort.slotChanged).toBe(audio.notifyChordUpdated);
		expect(playbackPort.interruptAudition).toBe(controller.cancelAudition);
		expect(playbackPort.playheadSlot()).toBeNull();
	});
});
