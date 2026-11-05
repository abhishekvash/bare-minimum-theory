/**
 * Onboarding tour: when it starts on its own, and that the demo chord and selection it
 * creates are put back when the tour ends. driver.js is replaced by a recording fake.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config, DriveStep } from 'driver.js';
import type { Chord } from '$lib/utils/theory-engine';
import {
	addChord,
	clearBuilderState,
	clearProgression,
	placeChordAt,
	progressionState,
	selectQuality,
	selectRoot
} from '$lib/stores/progression.svelte';
import { resetUIState, uiState } from '$lib/stores/ui.svelte';
import { hasSeenTour, markTourSeen } from '$lib/utils/onboarding-persistence';
import type { SavedProgression } from '$lib/utils/progression-persistence';

const fakeDriver = vi.hoisted(() => {
	const state = {
		config: null as Config | null,
		instance: null as null | {
			drive: ReturnType<typeof vi.fn>;
			moveNext: ReturnType<typeof vi.fn>;
			destroy: () => void;
		}
	};
	const driver = vi.fn((config: Config) => {
		state.config = config;
		state.instance = {
			drive: vi.fn(),
			moveNext: vi.fn(),
			destroy: () => config.onDestroyed?.(undefined, {} as DriveStep, {} as never)
		};
		return state.instance;
	});
	return { state, driver };
});

vi.mock('driver.js', () => ({ driver: fakeDriver.driver }));
vi.mock('driver.js/dist/driver.css', () => ({}));

const { buildTourSteps, shouldAutoStartTour, startTour } = await import(
	'$lib/utils/onboarding-tour'
);

const CHORD: Chord = {
	root: 62,
	quality: 'm7',
	inversion: 1,
	voicing: 'open',
	octave: 0,
	duration: '2n'
};

function step(selector: string): DriveStep {
	const found = fakeDriver.state.config?.steps?.find((s) => s.element === selector);
	if (!found) throw new Error(`No tour step for ${selector}`);
	return found;
}

/** Click Next on the canvas step, which prepares the inspector before advancing */
async function advancePastCanvas(): Promise<void> {
	const onNextClick = step('[data-tour="canvas"]').popover?.onNextClick;
	onNextClick?.(undefined, step('[data-tour="canvas"]'), {
		driver: fakeDriver.state.instance,
		config: fakeDriver.state.config,
		state: {}
	} as never);
	await vi.waitFor(() => expect(fakeDriver.state.instance?.moveNext).toHaveBeenCalled());
}

describe('onboarding tour', () => {
	beforeEach(() => {
		localStorage.clear();
		clearProgression();
		clearBuilderState();
		resetUIState();
		progressionState.savedProgressions.items = [];
		fakeDriver.driver.mockClear();
		fakeDriver.state.config = null;
		fakeDriver.state.instance = null;
	});

	afterEach(() => {
		// Never leak a running tour into the next test
		fakeDriver.state.instance?.destroy();
	});

	describe('shouldAutoStartTour', () => {
		it('starts for a fresh visitor with no work', () => {
			expect(shouldAutoStartTour()).toBe(true);
		});

		it('stays quiet once the tour has been seen', () => {
			markTourSeen();
			expect(shouldAutoStartTour()).toBe(false);
		});

		it('stays quiet for visitors with saved progressions', () => {
			progressionState.savedProgressions.items = [{ id: 'p1' } as SavedProgression];
			expect(shouldAutoStartTour()).toBe(false);
		});

		it('stays quiet when the canvas already has chords', () => {
			addChord(CHORD);
			expect(shouldAutoStartTour()).toBe(false);
		});
	});

	describe('buildTourSteps', () => {
		it('opens with a welcome and points every other step at a data-tour hook', () => {
			const steps = buildTourSteps({ prepareInspector: async () => {}, seededDemo: () => false });

			expect(steps).toHaveLength(8);
			expect(steps[0].element).toBeUndefined();
			for (const s of steps.slice(1)) {
				expect(s.element).toMatch(/^\[data-tour="[a-z-]+"\]$/);
			}
		});

		it('prepares the inspector before leaving the canvas step', async () => {
			const prepareInspector = vi.fn().mockResolvedValue(undefined);
			const steps = buildTourSteps({ prepareInspector, seededDemo: () => false });
			const canvas = steps.find((s) => s.element === '[data-tour="canvas"]');
			const moveNext = vi.fn();

			canvas?.popover?.onNextClick?.(undefined, canvas, { driver: { moveNext } } as never);

			expect(prepareInspector).toHaveBeenCalledOnce();
			await vi.waitFor(() => expect(moveNext).toHaveBeenCalledOnce());
		});
	});

	describe('startTour', () => {
		it('seeds a demo chord on an empty canvas and removes it when the tour ends', async () => {
			selectRoot(65);
			selectQuality('m');

			await startTour();
			expect(uiState.tourActive).toBe(true);
			expect(fakeDriver.state.instance?.drive).toHaveBeenCalled();

			await advancePastCanvas();
			expect(progressionState.progression[0]).toMatchObject({ root: 60, quality: 'maj7' });
			expect(uiState.selectedSlot).toBe(0);

			fakeDriver.state.instance?.destroy();

			expect(progressionState.progression.every((chord) => chord === null)).toBe(true);
			expect(uiState.selectedSlot).toBeNull();
			expect(progressionState.builderState).toEqual({ selectedRoot: 65, selectedQuality: 'm' });
			expect(uiState.tourActive).toBe(false);
			expect(hasSeenTour()).toBe(true);
		});

		it('uses an existing chord instead of seeding, and leaves the progression untouched', async () => {
			placeChordAt(2, CHORD);
			const before = progressionState.progression.map((chord) => (chord ? { ...chord } : null));

			await startTour();
			await advancePastCanvas();
			expect(uiState.selectedSlot).toBe(2);

			fakeDriver.state.instance?.destroy();

			expect(progressionState.progression).toEqual(before);
			expect(uiState.selectedSlot).toBeNull();
		});

		it('marks the tour seen when it is dismissed early', async () => {
			await startTour();
			fakeDriver.state.instance?.destroy();

			expect(hasSeenTour()).toBe(true);
			expect(uiState.tourActive).toBe(false);
		});

		it('does not start a second tour while one is running', async () => {
			await startTour();
			await startTour();

			expect(fakeDriver.driver).toHaveBeenCalledOnce();
		});
	});
});
