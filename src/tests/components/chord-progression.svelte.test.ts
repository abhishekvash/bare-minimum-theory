/**
 * Behaviour tests for the canvas: what a drop on a between-slot insertion point does, and what
 * clicking a block versus empty canvas space does to the selection.
 *
 * The component is mounted directly (no testing-library in this project) and driven with synthetic
 * drag events, since jsdom has no drag-and-drop of its own. Tone is mocked so mounting never
 * reaches for a real audio context; the MIDI layer is left real, since it reports itself
 * unsupported when the Web MIDI API is absent.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import ChordProgressionHarness from './ChordProgressionHarness.svelte';
import type { Chord } from '$lib/utils/theory-engine';
import {
	progressionState,
	addChord,
	clearBuilderState,
	clearProgression,
	removeSlot,
	selectQuality,
	selectRoot,
	MAX_PROGRESSION_SLOTS
} from '$lib/stores/progression.svelte';
import {
	markSlotQueuedIfCurrent,
	resetUIState,
	revertAudition,
	selectSlot,
	setTransportActive,
	stageCandidate,
	uiState
} from '$lib/stores/ui.svelte';
import {
	setClockReceivingState,
	setClockSyncEnabled,
	setExternalPlayingState
} from '$lib/stores/midi.svelte';

const { toneMock } = vi.hoisted(() => {
	const mockTransport = {
		state: 'stopped',
		seconds: 0,
		position: 0,
		loop: false,
		loopStart: 0,
		loopEnd: 0,
		bpm: { value: 120, rampTo: vi.fn() },
		scheduleRepeat: vi.fn(() => 1),
		scheduleOnce: vi.fn(() => 1),
		clear: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
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
			Time: vi.fn(() => ({ toSeconds: () => 2 })),
			Transport: mockTransport
		}
	};
});

vi.mock('tone', () => ({ default: toneMock, ...toneMock }));

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

function createTestChord(root: number, quality: Chord['quality'] = 'maj7'): Chord {
	return { root, quality, inversion: 0, voicing: 'close', octave: 0, duration: '1m' };
}

/**
 * Mount the canvas into the document
 */
function renderCanvas(): void {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(ChordProgressionHarness, { target });
	flushSync();
}

/** Fake dataTransfer carrying whichever payloads the drag is meant to have */
function dataTransfer(payloads: Record<string, string>) {
	return {
		types: Object.keys(payloads),
		effectAllowed: 'copyMove',
		dropEffect: 'none',
		getData: (format: string) => payloads[format] ?? ''
	};
}

/** Capture the payload emitted by the real ChordBlock dragstart production seam. */
function captureBlockPayloads(fromIndex: number): Record<string, string> {
	const payloads: Record<string, string> = {};
	const transfer = {
		effectAllowed: 'none',
		setData: (format: string, value: string) => (payloads[format] = value)
	};
	const event = new Event('dragstart', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'dataTransfer', { value: transfer });
	const block = target.querySelector<HTMLElement>(`[data-chord-index="${fromIndex}"]`);
	if (!block) throw new Error(`chord block ${fromIndex} not rendered`);
	block.dispatchEvent(event);
	flushSync();
	return payloads;
}

/**
 * Dispatch a drag event jsdom cannot construct on its own
 * @param element - Element to dispatch on
 * @param type - Drag event name
 * @param payloads - Formats the drag carries
 */
function fireDrag(element: Element, type: string, payloads: Record<string, string>): void {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'dataTransfer', { value: dataTransfer(payloads) });
	element.dispatchEvent(event);
	flushSync();
}

/**
 * The insertion point sitting before a given display slot
 * @param index - Display slot index the point precedes
 */
function insertPoint(index: number): HTMLElement {
	const point = target.querySelector<HTMLElement>(`[data-insert-index="${index}"]`);
	if (!point) throw new Error(`insertion point ${index} not rendered`);
	return point;
}

/** The rendered chord blocks, in canvas order */
function blocks(): HTMLElement[] {
	return Array.from(target.querySelectorAll<HTMLElement>('[data-slot="chord-block"]'));
}

/** A normal slot drop target. */
function slotWrapper(index: number): HTMLElement {
	const slot = target.querySelector<HTMLElement>(`[data-slot-index="${index}"]`);
	if (!slot) throw new Error(`slot ${index} not rendered`);
	return slot;
}

/** The canvas card itself — the empty space a click should deselect from */
function canvasCard(): HTMLElement {
	const block = blocks()[0] ?? target.querySelector<HTMLElement>('[data-slot="empty-slot"]');
	const card = block?.closest<HTMLElement>('.overflow-x-auto');
	if (!card) throw new Error('canvas card not rendered');
	return card;
}

/** Roots of the current progression, with nulls for rests */
function roots(): (number | null)[] {
	return progressionState.progression.map((chord) => chord?.root ?? null);
}

describe('ChordProgression canvas', () => {
	beforeEach(() => {
		clearProgression();
		clearBuilderState();
		resetUIState();
		setClockSyncEnabled(false);
		setClockReceivingState(false);
		setExternalPlayingState(false);
		toneMock.Transport.state = 'stopped';
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
	});

	describe('dropping a canvas block on an insertion point', () => {
		it('should move the chord into a new slot and leave a rest behind', () => {
			addChord(createTestChord(60));
			addChord(createTestChord(62, 'm'));
			renderCanvas();

			fireDrag(insertPoint(3), 'drop', captureBlockPayloads(0));

			expect(roots()).toEqual([null, 62, null, 60, null]);
		});

		it('should move a chord backwards past earlier slots', () => {
			addChord(createTestChord(60));
			addChord(createTestChord(62, 'm'));
			addChord(createTestChord(64, '7'));
			renderCanvas();

			fireDrag(insertPoint(1), 'drop', captureBlockPayloads(2));

			expect(roots()).toEqual([60, 64, 62, null, null]);
		});

		it('should treat the block payload as a move even though the drag also carries the chord', () => {
			addChord(createTestChord(60));
			addChord(createTestChord(62, 'm'));
			renderCanvas();

			fireDrag(insertPoint(2), 'drop', captureBlockPayloads(0));

			// A copy would have left the source chord in place
			expect(roots()).toEqual([null, 62, 60, null, null]);
		});

		it('should do nothing when dropped on the insertion point before its own block', () => {
			addChord(createTestChord(60));
			addChord(createTestChord(62, 'm'));
			renderCanvas();
			const before = roots();

			fireDrag(insertPoint(1), 'drop', captureBlockPayloads(1));

			expect(roots()).toEqual(before);
		});

		it('should do nothing when dropped on the insertion point after its own block', () => {
			addChord(createTestChord(60));
			addChord(createTestChord(62, 'm'));
			renderCanvas();
			const before = roots();

			fireDrag(insertPoint(1), 'drop', captureBlockPayloads(0));

			expect(roots()).toEqual(before);
		});

		it('should keep the chord when dropped on a padded insertion point', () => {
			addChord(createTestChord(60));
			addChord(createTestChord(62, 'm'));
			// Compact below the four displayed slots, so slot 2 and 3 are padding only
			removeSlot(3);
			removeSlot(2);
			expect(progressionState.progression.length).toBe(2);
			renderCanvas();

			fireDrag(insertPoint(3), 'drop', captureBlockPayloads(0));

			expect(roots()).toEqual([null, 62, null, 60]);
		});

		it('should do nothing at the slot cap', () => {
			for (let i = 0; i < MAX_PROGRESSION_SLOTS; i++) {
				addChord(createTestChord(60 + i));
			}
			expect(progressionState.progression.length).toBe(MAX_PROGRESSION_SLOTS);
			renderCanvas();
			const before = roots();

			fireDrag(insertPoint(4), 'drop', captureBlockPayloads(0));

			expect(roots()).toEqual(before);
		});

		it('should relocate the selection and the audition record onto the moved chord', () => {
			addChord(createTestChord(60));
			addChord(createTestChord(62, 'm'));
			selectSlot(0);
			stageCandidate(0, createTestChord(67, 'm9'));
			renderCanvas();

			fireDrag(insertPoint(2), 'drop', captureBlockPayloads(0));

			expect(uiState.selectedSlot).toBe(2);
			expect(uiState.audition?.slotIndex).toBe(2);

			// Revert has to land on the chord's new home, not on the rest it left behind
			revertAudition();
			expect(roots()).toEqual([null, 62, 60, null, null]);
		});

		it('should ignore a malformed block payload without losing the chord', () => {
			addChord(createTestChord(60));
			renderCanvas();

			fireDrag(insertPoint(2), 'drop', { 'progression-chord': '{not json' });

			expect(roots()).toEqual([60, null, null, null]);
		});
	});

	describe('dropping a real block payload on normal slots', () => {
		it('should emit both payloads and swap with an occupied slot', () => {
			addChord(createTestChord(60));
			addChord(createTestChord(62, 'm'));
			renderCanvas();

			const payloads = captureBlockPayloads(0);
			expect(JSON.parse(payloads['progression-chord'])).toEqual({ fromIndex: 0 });
			expect(JSON.parse(payloads['application/json'])).toEqual(createTestChord(60));
			fireDrag(slotWrapper(1), 'drop', payloads);

			expect(roots()).toEqual([62, 60, null, null]);
		});

		it('should move into an empty normal slot and leave a rest', () => {
			addChord(createTestChord(60));
			renderCanvas();

			fireDrag(slotWrapper(2), 'drop', captureBlockPayloads(0));

			expect(roots()).toEqual([null, null, 60, null]);
		});
	});

	describe('dropping a builder chord on an insertion point', () => {
		it('should insert a new slot holding the chord', () => {
			addChord(createTestChord(60));
			addChord(createTestChord(62, 'm'));
			renderCanvas();

			fireDrag(insertPoint(1), 'drop', {
				'application/json': JSON.stringify(createTestChord(67, '7'))
			});

			expect(roots()).toEqual([60, 67, 62, null, null]);
		});

		it('should materialize the padded slots a display-only insertion point implies', () => {
			addChord(createTestChord(60));
			removeSlot(3);
			removeSlot(2);
			removeSlot(1);
			expect(progressionState.progression.length).toBe(1);
			renderCanvas();

			fireDrag(insertPoint(2), 'drop', {
				'application/json': JSON.stringify(createTestChord(67, '7'))
			});

			expect(roots()).toEqual([60, null, 67]);
		});

		it('should ignore a drag carrying nothing it understands', () => {
			addChord(createTestChord(60));
			renderCanvas();

			fireDrag(insertPoint(2), 'drop', { 'text/plain': 'hello' });

			expect(roots()).toEqual([60, null, null, null]);
		});
	});

	describe('local and DAW transport mirroring', () => {
		it('should keep local Play running while clock sync is enabled but waiting for clock', async () => {
			addChord(createTestChord(60));
			setClockSyncEnabled(true);
			setClockReceivingState(false);
			renderCanvas();

			target.querySelector<HTMLButtonElement>('[data-action="play"]')?.click();

			await vi.waitFor(() => expect(uiState.transportActive).toBe(true));
			expect(target.querySelector('[data-action="stop"]')).not.toBeNull();
		});

		it('should mirror DAW start and stop only while clock is being received', async () => {
			addChord(createTestChord(60));
			setClockSyncEnabled(true);
			setClockReceivingState(true);
			renderCanvas();

			setExternalPlayingState(true);
			await vi.waitFor(() => expect(uiState.transportActive).toBe(true));
			expect(target.querySelector('[data-action="stop"]')).not.toBeNull();

			setExternalPlayingState(false);
			await vi.waitFor(() => expect(uiState.transportActive).toBe(false));
			expect(target.querySelector('[data-action="play"]')).not.toBeNull();
		});

		it('should stop local waiting playback when an arriving DAW clock declares transport stopped', async () => {
			addChord(createTestChord(60));
			setClockSyncEnabled(true);
			renderCanvas();
			target.querySelector<HTMLButtonElement>('[data-action="play"]')?.click();
			await vi.waitFor(() => expect(uiState.transportActive).toBe(true));

			setClockReceivingState(true);
			setExternalPlayingState(false);
			await vi.waitFor(() => expect(uiState.transportActive).toBe(false));
		});
	});

	describe('first-visit and click-to-place flow', () => {
		function ready(root = 60, quality: Chord['quality'] = 'maj7'): void {
			selectRoot(root);
			selectQuality(quality);
		}

		it('should teach the builder path only on the first empty canvas', () => {
			renderCanvas();

			expect(target.textContent).toContain('Build a chord below, then add it here');
		});

		it('should remove the first-visit hint once any chord exists', () => {
			addChord(createTestChord(60));
			renderCanvas();

			expect(target.textContent).not.toContain('Build a chord below, then add it here');
		});

		it('should name the ready chord on every empty click target', () => {
			ready(62, 'm7');
			renderCanvas();

			expect(target.textContent).toContain('Click to place Dm7 here');
			expect(target.querySelectorAll('[aria-label^="Place Dm7 in slot"]')).toHaveLength(4);
		});

		it('should place the ready chord in the empty slot that was clicked', () => {
			ready(62, 'm7');
			renderCanvas();

			const slot = target.querySelector<HTMLElement>('[aria-label="Place Dm7 in slot 3"]');
			const wrapper = slot?.closest('[data-slot-wrapper]');
			slot?.click();
			flushSync();

			expect(progressionState.progression[2]).toEqual(createTestChord(62, 'm7'));
			expect(wrapper?.getAttribute('data-landing')).toBe('true');
		});

		it('should not place the ready chord when the empty-slot remove affordance is clicked', () => {
			ready(67, '7');
			renderCanvas();
			const slot = target.querySelector<HTMLElement>('[aria-label="Place G7 in slot 2"]');

			slot
				?.closest('[data-slot-wrapper]')
				?.querySelector<HTMLButtonElement>('[aria-label^="Remove slot"]')
				?.click();
			flushSync();

			expect(progressionState.progression).toHaveLength(3);
			expect(
				progressionState.progression.every((progressionChord) => progressionChord === null)
			).toBe(true);
		});

		it('should materialize real slots through a padded placeholder before placing', () => {
			removeSlot(3);
			removeSlot(2);
			removeSlot(1);
			expect(progressionState.progression).toHaveLength(1);
			ready(67, '7');
			renderCanvas();

			const padded = target.querySelector<HTMLElement>('[aria-label="Place G7 in slot 4"]');
			padded?.click();
			flushSync();

			expect(progressionState.progression).toHaveLength(4);
			expect(roots()).toEqual([null, null, null, 67]);
		});
	});

	describe('slot accessibility and nested controls', () => {
		it('should keep inert slots out of the tab order and expose placement as a real button', () => {
			renderCanvas();
			for (const wrapper of target.querySelectorAll('[data-slot-wrapper]')) {
				expect(wrapper.getAttribute('role')).toBe('group');
				expect(wrapper.getAttribute('tabindex')).toBeNull();
			}
			expect(target.querySelector('[data-empty-placement]')).toBeNull();

			selectRoot(60);
			selectQuality('maj7');
			flushSync();
			expect(target.querySelectorAll('button[data-empty-placement]')).toHaveLength(4);
		});

		it('should expose block selection and child controls as sibling buttons', () => {
			addChord(createTestChord(60));
			renderCanvas();

			const selection = target.querySelector<HTMLButtonElement>('[data-slot-selection]');
			const block = target.querySelector<HTMLElement>('[data-slot="chord-block"]');
			expect(selection).not.toBeNull();
			expect(selection?.querySelector('button')).toBeNull();
			expect(block?.querySelector('[aria-label^="Play Cmaj7"]')).not.toBeNull();

			target.querySelector<HTMLButtonElement>('[aria-label^="Play Cmaj7"]')?.click();
			flushSync();
			expect(uiState.selectedSlot).toBeNull();

			selection?.click();
			flushSync();
			expect(uiState.selectedSlot).toBe(0);
		});
	});

	describe('audition badge and queued hint', () => {
		it('should show the baseline and candidate, then revert from the badge', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			stageCandidate(0, createTestChord(60, 'm9'));
			renderCanvas();

			const badge = target.querySelector<HTMLButtonElement>('[data-audition-badge]');
			expect(badge?.textContent).toContain('trying Cm9');
			expect(badge?.textContent).toContain('revert to Cmaj7');

			badge?.click();
			flushSync();

			expect(uiState.audition).toBeNull();
			expect(progressionState.progression[0]?.quality).toBe('maj7');
			expect(target.querySelector('[data-audition-badge]')).toBeNull();
		});

		it('should keep the audition badge after transport stops', () => {
			addChord(createTestChord(60, 'maj7'));
			selectSlot(0);
			setTransportActive(true);
			stageCandidate(0, createTestChord(60, 'm9'));
			setTransportActive(false);
			renderCanvas();

			expect(target.querySelector('[data-audition-badge]')).not.toBeNull();
		});

		it('should render a subtle queued marker on the affected block', () => {
			addChord(createTestChord(60, 'maj7'));
			setTransportActive(true);
			markSlotQueuedIfCurrent(0, 0);
			renderCanvas();

			expect(target.querySelector('[data-queued-hint]')?.textContent).toContain('Queued');
		});
	});

	describe('selection', () => {
		it('should select the slot whose block is clicked', () => {
			addChord(createTestChord(60));
			addChord(createTestChord(62, 'm'));
			renderCanvas();

			target
				.querySelector<HTMLButtonElement>('[data-chord-index="1"] [data-slot-selection]')
				?.click();
			flushSync();

			expect(uiState.selectedSlot).toBe(1);
		});

		it('should deselect when empty canvas space is clicked', () => {
			addChord(createTestChord(60));
			renderCanvas();
			target
				.querySelector<HTMLButtonElement>('[data-chord-index="0"] [data-slot-selection]')
				?.click();
			flushSync();
			expect(uiState.selectedSlot).toBe(0);

			canvasCard().click();
			flushSync();

			expect(uiState.selectedSlot).toBeNull();
		});
	});
});
