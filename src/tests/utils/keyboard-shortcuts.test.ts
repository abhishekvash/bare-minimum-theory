/** Keyboard contract tests for the centralized page handler. */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createKeyboardState,
	handleKeyboardEvent,
	resetKeyboardBrowse,
	type KeyboardCallbacks
} from '#lib/utils/keyboard-shortcuts.ts';
import { QUALITY_GRADIENT } from '#lib/utils/theory-engine/constants.ts';

function keyEvent(
	key: string,
	target: EventTarget = document.body,
	init: KeyboardEventInit = {}
): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
	Object.defineProperty(event, 'target', { value: target });
	return event;
}

function focusTarget(attributes: Record<string, string>): HTMLButtonElement {
	const button = document.createElement('button');
	for (const [name, value] of Object.entries(attributes)) button.setAttribute(name, value);
	return button;
}

function callbacks(overrides: Partial<KeyboardCallbacks> = {}): KeyboardCallbacks {
	return {
		onPlayStop: vi.fn(),
		onStop: vi.fn(),
		onSave: vi.fn(),
		onExport: vi.fn(),
		onHelp: vi.fn(),
		onRevertAudition: vi.fn(),
		onCloseInspector: vi.fn(),
		onCloseLibrary: vi.fn(),
		onCloseOverlay: vi.fn(),
		onSelectSlot: vi.fn(() => true),
		onSelectRoot: vi.fn(),
		onSelectQuality: vi.fn(),
		onBrowseQuality: vi.fn(),
		onStageQuality: vi.fn(),
		onFocusRoot: vi.fn(),
		onFocusQuality: vi.fn(),
		onAddChord: vi.fn(),
		onReplaceSlot: vi.fn(),
		hasPendingAudition: () => false,
		hasInspector: () => false,
		hasLibraryPanel: () => false,
		hasOverlay: () => false,
		selectedSlot: () => null,
		isPlaying: () => false,
		canSave: () => true,
		hasChordSelected: () => true,
		qualityGridColumns: () => 6,
		...overrides
	};
}

describe('keyboard shortcuts', () => {
	beforeEach(() => vi.clearAllMocks());

	it('walks one Escape surface per press in the settled order', () => {
		const open = {
			audition: true,
			inspector: true,
			library: true,
			overlay: true,
			playing: true
		};
		const order: string[] = [];
		const cb = callbacks({
			hasPendingAudition: () => open.audition,
			hasInspector: () => open.inspector,
			hasLibraryPanel: () => open.library,
			hasOverlay: () => open.overlay,
			isPlaying: () => open.playing,
			onRevertAudition: () => {
				order.push('audition');
				open.audition = false;
			},
			onCloseInspector: () => {
				order.push('inspector');
				open.inspector = false;
			},
			onCloseLibrary: () => {
				order.push('library');
				open.library = false;
			},
			onCloseOverlay: () => {
				order.push('overlay');
				open.overlay = false;
			},
			onStop: () => {
				order.push('transport');
				open.playing = false;
			}
		});
		const state = createKeyboardState();

		for (let press = 0; press < 5; press += 1) {
			expect(handleKeyboardEvent(keyEvent('Escape'), state, cb)).toBe(true);
		}
		expect(handleKeyboardEvent(keyEvent('Escape'), state, cb)).toBe(false);
		expect(order).toEqual(['audition', 'inspector', 'library', 'overlay', 'transport']);
	});

	it('keeps Space global and leaves Tab to native focus traversal', () => {
		const cb = callbacks({ hasOverlay: () => true });
		const state = createKeyboardState();

		expect(handleKeyboardEvent(keyEvent(' '), state, cb)).toBe(true);
		expect(cb.onPlayStop).toHaveBeenCalledOnce();
		expect(handleKeyboardEvent(keyEvent('Tab'), state, cb)).toBe(false);
	});

	it('leaves Space to a focused control inside a dialog', () => {
		const cb = callbacks({ hasOverlay: () => true });
		const dialog = document.createElement('div');
		dialog.setAttribute('role', 'dialog');
		const button = document.createElement('button');
		dialog.append(button);

		expect(handleKeyboardEvent(keyEvent(' ', button), createKeyboardState(), cb)).toBe(false);
		expect(cb.onPlayStop).not.toHaveBeenCalled();
	});

	it('still toggles playback from Space on a focused button outside dialogs', () => {
		const cb = callbacks();
		const button = document.createElement('button');

		expect(handleKeyboardEvent(keyEvent(' ', button), createKeyboardState(), cb)).toBe(true);
		expect(cb.onPlayStop).toHaveBeenCalledOnce();
	});

	it.each([
		['1', 0],
		['5', 4],
		['9', 8]
	])('maps digit %s to slot %i', (key, slot) => {
		const cb = callbacks();
		expect(handleKeyboardEvent(keyEvent(key), createKeyboardState(), cb)).toBe(true);
		expect(cb.onSelectSlot).toHaveBeenCalledWith(slot);
	});

	it('ignores a numeric shortcut when the page rejects an unavailable slot', () => {
		const cb = callbacks({ onSelectSlot: vi.fn(() => false) });
		expect(handleKeyboardEvent(keyEvent('9'), createKeyboardState(), cb)).toBe(false);
	});

	it('uses the rendered column count for vertical quality navigation', () => {
		const cb = callbacks({ qualityGridColumns: () => 3 });
		const state = createKeyboardState();
		const quality = focusTarget({ 'data-quality': QUALITY_GRADIENT[4] });

		handleKeyboardEvent(keyEvent('ArrowUp', quality), state, cb);
		expect(cb.onFocusRoot).not.toHaveBeenCalled();
		expect(cb.onFocusQuality).toHaveBeenCalledWith(1);
	});

	it('moves spatially between roots and the top quality row', () => {
		const cb = callbacks();
		const state = createKeyboardState();
		const root = focusTarget({ 'data-root': '64' });
		const quality = focusTarget({ 'data-quality': QUALITY_GRADIENT[2] });

		expect(handleKeyboardEvent(keyEvent('ArrowDown', root), state, cb)).toBe(true);
		expect(cb.onFocusQuality).toHaveBeenCalledWith(0);

		expect(handleKeyboardEvent(keyEvent('ArrowUp', quality), state, cb)).toBe(true);
		expect(cb.onFocusRoot).toHaveBeenCalledWith(4);
	});

	it('selects and auditions root and quality arrow moves while stopped', () => {
		const cb = callbacks();
		const state = createKeyboardState();
		const root = focusTarget({ 'data-root': '60' });
		const quality = focusTarget({ 'data-quality': QUALITY_GRADIENT[0] });

		handleKeyboardEvent(keyEvent('ArrowRight', root), state, cb);
		expect(cb.onSelectRoot).toHaveBeenCalledWith(61, true);
		expect(cb.onFocusRoot).toHaveBeenCalledWith(1);

		handleKeyboardEvent(keyEvent('ArrowRight', quality), state, cb);
		expect(cb.onSelectQuality).toHaveBeenCalledWith(QUALITY_GRADIENT[1], true);
		expect(cb.onFocusQuality).toHaveBeenCalledWith(1);
	});

	it('uses arrows as a silent browse cursor while playing and Enter stages it', () => {
		const cb = callbacks({ isPlaying: () => true });
		const state = createKeyboardState();
		const root = focusTarget({ 'data-root': '60' });
		const quality = focusTarget({ 'data-quality': QUALITY_GRADIENT[0] });

		handleKeyboardEvent(keyEvent('ArrowRight', root), state, cb);
		expect(cb.onSelectRoot).not.toHaveBeenCalled();
		expect(cb.onFocusRoot).toHaveBeenCalledWith(1);

		handleKeyboardEvent(keyEvent('ArrowRight', quality), state, cb);
		expect(cb.onSelectQuality).not.toHaveBeenCalled();
		expect(cb.onBrowseQuality).toHaveBeenCalledWith(QUALITY_GRADIENT[1]);

		const browsedQuality = focusTarget({ 'data-quality': QUALITY_GRADIENT[1] });
		handleKeyboardEvent(keyEvent('Enter', browsedQuality), state, cb);
		expect(cb.onStageQuality).toHaveBeenCalledWith(QUALITY_GRADIENT[1]);
	});

	it('resets a stale playback browse cursor', () => {
		const state = createKeyboardState();
		state.browseQualityIndex = 8;

		resetKeyboardBrowse(state);

		expect(state.browseQualityIndex).toBeNull();
	});

	it('preserves help, save, export, add and replace shortcuts', () => {
		let selectedSlot: number | null = null;
		const cb = callbacks({ selectedSlot: () => selectedSlot });
		const state = createKeyboardState();

		handleKeyboardEvent(keyEvent('?'), state, cb);
		handleKeyboardEvent(keyEvent('s', document.body, { ctrlKey: true }), state, cb);
		handleKeyboardEvent(keyEvent('e', document.body, { metaKey: true }), state, cb);
		handleKeyboardEvent(keyEvent('Enter'), state, cb);
		expect(cb.onHelp).toHaveBeenCalledOnce();
		expect(cb.onSave).toHaveBeenCalledOnce();
		expect(cb.onExport).toHaveBeenCalledOnce();
		expect(cb.onAddChord).toHaveBeenCalledOnce();

		selectedSlot = 3;
		handleKeyboardEvent(keyEvent('r'), state, cb);
		handleKeyboardEvent(keyEvent('Enter'), state, cb);
		expect(cb.onReplaceSlot).toHaveBeenNthCalledWith(1, 3);
		expect(cb.onReplaceSlot).toHaveBeenNthCalledWith(2, 3);
	});

	it('does not steal Enter from native buttons', () => {
		const cb = callbacks();
		const button = focusTarget({});

		expect(handleKeyboardEvent(keyEvent('Enter', button), createKeyboardState(), cb)).toBe(false);
		expect(cb.onAddChord).not.toHaveBeenCalled();
	});

	it('does not re-fire one-shot shortcuts while a key auto-repeats', () => {
		let playing = false;
		const cb = callbacks({
			isPlaying: () => playing,
			onPlayStop: vi.fn(() => {
				playing = !playing;
			})
		});
		const state = createKeyboardState();

		handleKeyboardEvent(keyEvent(' '), state, cb);
		const heldSpace = keyEvent(' ', document.body, { repeat: true });
		expect(handleKeyboardEvent(heldSpace, state, cb)).toBe(true);
		expect(cb.onPlayStop).toHaveBeenCalledOnce();

		handleKeyboardEvent(keyEvent('Enter'), state, cb);
		handleKeyboardEvent(keyEvent('Enter', document.body, { repeat: true }), state, cb);
		expect(cb.onAddChord).toHaveBeenCalledOnce();

		// Escape stops playback once; holding it must not keep walking the surface stack
		handleKeyboardEvent(keyEvent('Escape', document.body, { repeat: true }), state, cb);
		expect(cb.onStop).not.toHaveBeenCalled();

		handleKeyboardEvent(keyEvent('s', document.body, { ctrlKey: true, repeat: true }), state, cb);
		expect(cb.onSave).not.toHaveBeenCalled();
	});

	it('keeps auto-repeat for arrow navigation', () => {
		const cb = callbacks();
		const state = createKeyboardState();
		const root = focusTarget({ 'data-root': '60' });

		handleKeyboardEvent(keyEvent('ArrowRight', root), state, cb);
		handleKeyboardEvent(keyEvent('ArrowRight', root, { repeat: true }), state, cb);

		expect(cb.onSelectRoot).toHaveBeenCalledTimes(2);
	});

	it('leaves modified arrows on builder controls to the browser', () => {
		const cb = callbacks();
		const root = focusTarget({ 'data-root': '60' });
		const quality = focusTarget({ 'data-quality': 'm' });

		for (const modifier of ['ctrlKey', 'metaKey', 'altKey'] as const) {
			const state = createKeyboardState();
			expect(
				handleKeyboardEvent(keyEvent('ArrowRight', root, { [modifier]: true }), state, cb)
			).toBe(false);
			expect(
				handleKeyboardEvent(keyEvent('ArrowDown', quality, { [modifier]: true }), state, cb)
			).toBe(false);
		}
		expect(cb.onSelectRoot).not.toHaveBeenCalled();
		expect(cb.onSelectQuality).not.toHaveBeenCalled();
		expect(cb.onFocusQuality).not.toHaveBeenCalled();
	});

	it('does not treat Alt+digit or Alt+R as slot shortcuts', () => {
		const cb = callbacks({ selectedSlot: () => 2 });
		const state = createKeyboardState();

		expect(handleKeyboardEvent(keyEvent('1', document.body, { altKey: true }), state, cb)).toBe(
			false
		);
		expect(handleKeyboardEvent(keyEvent('r', document.body, { altKey: true }), state, cb)).toBe(
			false
		);
		expect(cb.onSelectSlot).not.toHaveBeenCalled();
		expect(cb.onReplaceSlot).not.toHaveBeenCalled();
	});
});
