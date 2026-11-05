/**
 * Quality Sweep Gesture
 * The pointer state machine behind press-and-sweep browsing in the quality field, kept out of the
 * component so the arbitration rules are testable without a DOM.
 *
 * One press has to resolve into one of three gestures, and the browser only gives us one chance to
 * decide: native HTML5 drag starts a few pixels into a press and cannot be deferred or restarted.
 *
 * | Gesture | Signal |
 * |---|---|
 * | **Click** — select + chained preview | Released before the movement threshold |
 * | **Sweep** — strum across the field | Quick movement that is horizontal-dominant |
 * | **Drag** — drop a chord on a slot | Movement after a hold, or vertical-dominant movement |
 *
 * The split mirrors what the app already does on touch: the `mobile-drag-drop` polyfill is
 * configured with `holdToDrag: 200`, so a held press has meant "drag" on touch since before the
 * sweep existed, and `touch-action: pan-y` on the field makes the browser itself route
 * vertical-first gestures to the page scroller. Using the same two signals for the mouse keeps the
 * platforms honest with each other: drag-to-canvas (downward, towards the progression) stays
 * exactly as it was, and drags in any other direction still work after a short hold.
 */

/** Movement, in CSS pixels, that separates a click from a sweep */
export const SWEEP_MOVE_THRESHOLD_PX = 8;

/** A press held at least this long claims the gesture for the native drag, matching `holdToDrag` */
export const DRAG_HOLD_MS = 200;

/** Where a press currently sits between click, sweep and drag */
export type SweepPhase = 'idle' | 'pending' | 'sweeping';

/** What sits under a point: the field itself, and the quality button if the point is on one */
export interface SweepHit {
	/** False once the pointer has left the field's bounds — the sweep ends there */
	inField: boolean;
	/** Quality under the point, or null in the gaps between buttons. `''` is the major triad */
	quality: string | null;
}

export interface SweepHandlers {
	/** Resolve what lies under a viewport point */
	hitTest: (x: number, y: number) => SweepHit;
	/** The press just became a sweep — the caller takes pointer capture here */
	onSweepStart: () => void;
	/** A new quality was crossed and should be auditioned */
	onCross: (quality: string) => void;
	/**
	 * The sweep ended on `quality`, which becomes the selection. `swept` is false when the sweep
	 * never left the pressed button: nothing has sounded, so the caller treats it as a click.
	 */
	onCommit: (quality: string, details: { swept: boolean }) => void;
	/**
	 * A sweep ended without selecting anything (left the field, cancelled, blurred). Not called
	 * for a press that never became a sweep: it has sounded nothing, so there is nothing to stop.
	 */
	onCancel: () => void;
}

export interface SweepSession {
	/** Current phase, for the caller's own guards */
	readonly phase: SweepPhase;
	/** Last quality crossed during the gesture, retained while the pointer passes through gaps */
	readonly quality: string | null;
	/**
	 * Begin tracking a press
	 * @param x - Viewport x of the press
	 * @param y - Viewport y of the press
	 * @param quality - Quality pressed, or null when the press missed every button
	 * @param time - Event timestamp, used to measure the hold
	 */
	press(x: number, y: number, quality: string | null, time: number): void;
	/**
	 * Track pointer movement, promoting the press to a sweep once it reads as one
	 * @param x - Viewport x
	 * @param y - Viewport y
	 * @param time - Event timestamp
	 */
	move(x: number, y: number, time: number): void;
	/**
	 * End the gesture on release
	 * @returns true when a sweep committed a selection, so the caller can swallow the click
	 */
	release(): boolean;
	/** End the gesture without selecting (pointer cancel, blur, leaving the field) */
	cancel(): void;
	/**
	 * Decide whether a `dragstart` should be allowed to proceed. Allowing it abandons the sweep.
	 * @param x - Viewport x reported by the drag event
	 * @param y - Viewport y reported by the drag event
	 * @param time - Event timestamp
	 * @returns true to let the native drag run, false to suppress it in favour of the sweep
	 */
	shouldAllowDrag(x: number, y: number, time: number): boolean;
}

/**
 * Does this movement read as a drag rather than a sweep?
 * Held presses belong to the drag (matching the touch polyfill), and so does movement that heads
 * away from the field's rows rather than along them.
 * @param dx - Horizontal distance from the press
 * @param dy - Vertical distance from the press
 * @param heldMs - How long the press has been down
 */
function isDragShaped(dx: number, dy: number, heldMs: number): boolean {
	return heldMs >= DRAG_HOLD_MS || Math.abs(dy) > Math.abs(dx);
}

/**
 * Create a sweep session for one quality field
 * @param handlers - Hit testing plus the callbacks the field reacts to
 */
export function createSweepSession(handlers: SweepHandlers): SweepSession {
	let phase: SweepPhase = 'idle';
	let originX = 0;
	let originY = 0;
	let pressTime = 0;
	/** Last quality reported to `onCross`, so re-entering the same button stays silent */
	let crossed: string | null = null;
	/** Whether `onCross` has fired, to tell a real sweep from one that never left its button */
	let crossedAny = false;
	/**
	 * Set once this press's `dragstart` was suppressed. The browser never offers a second one, so
	 * drag-shaped movement can no longer hand off to a drag and must be free to become the sweep.
	 */
	let dragSuppressed = false;

	function reset(): void {
		phase = 'idle';
		crossed = null;
		crossedAny = false;
		dragSuppressed = false;
	}

	function press(x: number, y: number, quality: string | null, time: number): void {
		// A press that misses every button has nothing to sweep from
		if (quality === null) {
			reset();
			return;
		}

		phase = 'pending';
		originX = x;
		originY = y;
		pressTime = time;
		crossed = quality;
		crossedAny = false;
		dragSuppressed = false;
	}

	function cancel(): void {
		if (phase === 'idle') return;

		const wasSweeping = phase === 'sweeping';
		reset();
		if (wasSweeping) handlers.onCancel();
	}

	function move(x: number, y: number, time: number): void {
		if (phase === 'idle') return;

		const hit = handlers.hitTest(x, y);
		if (!hit.inField) {
			cancel();
			return;
		}

		if (phase === 'pending') {
			const dx = x - originX;
			const dy = y - originY;
			if (Math.hypot(dx, dy) < SWEEP_MOVE_THRESHOLD_PX) return;
			// Still drag-shaped: stay pending and leave the gesture to the browser's drag, unless
			// that drag was already suppressed and can no longer start
			if (!dragSuppressed && isDragShaped(dx, dy, time - pressTime)) return;

			phase = 'sweeping';
			handlers.onSweepStart();
		}

		if (hit.quality !== null && hit.quality !== crossed) {
			crossed = hit.quality;
			crossedAny = true;
			handlers.onCross(crossed);
		}
	}

	function release(): boolean {
		const committing = phase === 'sweeping' ? crossed : null;
		const swept = crossedAny;
		reset();

		if (committing === null) return false;

		handlers.onCommit(committing, { swept });
		return true;
	}

	function shouldAllowDrag(x: number, y: number, time: number): boolean {
		// Not our gesture
		if (phase === 'idle') return true;
		// The sweep already owns this press
		if (phase === 'sweeping') return false;

		if (!isDragShaped(x - originX, y - originY, time - pressTime)) {
			dragSuppressed = true;
			return false;
		}

		// The drag takes the gesture; nothing has sounded yet, so there is nothing to cancel
		reset();
		return true;
	}

	return {
		get phase() {
			return phase;
		},
		get quality() {
			return crossed;
		},
		press,
		move,
		release,
		cancel,
		shouldAllowDrag
	};
}
