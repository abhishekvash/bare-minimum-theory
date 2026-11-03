import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	createSweepSession,
	DRAG_HOLD_MS,
	SWEEP_MOVE_THRESHOLD_PX,
	type SweepHandlers,
	type SweepSession
} from '$lib/utils/quality-sweep';

/**
 * The field is modelled as one row of 100px-wide buttons with a 10px gap before each one, so the
 * tests can cross buttons, land in a gap, and leave the field by coordinate alone.
 */
const BUTTONS = ['', 'm', '7', 'maj7'];
const SLOT_WIDTH = 110;
const GAP = 10;
const FIELD_WIDTH = BUTTONS.length * SLOT_WIDTH;
const FIELD_HEIGHT = 40;

/**
 * Resolve the fake field's contents at a point
 */
function hitTestField(x: number, y: number) {
	if (x < 0 || x > FIELD_WIDTH || y < 0 || y > FIELD_HEIGHT) {
		return { inField: false, quality: null };
	}

	const slot = Math.floor(x / SLOT_WIDTH);
	// The leading strip of each slot is the gap between buttons
	const withinSlot = x - slot * SLOT_WIDTH;
	return { inField: true, quality: withinSlot < GAP ? null : (BUTTONS[slot] ?? null) };
}

/** Centre of a button, in field coordinates */
function centreOf(quality: string): number {
	return BUTTONS.indexOf(quality) * SLOT_WIDTH + SLOT_WIDTH / 2;
}

let handlers: {
	hitTest: ReturnType<typeof vi.fn>;
	onSweepStart: ReturnType<typeof vi.fn>;
	onCross: ReturnType<typeof vi.fn>;
	onCommit: ReturnType<typeof vi.fn>;
	onCancel: ReturnType<typeof vi.fn>;
};
let sweep: SweepSession;

beforeEach(() => {
	handlers = {
		hitTest: vi.fn(hitTestField),
		onSweepStart: vi.fn(),
		onCross: vi.fn(),
		onCommit: vi.fn(),
		onCancel: vi.fn()
	};
	sweep = createSweepSession(handlers as unknown as SweepHandlers);
});

/** Press the centre of a button at t=0 */
function press(quality: string): void {
	sweep.press(centreOf(quality), FIELD_HEIGHT / 2, quality, 0);
}

/** Move horizontally to a button's centre */
function sweepTo(quality: string, time = 40): void {
	sweep.move(centreOf(quality), FIELD_HEIGHT / 2, time);
}

describe('createSweepSession', () => {
	describe('click vs sweep', () => {
		it('starts idle', () => {
			expect(sweep.phase).toBe('idle');
			expect(sweep.quality).toBeNull();
		});

		it('ignores a press that missed every button', () => {
			sweep.press(5, 5, null, 0);

			expect(sweep.phase).toBe('idle');
			sweep.move(200, 5, 40);
			expect(handlers.onSweepStart).not.toHaveBeenCalled();
		});

		it('leaves a press-and-release to the click path', () => {
			press('m');

			expect(sweep.phase).toBe('pending');
			expect(sweep.release()).toBe(false);
			expect(handlers.onCross).not.toHaveBeenCalled();
			expect(handlers.onCommit).not.toHaveBeenCalled();
		});

		it('does not sweep on movement below the threshold', () => {
			press('m');
			sweep.move(centreOf('m') + SWEEP_MOVE_THRESHOLD_PX - 1, FIELD_HEIGHT / 2, 40);

			expect(sweep.phase).toBe('pending');
			expect(handlers.onSweepStart).not.toHaveBeenCalled();
			expect(handlers.onCross).not.toHaveBeenCalled();
		});

		it('promotes to a sweep once the movement threshold is crossed', () => {
			press('m');
			sweep.move(centreOf('m') + SWEEP_MOVE_THRESHOLD_PX, FIELD_HEIGHT / 2, 40);

			expect(sweep.phase).toBe('sweeping');
			expect(handlers.onSweepStart).toHaveBeenCalledTimes(1);
		});
	});

	describe('crossing qualities', () => {
		it('auditions each newly crossed quality in order', () => {
			press('');
			sweepTo('m');
			sweepTo('7');
			sweepTo('maj7');

			expect(handlers.onCross.mock.calls.map(([quality]) => quality)).toEqual(['m', '7', 'maj7']);
		});

		it('does not re-audition the quality already under the pointer', () => {
			press('');
			sweepTo('m');
			sweepTo('m');
			sweep.move(centreOf('m') + 5, FIELD_HEIGHT / 2, 60);

			expect(handlers.onCross).toHaveBeenCalledTimes(1);
		});

		it('never auditions the pressed quality — the click path owns it', () => {
			press('m');
			sweep.move(centreOf('m') + SWEEP_MOVE_THRESHOLD_PX, FIELD_HEIGHT / 2, 40);

			expect(handlers.onCross).not.toHaveBeenCalled();
			expect(sweep.quality).toBe('m');
		});

		it('treats the major triad’s empty key as a real quality', () => {
			press('m');
			sweepTo('');

			expect(handlers.onCross).toHaveBeenCalledWith('');
		});

		it('stays alive across the gap between two buttons', () => {
			press('');
			sweepTo('m');
			// Land in the gap that precedes '7'
			sweep.move(2 * SLOT_WIDTH + GAP / 2, FIELD_HEIGHT / 2, 60);

			expect(sweep.phase).toBe('sweeping');
			expect(handlers.onCancel).not.toHaveBeenCalled();
			expect(handlers.onCross).toHaveBeenCalledTimes(1);
		});

		it('re-auditions a quality the sweep left and came back to', () => {
			press('');
			sweepTo('m');
			sweepTo('7');
			sweepTo('m');

			expect(handlers.onCross.mock.calls.map(([quality]) => quality)).toEqual(['m', '7', 'm']);
		});
	});

	describe('release', () => {
		it('commits the last crossed quality', () => {
			press('');
			sweepTo('m');
			sweepTo('7');

			expect(sweep.release()).toBe(true);
			expect(handlers.onCommit).toHaveBeenCalledExactlyOnceWith('7', { swept: true });
			expect(sweep.phase).toBe('idle');
		});

		it('commits the last crossed quality when released over a gap', () => {
			press('');
			sweepTo('m');
			sweep.move(2 * SLOT_WIDTH + GAP / 2, FIELD_HEIGHT / 2, 60);

			expect(sweep.release()).toBe(true);
			expect(handlers.onCommit).toHaveBeenCalledExactlyOnceWith('m', { swept: true });
		});

		it('commits a sweep that never left the pressed button as unswept', () => {
			press('m');
			sweep.move(centreOf('m') + SWEEP_MOVE_THRESHOLD_PX, FIELD_HEIGHT / 2, 40);

			expect(sweep.release()).toBe(true);
			expect(handlers.onCommit).toHaveBeenCalledExactlyOnceWith('m', { swept: false });
		});

		it('commits a sweep that came back to the pressed button as swept', () => {
			press('m');
			sweepTo('7');
			sweepTo('m', 60);

			expect(sweep.release()).toBe(true);
			expect(handlers.onCommit).toHaveBeenCalledExactlyOnceWith('m', { swept: true });
		});

		it('commits nothing once the session has been cancelled', () => {
			press('');
			sweepTo('m');
			sweep.cancel();

			expect(sweep.release()).toBe(false);
			expect(handlers.onCommit).not.toHaveBeenCalled();
		});
	});

	describe('cancellation', () => {
		it('cancels when the pointer leaves the field', () => {
			press('');
			sweepTo('m');
			sweep.move(FIELD_WIDTH + 30, FIELD_HEIGHT / 2, 60);

			expect(handlers.onCancel).toHaveBeenCalledTimes(1);
			expect(sweep.phase).toBe('idle');
			expect(handlers.onCommit).not.toHaveBeenCalled();
		});

		it('does not re-arm when the pointer comes back into the field', () => {
			press('');
			sweepTo('m');
			sweep.move(FIELD_WIDTH + 30, FIELD_HEIGHT / 2, 60);
			sweepTo('7', 80);

			expect(handlers.onCross).toHaveBeenCalledTimes(1);
			expect(handlers.onSweepStart).toHaveBeenCalledTimes(1);
		});

		it('ends a pending press silently: it never sounded, so there is nothing to cancel', () => {
			press('m');
			sweep.cancel();

			expect(handlers.onCancel).not.toHaveBeenCalled();
			expect(sweep.phase).toBe('idle');
		});

		it('is a no-op with no gesture in flight', () => {
			sweep.cancel();

			expect(handlers.onCancel).not.toHaveBeenCalled();
		});
	});

	describe('drag arbitration', () => {
		it('lets a downward drag through untouched', () => {
			press('m');

			expect(sweep.shouldAllowDrag(centreOf('m') + 2, FIELD_HEIGHT / 2 + 30, 40)).toBe(true);
			expect(sweep.phase).toBe('idle');
		});

		it('lets any drag through once the press has been held', () => {
			press('m');

			expect(sweep.shouldAllowDrag(centreOf('m') + 40, FIELD_HEIGHT / 2, DRAG_HOLD_MS)).toBe(true);
			expect(sweep.phase).toBe('idle');
		});

		it('suppresses the drag for a quick horizontal move', () => {
			press('m');

			expect(sweep.shouldAllowDrag(centreOf('m') + 40, FIELD_HEIGHT / 2 + 2, 40)).toBe(false);
			expect(sweep.phase).toBe('pending');
		});

		it('suppresses the drag once the sweep owns the gesture', () => {
			press('');
			sweepTo('m');

			expect(sweep.shouldAllowDrag(centreOf('m'), FIELD_HEIGHT / 2 + 60, 300)).toBe(false);
			expect(sweep.phase).toBe('sweeping');
		});

		it('allows the drag when no gesture is being tracked', () => {
			expect(sweep.shouldAllowDrag(10, 10, 0)).toBe(true);
		});

		it('stops sweeping after the drag has claimed the gesture', () => {
			press('m');
			sweep.shouldAllowDrag(centreOf('m'), FIELD_HEIGHT / 2 + 30, 40);
			sweepTo('7', 80);

			expect(handlers.onSweepStart).not.toHaveBeenCalled();
			expect(handlers.onCross).not.toHaveBeenCalled();
			expect(sweep.release()).toBe(false);
		});

		it('never promotes a drag-shaped move to a sweep', () => {
			press('m');
			// Straight down, past the threshold: this is the drag-to-canvas gesture
			sweep.move(centreOf('m'), FIELD_HEIGHT / 2 + SWEEP_MOVE_THRESHOLD_PX * 2, 40);

			expect(sweep.phase).toBe('pending');
			expect(handlers.onSweepStart).not.toHaveBeenCalled();
		});

		it('never promotes a held press to a sweep', () => {
			press('m');
			sweepTo('7', DRAG_HOLD_MS + 50);

			expect(sweep.phase).toBe('pending');
			expect(handlers.onCross).not.toHaveBeenCalled();
		});
	});
});
