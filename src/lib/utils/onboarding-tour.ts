/**
 * Onboarding Tour
 * A driver.js walkthrough of the workspace for first-time visitors, replayable from Help.
 * It only explains; the one thing it changes is a demo chord seeded so the inspector has
 * something to show, and everything it touched is put back when the tour ends.
 */

import { tick } from 'svelte';
import type { Driver, DriveStep } from 'driver.js';
import type { Chord } from '#lib/utils/theory-engine/index.ts';
import {
	createCandidateChord,
	loadProgressionToCanvas,
	placeChordAt,
	progressionState,
	savedLibrary
} from '#lib/stores/progression.svelte.ts';
import { deselectSlot, selectSlot, setTourActive, uiState } from '#lib/stores/ui.svelte.ts';
import { hasSeenTour, markTourSeen } from '#lib/utils/onboarding-persistence.ts';

/** Demo chord the tour places when the canvas is empty (C major 7) */
const DEMO_ROOT = 60;
const DEMO_QUALITY = 'maj7';

/** How long a step waits for an element that renders after the previous step (ms) */
const ELEMENT_WAIT_MS = 600;

/** Hooks the steps call into, so the step list itself stays free of store access */
export interface TourStepHooks {
	/** Make sure a slot holding a chord is selected, so the inspector renders */
	prepareInspector: () => Promise<void>;
	/** Whether the tour placed its demo chord (rather than using one already on the canvas) */
	seededDemo: () => boolean;
}

/**
 * Build the tour's steps. Selectors use the `data-tour` hooks on each surface.
 * @param hooks - Side effects some steps need before moving on
 */
export function buildTourSteps(hooks: TourStepHooks): DriveStep[] {
	return [
		{
			popover: {
				title: 'Welcome to Bare Minimum Theory',
				description:
					'Build chord progressions and export them as MIDI. This tour covers the basics in under a minute.',
				showButtons: ['next', 'close']
			}
		},
		{
			element: '[data-tour="root"]',
			popover: {
				title: 'Root',
				description: 'Choose the root note of the chord.',
				side: 'bottom',
				align: 'start'
			}
		},
		{
			element: '[data-tour="quality"]',
			popover: {
				title: 'Quality',
				description:
					'Click a quality to preview it. Press and sweep across the grid to browse, or hold and drag a chord onto the progression.',
				side: 'bottom',
				align: 'start'
			}
		},
		{
			element: '[data-tour="canvas"]',
			popover: {
				title: 'Progression',
				description: 'Drop chords into slots, drag to reorder, and add or remove slots as needed.',
				side: 'top',
				align: 'start',
				onNextClick: (_element, _step, { driver }) => {
					void hooks.prepareInspector().then(() => driver.moveNext());
				}
			}
		},
		{
			element: '[data-tour="inspector"]',
			waitForElement: ELEMENT_WAIT_MS,
			popover: {
				title: 'Inspector',
				description:
					'Selecting a chord opens the inspector, where you can set its inversion, voicing, duration and octave. Randomize generates a variation.',
				side: 'top',
				align: 'start',
				onPopoverRender: (popover) => {
					if (hooks.seededDemo()) {
						popover.description.append(
							' A Cmaj7 was added for this example and will be removed when the tour ends.'
						);
					}
				}
			}
		},
		{
			element: '[data-tour="scale"]',
			popover: {
				title: 'Key & Scale',
				description:
					'Optional. Set a key to highlight the chords in that scale. Other chords stay available.',
				side: 'bottom',
				align: 'start'
			}
		},
		{
			element: '[data-tour="transport"]',
			popover: {
				title: 'Play, save, export',
				description:
					'Play loops the progression; Space toggles playback. Save adds it to your library, and Export MIDI downloads a .mid file. If your browser supports Web MIDI, the cable button sends notes to your DAW.',
				side: 'bottom',
				align: 'end'
			}
		},
		{
			element: '[data-tour="library"]',
			popover: {
				title: 'Library',
				description:
					'The Palette holds individual chords; Saved holds full progressions. Keyboard shortcuts and this tour are under Help.',
				side: 'left',
				align: 'start'
			}
		}
	];
}

/**
 * Whether the tour should start on its own: only for visitors who have never seen it and
 * have no work yet, so returning users are never interrupted.
 */
export function shouldAutoStartTour(): boolean {
	if (hasSeenTour()) return false;
	if (savedLibrary.items.length > 0) return false;
	return progressionState.progression.every((chord) => chord === null);
}

/** State captured before the tour, so whatever it changed can be put back */
interface TourSnapshot {
	progression: (Chord | null)[];
	selectedSlot: number | null;
	selectedRoot: number | null;
	selectedQuality: typeof progressionState.builderState.selectedQuality;
}

let activeDriver: Driver | null = null;

function takeSnapshot(): TourSnapshot {
	return {
		progression: progressionState.progression.map((chord) => (chord ? { ...chord } : null)),
		selectedSlot: uiState.selectedSlot,
		selectedRoot: progressionState.builderState.selectedRoot,
		selectedQuality: progressionState.builderState.selectedQuality
	};
}

/**
 * Put back everything the tour may have changed.
 * @param snapshot - State from before the tour
 * @param seeded - Whether the tour placed the demo chord
 */
function restoreSnapshot(snapshot: TourSnapshot, seeded: boolean): void {
	if (seeded) loadProgressionToCanvas(snapshot.progression);

	if (snapshot.selectedSlot === null) {
		if (uiState.selectedSlot !== null) deselectSlot();
	} else {
		selectSlot(snapshot.selectedSlot);
	}

	progressionState.builderState.selectedRoot = snapshot.selectedRoot;
	progressionState.builderState.selectedQuality = snapshot.selectedQuality;
}

/**
 * Start the onboarding tour. Does nothing if it is already running.
 * Finishing or dismissing it marks the current tour revision as seen.
 */
export async function startTour(): Promise<void> {
	if (activeDriver || uiState.tourActive) return;
	setTourActive(true);

	const snapshot = takeSnapshot();
	let seeded = false;

	const prepareInspector = async () => {
		const selected = uiState.selectedSlot;
		if (selected !== null && progressionState.progression[selected]) return;

		let target = progressionState.progression.findIndex((chord) => chord !== null);
		if (target === -1) {
			target = 0;
			seeded = placeChordAt(target, createCandidateChord(DEMO_ROOT, DEMO_QUALITY, target));
			if (!seeded) return;
		}
		selectSlot(target);
		await tick();
	};

	try {
		const [{ driver }] = await Promise.all([
			import('driver.js'),
			import('driver.js/dist/driver.css')
		]);

		activeDriver = driver({
			steps: buildTourSteps({ prepareInspector, seededDemo: () => seeded }),
			showProgress: true,
			progressText: '{{current}} of {{total}}',
			nextBtnText: 'Next',
			prevBtnText: 'Back',
			doneBtnText: 'Start building',
			popoverClass: 'bmt-tour',
			overlayColor: 'oklch(0.08 0.02 195)',
			overlayOpacity: 0.65,
			stagePadding: 6,
			stageRadius: 10,
			smoothScroll: true,
			allowClose: true,
			// The tour explains; it shouldn't let a click change state it then has to undo
			disableActiveInteraction: true,
			onDestroyed: () => {
				activeDriver = null;
				restoreSnapshot(snapshot, seeded);
				setTourActive(false);
				markTourSeen();
			}
		});
		activeDriver.drive();
	} catch (error) {
		console.error('Failed to start the onboarding tour:', error);
		activeDriver = null;
		restoreSnapshot(snapshot, seeded);
		setTourActive(false);
	}
}
