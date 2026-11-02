/**
 * Mouse-path walkthroughs for the two ticket-defining flows. These mount the builder and canvas
 * together so the assertions cross the real component/store seams rather than reimplementing them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import CoreLoopHarness from './CoreLoopHarness.svelte';
import type { Chord } from '$lib/utils/theory-engine';
import {
	addChord,
	clearBuilderState,
	clearProgression,
	progressionState
} from '$lib/stores/progression.svelte';
import { resetUIState, selectSlot, uiState } from '$lib/stores/ui.svelte';

const { toneMock } = vi.hoisted(() => {
	const Transport = {
		state: 'stopped',
		ticks: 0,
		position: 0,
		loop: false,
		loopStart: 0,
		loopEnd: 0,
		bpm: { value: 120, rampTo: vi.fn() },
		scheduleRepeat: vi.fn(() => 1),
		scheduleOnce: vi.fn(() => 1),
		clear: vi.fn(),
		start: vi.fn(() => {
			Transport.state = 'started';
		}),
		stop: vi.fn(() => {
			Transport.state = 'stopped';
		}),
		cancel: vi.fn()
	};

	return {
		toneMock: {
			start: vi.fn().mockResolvedValue(undefined),
			PolySynth: vi.fn(function (this: Record<string, unknown>) {
				this.triggerAttackRelease = vi.fn();
				this.releaseAll = vi.fn();
				this.dispose = vi.fn();
				this.toDestination = vi.fn(() => this);
				return this;
			}),
			Synth: vi.fn(),
			Frequency: vi.fn((midi: number) => ({ toNote: () => `Note${midi}` })),
			now: vi.fn(() => 0),
			Time: vi.fn(() => ({ toSeconds: () => 2, toTicks: () => 768 })),
			Transport
		}
	};
});

vi.mock('tone', () => ({ default: toneMock, ...toneMock }));

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

function chord(root = 60, quality: Chord['quality'] = 'maj7'): Chord {
	return { root, quality, inversion: 0, voicing: 'close', octave: 0, duration: '1m' };
}

function renderCoreLoop(): void {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(CoreLoopHarness, { target });
	flushSync();
}

function quality(qualityName: Chord['quality']): HTMLButtonElement {
	const button = target.querySelector<HTMLButtonElement>(`[data-quality="${qualityName}"]`);
	if (!button) throw new Error(`quality ${qualityName} not rendered`);
	return button;
}

function buttonNamed(name: string): HTMLButtonElement {
	const button = Array.from(target.querySelectorAll<HTMLButtonElement>('button')).find(
		(candidate) => candidate.textContent?.includes(name)
	);
	if (!button) throw new Error(`button containing ${name} not rendered`);
	return button;
}

describe('core loop walkthroughs', () => {
	beforeEach(() => {
		toneMock.Transport.state = 'stopped';
		clearProgression();
		clearBuilderState();
		resetUIState();
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
		toneMock.Transport.state = 'stopped';
	});

	it('Flow 1: build, Add, then Play without dragging', async () => {
		renderCoreLoop();
		expect(target.textContent).toContain('Build a chord below, then add it here');

		target.querySelector<HTMLButtonElement>('[data-root="60"]')?.click();
		flushSync();
		quality('maj7').click();
		flushSync();
		expect(target.querySelector('[data-ready-bar]')?.textContent).toContain('Cmaj7');

		buttonNamed('+ Add to progression').click();
		flushSync();
		expect(progressionState.progression[0]).toEqual(chord());
		expect(target.querySelector('[data-ready-bar]')).not.toBeNull();
		expect(target.textContent).not.toContain('Build a chord below, then add it here');

		target.querySelector<HTMLButtonElement>('[data-action="play"]')?.click();
		await vi.waitFor(() => expect(uiState.transportActive).toBe(true));
		expect(target.querySelector('[data-action="stop"]')).not.toBeNull();
	});

	it('Flow 2c: stage, keep, revert, then stop and decide', async () => {
		addChord(chord());
		selectSlot(0);
		renderCoreLoop();
		target.querySelector<HTMLButtonElement>('[data-action="play"]')?.click();
		await vi.waitFor(() => expect(uiState.transportActive).toBe(true));

		// Stage and keep.
		quality('m9').click();
		flushSync();
		expect(target.querySelector('[data-audition-badge]')).not.toBeNull();
		buttonNamed('Commit').click();
		flushSync();
		expect(progressionState.audition).toBeNull();
		expect(progressionState.progression[0]?.quality).toBe('m9');

		// Stage and revert while still playing.
		quality('7').click();
		flushSync();
		target.querySelector<HTMLButtonElement>('[data-audition-badge]')?.click();
		flushSync();
		expect(progressionState.audition).toBeNull();
		expect(progressionState.progression[0]?.quality).toBe('m9');

		// Stop preserves the decision, and Revert remains available afterward.
		quality('dim').click();
		flushSync();
		target.querySelector<HTMLButtonElement>('[data-action="stop"]')?.click();
		await vi.waitFor(() => expect(uiState.transportActive).toBe(false));
		expect(target.querySelector('[data-audition-badge]')).not.toBeNull();
		target.querySelector<HTMLButtonElement>('[data-audition-badge]')?.click();
		flushSync();
		expect(progressionState.progression[0]?.quality).toBe('m9');
		expect(progressionState.audition).toBeNull();
	});
});
