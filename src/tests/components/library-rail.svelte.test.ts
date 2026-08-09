/**
 * Behaviour tests for the library rail: the icons acting as tabs, the drag that expands the
 * rail on approach, and what a drop versus a drag-away does to the panel.
 *
 * The component is mounted directly (no testing-library in this project) and driven with
 * synthetic drag events, since jsdom has no drag-and-drop of its own.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import LibraryRailHarness from './LibraryRailHarness.svelte';
import type { Chord } from '$lib/utils/theory-engine/types';
import type { SavedProgression } from '$lib/utils/progression-persistence';
import { requestProgressionLoad } from '$lib/components/LibraryRail.svelte';
import {
	addChord,
	clearPalette,
	clearProgression,
	loadProgressionToCanvas,
	progressionState
} from '$lib/stores/progression.svelte';
import { openLibraryPanel, resetUIState, uiState } from '$lib/stores/ui.svelte';

const CHORD: Chord = {
	root: 60,
	quality: 'maj7',
	inversion: 0,
	voicing: 'close',
	octave: 0,
	duration: '1m'
};

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

/**
 * Mount the rail into the document
 * @param props - Props to hand the rail (the page's callbacks)
 * @returns The mount target
 */
function renderRail(props: { onLoadProgression?: (progression: SavedProgression) => void } = {}) {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(LibraryRailHarness, { target, props });
	flushSync();
	return target;
}

/** Fake dataTransfer for a chord drag arriving from outside the library */
function chordDataTransfer(types = ['application/json'], payload: unknown = CHORD) {
	return {
		types,
		effectAllowed: 'copyMove',
		dropEffect: 'none',
		getData: (format: string) => (format === 'application/json' ? JSON.stringify(payload) : '')
	};
}

/**
 * A drag whose payload the palette will refuse — structurally a chord, but naming a quality
 * the theory engine has never heard of
 */
function junkDataTransfer() {
	return chordDataTransfer(['application/json'], { ...CHORD, quality: 'bogus' });
}

/**
 * Replace jsdom's missing matchMedia with a stub the rail can read
 * @param matches - Whether the desktop query matches to begin with
 * @returns A handle for pushing viewport changes at the component
 */
function stubMatchMedia(matches: boolean) {
	const listeners: ((event: MediaQueryListEvent) => void)[] = [];

	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		writable: true,
		value: (query: string) => ({
			matches,
			media: query,
			addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
				listeners.push(listener),
			removeEventListener: () => {}
		})
	});

	return {
		/**
		 * Push a viewport change through the listener the component registered
		 * @param next - Whether the desktop query now matches
		 */
		change(next: boolean) {
			for (const listener of listeners) {
				listener({ matches: next } as MediaQueryListEvent);
			}
			flushSync();
		}
	};
}

/**
 * Dispatch a drag event jsdom cannot construct on its own
 * @param element - Element to dispatch on
 * @param type - Drag event name
 * @param dataTransfer - Payload the event should carry
 * @param relatedTarget - Element the pointer moved to (drag-leave only)
 */
function fireDrag(
	element: Element,
	type: string,
	dataTransfer: unknown,
	relatedTarget: Node | null = null
): void {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
	Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
	element.dispatchEvent(event);
	flushSync();
}

/** The rail's icon column */
function railColumn(): HTMLElement {
	const rail = target.querySelector<HTMLElement>('[aria-label="Library sections"]');
	if (!rail) throw new Error('rail column not rendered');
	return rail;
}

/**
 * One of the rail's section icons
 * @param label - Section label the icon carries
 */
function railIcon(label: 'Palette' | 'Saved'): HTMLButtonElement {
	const icon = railColumn().querySelector<HTMLButtonElement>(`button[aria-label^="${label}"]`);
	if (!icon) throw new Error(`${label} icon not rendered`);
	return icon;
}

/** The palette's drop zone, present only while the palette section shows */
function paletteDropZone(): HTMLElement | null {
	return document.body.querySelector<HTMLElement>('[aria-label="Chord Palette Drop Zone"]');
}

/** The expanded side panel, if any (the small-screen drawer is a dialog instead) */
function panel(): HTMLElement | null {
	return target.querySelector<HTMLElement>('aside');
}

/** The small-screen drawer, if any */
function drawer(): HTMLElement | null {
	return document.body.querySelector<HTMLElement>('[role="dialog"]');
}

describe('LibraryRail', () => {
	beforeEach(() => {
		clearProgression();
		clearPalette();
		resetUIState();
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
		// jsdom has no matchMedia of its own; leave it that way for the next test
		Reflect.deleteProperty(window, 'matchMedia');
	});

	describe('collapsed rail', () => {
		it('should render both section icons with their counts', () => {
			progressionState.palette = [CHORD, { ...CHORD, root: 62 }];

			renderRail();

			expect(railIcon('Palette').getAttribute('aria-label')).toBe('Palette (2)');
			expect(railIcon('Saved').getAttribute('aria-label')).toBe('Saved (0)');
		});

		it('should show no panel until an icon is clicked', () => {
			renderRail();

			expect(panel()).toBeNull();
			expect(uiState.libraryPanel.open).toBeNull();
		});
	});

	describe('icons as tabs', () => {
		it('should expand the section its icon names', () => {
			renderRail();

			railIcon('Palette').click();
			flushSync();

			expect(uiState.libraryPanel.open).toBe('palette');
			expect(paletteDropZone()).not.toBeNull();
		});

		it('should show one section at a time', () => {
			renderRail();

			railIcon('Palette').click();
			flushSync();
			railIcon('Saved').click();
			flushSync();

			expect(uiState.libraryPanel.open).toBe('saved');
			expect(paletteDropZone()).toBeNull();
			expect(panel()).not.toBeNull();
		});

		it('should collapse when the active icon is clicked again', () => {
			renderRail();

			railIcon('Palette').click();
			flushSync();
			railIcon('Palette').click();
			flushSync();

			expect(uiState.libraryPanel.open).toBeNull();
			expect(panel()).toBeNull();
		});

		it('should collapse from the panel close control', () => {
			renderRail();
			railIcon('Saved').click();
			flushSync();

			const close = target.querySelector<HTMLButtonElement>('button[aria-label="Close library"]');
			close?.click();
			flushSync();

			expect(uiState.libraryPanel.open).toBeNull();
		});
	});

	describe('drag onto the collapsed rail', () => {
		it('should auto-expand the palette so a drop target exists', () => {
			renderRail();

			fireDrag(railColumn(), 'dragover', chordDataTransfer());

			expect(uiState.libraryPanel.open).toBe('palette');
			expect(uiState.libraryPanel.autoOpened).toBe(true);
			expect(paletteDropZone()).not.toBeNull();
		});

		it('should accept a canvas chord that also carries progression-chord', () => {
			renderRail();

			fireDrag(
				railColumn(),
				'dragover',
				chordDataTransfer(['progression-chord', 'application/json'])
			);

			expect(uiState.libraryPanel.open).toBe('palette');
		});

		it('should ignore a palette reorder drag', () => {
			renderRail();

			fireDrag(railColumn(), 'dragover', chordDataTransfer(['palette-chord', 'application/json']));

			expect(uiState.libraryPanel.open).toBeNull();
		});

		it('should switch a user-opened panel without marking it auto-opened', () => {
			renderRail();
			openLibraryPanel('saved');
			flushSync();

			fireDrag(railColumn(), 'dragover', chordDataTransfer());

			expect(uiState.libraryPanel.open).toBe('palette');
			expect(uiState.libraryPanel.autoOpened).toBe(false);
		});
	});

	describe('drag leaving without a drop', () => {
		it('should collapse a panel the drag opened', () => {
			renderRail();
			fireDrag(railColumn(), 'dragover', chordDataTransfer());

			fireDrag(railColumn(), 'dragleave', chordDataTransfer(), document.body);

			expect(uiState.libraryPanel.open).toBeNull();
		});

		it('should leave a panel the user opened alone', () => {
			renderRail();
			railIcon('Palette').click();
			flushSync();

			fireDrag(railColumn(), 'dragleave', chordDataTransfer(), document.body);

			expect(uiState.libraryPanel.open).toBe('palette');
		});

		it('should stay open while the drag is still inside the library', () => {
			renderRail();
			fireDrag(railColumn(), 'dragover', chordDataTransfer());

			// Moving from the rail into the panel it just opened is not leaving
			fireDrag(railColumn(), 'dragleave', chordDataTransfer(), paletteDropZone());

			expect(uiState.libraryPanel.open).toBe('palette');
			expect(uiState.libraryPanel.autoOpened).toBe(true);
		});
	});

	describe('dropping a chord', () => {
		it('should copy the chord into the palette and pin the panel open', () => {
			renderRail();
			fireDrag(railColumn(), 'dragover', chordDataTransfer());

			const dropZone = paletteDropZone();
			expect(dropZone).not.toBeNull();
			fireDrag(dropZone!, 'drop', chordDataTransfer());

			expect(progressionState.palette).toEqual([CHORD]);
			expect(uiState.libraryPanel.open).toBe('palette');
			expect(uiState.libraryPanel.autoOpened).toBe(false);
		});

		it('should accept a drop on the rail icons themselves', () => {
			renderRail();

			fireDrag(railColumn(), 'drop', chordDataTransfer(['progression-chord', 'application/json']));

			expect(progressionState.palette).toEqual([CHORD]);
			expect(uiState.libraryPanel.open).toBe('palette');
			expect(uiState.libraryPanel.autoOpened).toBe(false);
		});

		it('should survive a later drag-leave once pinned', () => {
			renderRail();
			fireDrag(railColumn(), 'dragover', chordDataTransfer());
			fireDrag(paletteDropZone()!, 'drop', chordDataTransfer());

			fireDrag(railColumn(), 'dragleave', chordDataTransfer(), document.body);

			expect(uiState.libraryPanel.open).toBe('palette');
		});
	});

	describe('dropping something the palette refuses', () => {
		// dragover can only read a payload's types, so junk still auto-expands the rail —
		// the drop is where it has to be undone, since no dragleave is coming

		it('should collapse the panel its own drag opened', () => {
			renderRail();
			fireDrag(railColumn(), 'dragover', junkDataTransfer());
			expect(uiState.libraryPanel.open).toBe('palette');

			fireDrag(paletteDropZone()!, 'drop', junkDataTransfer());

			expect(progressionState.palette).toEqual([]);
			expect(uiState.libraryPanel.open).toBeNull();
		});

		it('should collapse when the junk is dropped on the rail itself', () => {
			renderRail();
			fireDrag(railColumn(), 'dragover', junkDataTransfer());

			fireDrag(railColumn(), 'drop', junkDataTransfer());

			expect(progressionState.palette).toEqual([]);
			expect(uiState.libraryPanel.open).toBeNull();
		});

		it('should leave a panel the user opened themselves alone', () => {
			renderRail();
			railIcon('Palette').click();
			flushSync();

			fireDrag(paletteDropZone()!, 'drop', junkDataTransfer());

			expect(progressionState.palette).toEqual([]);
			expect(uiState.libraryPanel.open).toBe('palette');
		});

		it('should not mistake a palette reorder for a refused drop', () => {
			renderRail();
			fireDrag(railColumn(), 'dragover', chordDataTransfer());

			// Reorder drops bubble up from the individual chips; the list owns them
			fireDrag(
				paletteDropZone()!,
				'drop',
				chordDataTransfer(['palette-chord', 'application/json'])
			);

			expect(uiState.libraryPanel.open).toBe('palette');
			expect(uiState.libraryPanel.autoOpened).toBe(true);
		});
	});

	describe('loading a saved progression', () => {
		const SAVED: SavedProgression = {
			id: 'saved-1',
			name: 'Test progression',
			tags: [],
			progression: [CHORD, null],
			createdAt: 0
		};

		/**
		 * Mount the rail wired the way the page wires it, on the Saved tab
		 * @returns The progression left waiting on the confirmation dialog, if any
		 */
		function renderSavedTab(): { pending: SavedProgression | null } {
			const state: { pending: SavedProgression | null } = { pending: null };

			progressionState.savedProgressions.items = [SAVED];
			renderRail({
				onLoadProgression: (progression) =>
					requestProgressionLoad(progressionState.progression, progression, {
						onLoad: (target) => loadProgressionToCanvas(target.progression),
						onConfirm: (target) => {
							state.pending = target;
						}
					})
			});
			railIcon('Saved').click();
			flushSync();

			return state;
		}

		/** The saved card's load control */
		function loadButton(): HTMLButtonElement {
			const button = target.querySelector<HTMLButtonElement>('button[aria-label="Load to canvas"]');
			if (!button) throw new Error('load control not rendered');
			return button;
		}

		afterEach(() => {
			progressionState.savedProgressions.items = [];
		});

		it('should load onto an empty canvas without asking', () => {
			const state = renderSavedTab();

			loadButton().click();
			flushSync();

			expect(state.pending).toBeNull();
			expect(progressionState.progression[0]).toEqual(CHORD);
		});

		it('should ask before overwriting a canvas that holds chords', () => {
			const existing = { ...CHORD, root: 62, quality: 'm7' as const };
			addChord(existing);
			const state = renderSavedTab();

			loadButton().click();
			flushSync();

			// The store hands back its reactive proxy of the record, not the record itself
			expect(state.pending).toEqual(SAVED);
			// The canvas keeps what it had until the dialog is answered
			expect(progressionState.progression[0]).toEqual(existing);
		});
	});

	describe('small screens', () => {
		it('should open a drawer instead of the side panel', () => {
			stubMatchMedia(false);
			renderRail();

			railIcon('Palette').click();
			flushSync();

			expect(drawer()).not.toBeNull();
			expect(drawer()?.getAttribute('aria-modal')).toBe('true');
			expect(panel()).toBeNull();
			expect(paletteDropZone()).not.toBeNull();
		});

		it('should swap the side panel for the drawer when the viewport shrinks', () => {
			const media = stubMatchMedia(true);
			renderRail();
			railIcon('Saved').click();
			flushSync();
			expect(panel()).not.toBeNull();
			expect(drawer()).toBeNull();

			media.change(false);

			expect(panel()).toBeNull();
			expect(drawer()).not.toBeNull();
		});

		it('should close an auto-opened drawer when the drag leaves the portalled content', () => {
			stubMatchMedia(false);
			renderRail();
			const transfer = chordDataTransfer();

			fireDrag(railColumn(), 'dragover', transfer);
			expect(drawer()).not.toBeNull();
			expect(uiState.libraryPanel.autoOpened).toBe(true);

			fireDrag(drawer()!, 'dragleave', transfer, document.body);
			expect(drawer()).toBeNull();
			expect(uiState.libraryPanel.open).toBeNull();
		});

		it('should close the drawer from its backdrop', () => {
			stubMatchMedia(false);
			renderRail();
			railIcon('Palette').click();
			flushSync();

			const backdrop = document.body.querySelector<HTMLElement>('[data-slot="dialog-overlay"]');
			backdrop?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
			backdrop?.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
			backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			flushSync();

			expect(uiState.libraryPanel.open).toBeNull();
			expect(drawer()).toBeNull();
		});
	});
});
