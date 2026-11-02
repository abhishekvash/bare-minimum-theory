/**
 * Behaviour tests for the quality field's gesture surface: which pointer owns a sweep, what the
 * sweep asks the audition controller to play, and how a press resolves into a click, a sweep or a
 * native drag.
 *
 * The component is mounted directly (no testing-library in this project) and driven with synthetic
 * pointer and drag events. jsdom has neither pointer capture nor layout, so the field's rect,
 * `elementFromPoint` and the capture API are stubbed into a single row of fixed-width buttons —
 * `quality-sweep.test.ts` covers the arithmetic, these tests cover the wiring around it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import QualityField from '$lib/components/QualityField.svelte';
import { auditionChord, cancelAudition } from '$lib/utils/audition-controller';
import {
	addChord,
	clearBuilderState,
	clearProgression,
	progressionState,
	selectRoot
} from '$lib/stores/progression.svelte';
import { resetUIState, selectSlot, setTransportActive, uiState } from '$lib/stores/ui.svelte';
import { QUALITY_GRADIENT } from '$lib/utils/theory-engine/constants';

vi.mock('$lib/utils/audition-controller', () => ({
	auditionChord: vi.fn(() => 'played'),
	auditionNotes: vi.fn(() => 'played'),
	cancelAudition: vi.fn(),
	isTransportActive: vi.fn(() => false),
	resolveTargetSlot: vi.fn(() => 0)
}));

/** Every button is this wide in the stubbed layout, laid out in one row from x = 0 */
const BUTTON_WIDTH = 100;

/** Height of the stubbed field; the row's vertical centre is what the helpers press at */
const FIELD_HEIGHT = 40;
const MID_Y = FIELD_HEIGHT / 2;

/** The pointer that owns a gesture unless a test says otherwise */
const POINTER = 1;

let target: HTMLElement;
let component: Record<string, unknown> | null = null;
let fieldWidth = 0;
let capturedPointer: number | null = null;
const originalElementFromPoint = document.elementFromPoint;

/** The field element itself — the sweep's bounds and the handler host */
function field(): HTMLElement {
	const el = target.querySelector<HTMLElement>('[aria-label="Chord qualities, simple to dense"]');
	if (!el) throw new Error('quality field not rendered');
	return el;
}

/** Every quality button, in gradient order */
function buttons(): HTMLButtonElement[] {
	return Array.from(target.querySelectorAll<HTMLButtonElement>('[data-quality]'));
}

/**
 * The button rendering a quality
 * @param quality - Quality key to look up
 */
function buttonFor(quality: string): HTMLButtonElement {
	const index = QUALITY_GRADIENT.indexOf(quality as never);
	const button = buttons()[index];
	if (!button) throw new Error(`no button for quality "${quality}"`);
	return button;
}

/**
 * Viewport x of a quality button's centre in the stubbed layout
 * @param quality - Quality key to locate
 */
function centreOf(quality: string): number {
	return QUALITY_GRADIENT.indexOf(quality as never) * BUTTON_WIDTH + BUTTON_WIDTH / 2;
}

/**
 * Build a DOMRect for the stubbed field
 * @param width - Field width in pixels
 */
function fieldRect(width: number): DOMRect {
	return {
		x: 0,
		y: 0,
		left: 0,
		top: 0,
		right: width,
		bottom: FIELD_HEIGHT,
		width,
		height: FIELD_HEIGHT,
		toJSON: () => ({})
	} as DOMRect;
}

/**
 * Mount the field and give jsdom the layout and pointer-capture APIs it lacks
 */
function renderField(): void {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(QualityField, { target, props: { scaleNotes: [] } });
	flushSync();

	const all = buttons();
	fieldWidth = all.length * BUTTON_WIDTH;

	const el = field();
	el.getBoundingClientRect = () => fieldRect(fieldWidth);
	el.setPointerCapture = (id: number) => {
		capturedPointer = id;
	};
	el.releasePointerCapture = (id: number) => {
		if (capturedPointer === id) capturedPointer = null;
	};
	el.hasPointerCapture = (id: number) => capturedPointer === id;

	document.elementFromPoint = (x: number, y: number) => {
		if (x < 0 || x >= fieldWidth || y < 0 || y > FIELD_HEIGHT) return null;
		return all[Math.floor(x / BUTTON_WIDTH)] ?? null;
	};
}

interface PointerInit {
	x: number;
	y: number;
	id?: number;
	primary?: boolean;
	button?: number;
	time?: number;
}

/**
 * Dispatch a pointer event jsdom cannot construct with the fields the field reads
 * @param el - Element to dispatch on
 * @param type - Pointer event name
 * @param init - Coordinates, pointer identity and the timestamp the hold is measured from
 */
function firePointer(el: Element, type: string, init: PointerInit): Event {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'clientX', { value: init.x });
	Object.defineProperty(event, 'clientY', { value: init.y });
	Object.defineProperty(event, 'pointerId', { value: init.id ?? POINTER });
	Object.defineProperty(event, 'isPrimary', { value: init.primary ?? true });
	Object.defineProperty(event, 'button', { value: init.button ?? 0 });
	Object.defineProperty(event, 'timeStamp', { value: init.time ?? 0 });
	el.dispatchEvent(event);
	flushSync();
	return event;
}

/**
 * Dispatch the `dragstart` the browser fires a few pixels into a press
 * @param quality - Quality whose button the drag would carry
 * @param init - Where the pointer was, and how long the press had been held
 */
function fireDragStart(quality: string, init: { x: number; y: number; time?: number }): Event {
	const event = new Event('dragstart', { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'clientX', { value: init.x });
	Object.defineProperty(event, 'clientY', { value: init.y });
	Object.defineProperty(event, 'timeStamp', { value: init.time ?? 0 });
	Object.defineProperty(event, 'dataTransfer', { value: null });
	buttonFor(quality).dispatchEvent(event);
	flushSync();
	return event;
}

/** Press a quality button at its centre at t = 0 */
function press(quality: string, init: Partial<PointerInit> = {}): void {
	firePointer(buttonFor(quality), 'pointerdown', { x: centreOf(quality), y: MID_Y, ...init });
}

/** Move the pointer to a quality's centre, quickly enough to read as a sweep */
function moveTo(quality: string, init: Partial<PointerInit> = {}): void {
	firePointer(field(), 'pointermove', { x: centreOf(quality), y: MID_Y, time: 40, ...init });
}

/** Release the pointer wherever it is */
function release(init: Partial<PointerInit> = {}): void {
	firePointer(field(), 'pointerup', { x: 0, y: MID_Y, time: 60, ...init });
}

/** Quality + mode of every audition the field asked for, in order */
function auditions(): Array<[string, string]> {
	return vi
		.mocked(auditionChord)
		.mock.calls.map(([chord, options]) => [chord.quality, options.mode]);
}

/** Whether the button for a quality is showing the sweep highlight */
function isHighlighted(quality: string): boolean {
	return buttonFor(quality).className.includes('ring-primary');
}

describe('QualityField', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearProgression();
		clearBuilderState();
		resetUIState();
		progressionState.scaleFilterEnabled = false;
		selectRoot(60);
		capturedPointer = null;
		renderField();
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
		document.elementFromPoint = originalElementFromPoint;
	});

	it('should render every quality on the gradient', () => {
		expect(buttons().map((b) => b.getAttribute('data-quality'))).toEqual([...QUALITY_GRADIENT]);
	});

	describe('sweeping across the field', () => {
		it('should audition each newly crossed quality and take pointer capture', () => {
			press('m');
			moveTo('5');
			moveTo('dim');

			expect(capturedPointer).toBe(POINTER);
			expect(auditions()).toEqual([
				['5', 'sweep'],
				['dim', 'sweep']
			]);
		});

		it('should build the candidate on the builder’s current root', () => {
			press('m');
			moveTo('5');

			expect(vi.mocked(auditionChord).mock.calls[0][0]).toEqual({
				root: 60,
				quality: '5',
				inversion: 0,
				voicing: 'close',
				octave: 0,
				duration: '1m'
			});
		});

		it('should not audition the quality that was pressed', () => {
			press('m');
			firePointer(field(), 'pointermove', { x: centreOf('m') + 9, y: MID_Y, time: 40 });

			expect(auditions()).toEqual([]);
		});

		it('should highlight the quality under the sweep and clear it on release', () => {
			press('m');
			moveTo('5');

			expect(isHighlighted('5')).toBe(true);

			release();

			expect(isHighlighted('5')).toBe(false);
		});

		it('should select the last crossed quality on release', () => {
			press('m');
			moveTo('5');
			moveTo('dim');
			release();

			expect(progressionState.builderState.selectedQuality).toBe('dim');
			expect(capturedPointer).toBeNull();
		});

		it('should still highlight while auditions come back suppressed', () => {
			vi.mocked(auditionChord).mockReturnValue('suppressed');

			press('m');
			moveTo('5');

			expect(isHighlighted('5')).toBe(true);
			expect(progressionState.builderState.selectedQuality).toBeNull();

			release();

			expect(progressionState.builderState.selectedQuality).toBe('5');
		});
	});

	describe('ending a sweep without a selection', () => {
		it('should cancel when the pointer leaves the field', () => {
			press('m');
			moveTo('5');
			firePointer(field(), 'pointermove', { x: fieldWidth + 30, y: MID_Y, time: 60 });

			expect(cancelAudition).toHaveBeenCalledTimes(1);
			expect(isHighlighted('5')).toBe(false);

			release();

			expect(progressionState.builderState.selectedQuality).toBeNull();
		});

		it('should cancel on pointercancel', () => {
			press('m');
			moveTo('5');
			firePointer(field(), 'pointercancel', { x: centreOf('5'), y: MID_Y, time: 60 });

			expect(cancelAudition).toHaveBeenCalledTimes(1);
			expect(capturedPointer).toBeNull();
			expect(progressionState.builderState.selectedQuality).toBeNull();
		});

		it('should cancel and release capture when the window blurs', () => {
			press('m');
			moveTo('5');

			window.dispatchEvent(new Event('blur'));
			flushSync();

			expect(cancelAudition).toHaveBeenCalledTimes(1);
			expect(capturedPointer).toBeNull();
			expect(isHighlighted('5')).toBe(false);

			release();

			expect(progressionState.builderState.selectedQuality).toBeNull();
		});
	});

	describe('single-pointer ownership', () => {
		it('should ignore a second finger landing mid-sweep', () => {
			press('m');
			moveTo('5');

			// The second finger presses one button and sweeps to another: without the guard it would
			// re-press the session at 'aug' and audition 'sus2' on the way
			press('aug', { id: 2, primary: false });
			moveTo('sus2', { id: 2, time: 60 });

			expect(auditions()).toEqual([['5', 'sweep']]);
			expect(cancelAudition).not.toHaveBeenCalled();
		});

		it('should let the original pointer finish its own sweep', () => {
			press('m');
			moveTo('5');
			press('aug', { id: 2, primary: false });
			moveTo('sus2', { id: 2, time: 60 });

			release();

			expect(progressionState.builderState.selectedQuality).toBe('5');
		});

		it('should ignore a second primary pointer while one is tracked', () => {
			press('m');
			moveTo('5');

			press('aug', { id: 7 });
			moveTo('sus2', { id: 7, time: 60 });
			release({ id: 7 });

			expect(auditions()).toEqual([['5', 'sweep']]);
			expect(progressionState.builderState.selectedQuality).toBeNull();
		});

		it('should ignore a non-primary press even with no gesture in flight', () => {
			press('m', { primary: false });
			moveTo('5');

			expect(auditions()).toEqual([]);
			expect(capturedPointer).toBeNull();
		});

		it('should ignore a release from a pointer it is not tracking', () => {
			press('m');
			moveTo('5');

			release({ id: 2 });

			expect(progressionState.builderState.selectedQuality).toBeNull();
			expect(capturedPointer).toBe(POINTER);
		});

		it('should accept a new gesture once the first one ended', () => {
			press('m');
			moveTo('5');
			release();

			press('sus2', { id: 3 });
			moveTo('sus4', { id: 3 });
			release({ id: 3 });

			expect(progressionState.builderState.selectedQuality).toBe('sus4');
		});

		it('should ignore a non-primary button press', () => {
			press('m', { button: 2 });
			moveTo('5');

			expect(auditions()).toEqual([]);
		});
	});

	describe('sweep versus native drag', () => {
		it('should suppress the drag for a quick horizontal move', () => {
			press('m');
			const dragstart = fireDragStart('m', { x: centreOf('m') + 40, y: MID_Y + 2, time: 40 });

			expect(dragstart.defaultPrevented).toBe(true);

			moveTo('5');

			expect(auditions()).toEqual([['5', 'sweep']]);
		});

		it('should let a downward drag through and stop tracking the pointer', () => {
			press('m');
			const dragstart = fireDragStart('m', { x: centreOf('m') + 2, y: MID_Y + 30, time: 40 });

			expect(dragstart.defaultPrevented).toBe(false);

			moveTo('5', { time: 60 });
			release();

			expect(auditions()).toEqual([]);
			expect(progressionState.builderState.selectedQuality).toBeNull();
		});

		it('should let a drag through once the press has been held', () => {
			press('m');
			const dragstart = fireDragStart('m', { x: centreOf('m') + 40, y: MID_Y, time: 200 });

			expect(dragstart.defaultPrevented).toBe(false);

			moveTo('5', { time: 220 });

			expect(auditions()).toEqual([]);
		});

		it('should suppress a drag that starts after the sweep already owns the press', () => {
			press('m');
			moveTo('5');
			const dragstart = fireDragStart('5', { x: centreOf('5'), y: MID_Y + 60, time: 300 });

			expect(dragstart.defaultPrevented).toBe(true);
		});
	});

	describe('click browsing', () => {
		it('should select and audition with context on a plain click', () => {
			buttonFor('maj7').click();
			flushSync();

			expect(progressionState.builderState.selectedQuality).toBe('maj7');
			expect(auditions()).toEqual([['maj7', 'click']]);
			expect(vi.mocked(auditionChord).mock.calls[0][1]).toEqual({
				mode: 'click',
				targetSlot: 0
			});
		});

		it('should swallow exactly one click after a sweep committed', () => {
			press('m');
			moveTo('5');
			release();
			vi.mocked(auditionChord).mockClear();

			buttonFor('dim').click();
			flushSync();

			expect(progressionState.builderState.selectedQuality).toBe('5');
			expect(auditions()).toEqual([]);

			buttonFor('dim').click();
			flushSync();

			expect(progressionState.builderState.selectedQuality).toBe('dim');
			expect(auditions()).toEqual([['dim', 'click']]);
		});

		it('should not swallow a click after a press that never swept', () => {
			press('maj7');
			release();

			buttonFor('maj7').click();
			flushSync();

			expect(progressionState.builderState.selectedQuality).toBe('maj7');
			expect(auditions()).toEqual([['maj7', 'click']]);
		});
	});

	describe('live audition staging', () => {
		function selectPlayingChord(): void {
			addChord({
				root: 60,
				quality: 'maj7',
				inversion: 1,
				voicing: 'drop2',
				octave: -1,
				duration: '2n.'
			});
			selectSlot(0);
			setTransportActive(true);
			flushSync();
		}

		it('should stage a quality click into the selected slot without an out-of-loop preview', () => {
			selectPlayingChord();

			buttonFor('m9').click();
			flushSync();

			expect(auditionChord).not.toHaveBeenCalled();
			expect(uiState.audition).toEqual({
				slotIndex: 0,
				baselineRoot: 60,
				baselineQuality: 'maj7',
				clampedInversion: null
			});
			expect(progressionState.progression[0]).toMatchObject({
				root: 60,
				quality: 'm9',
				inversion: 1,
				voicing: 'drop2',
				octave: -1,
				duration: '2n.'
			});
		});

		it('should wait for sweep release before staging the last crossed quality', () => {
			selectPlayingChord();

			press('maj7');
			moveTo('m9');

			expect(uiState.audition).toBeNull();
			expect(auditionChord).not.toHaveBeenCalled();
			expect(progressionState.progression[0]?.quality).toBe('maj7');

			release();

			expect(uiState.audition?.baselineQuality).toBe('maj7');
			expect(progressionState.progression[0]?.quality).toBe('m9');
		});

		it('should browse silently without staging when playback has no selected slot', () => {
			setTransportActive(true);

			buttonFor('m9').click();
			flushSync();

			expect(progressionState.builderState.selectedQuality).toBe('m9');
			expect(uiState.audition).toBeNull();
			expect(progressionState.progression.every((chord) => chord === null)).toBe(true);
		});
	});
});
