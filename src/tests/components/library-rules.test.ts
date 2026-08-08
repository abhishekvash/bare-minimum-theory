/**
 * Tests for the library's decision rules: which drags it accepts (and as what), how a drag
 * over the collapsed rail expands it, and which way a load request goes.
 *
 * The rules live in the components' module scripts so the rail and the palette share one
 * source of truth; the components' behaviour is covered in `library-rail.svelte.test.ts`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Chord } from '$lib/utils/theory-engine/types';
import type { SavedProgression } from '$lib/utils/progression-persistence';
import {
	isPaletteReorderDrag,
	isRenderableChord,
	resolveLibraryDrop,
	SUPPORTED_CHORD_DURATIONS,
	resolveLibraryDropEffect,
	type DragPayloadSource
} from '$lib/components/ChordPalette.svelte';
import {
	needsLoadConfirmation,
	requestProgressionLoad,
	resolveDragExpansion
} from '$lib/components/LibraryRail.svelte';
import { DURATION_OPTIONS } from '$lib/components/ChordInspector.svelte';
import {
	addChord,
	clearProgression,
	loadProgressionToCanvas,
	progressionState
} from '$lib/stores/progression.svelte';

const CHORD: Chord = {
	root: 60,
	quality: 'maj7',
	inversion: 0,
	voicing: 'close',
	octave: 0,
	duration: '1m'
};

/**
 * Build a stand-in for a drag's dataTransfer
 * @param data - Payload keyed by drag format
 * @param effectAllowed - effectAllowed the source drag set
 * @returns A drag payload source the library rules can read
 */
function createDrag(
	data: Record<string, string>,
	effectAllowed = 'uninitialized'
): DragPayloadSource {
	return {
		types: Object.keys(data),
		effectAllowed,
		getData: (format: string) => data[format] ?? ''
	};
}

/** A chord dragged out of the chord builder */
function builderDrag(chord: unknown = CHORD): DragPayloadSource {
	return createDrag({ 'application/json': JSON.stringify(chord) });
}

/** A chord dragged off the canvas — carries both payloads */
function canvasDrag(effectAllowed = 'copyMove'): DragPayloadSource {
	return createDrag(
		{
			'progression-chord': JSON.stringify({ fromIndex: 2 }),
			'application/json': JSON.stringify(CHORD)
		},
		effectAllowed
	);
}

/** A palette chord being dragged to a new position in the palette */
function paletteReorderDrag(): DragPayloadSource {
	return createDrag(
		{
			'application/json': JSON.stringify(CHORD),
			'palette-chord': JSON.stringify({ index: 0 })
		},
		'copyMove'
	);
}

/**
 * Build a saved progression fixture
 * @param progression - Slots the saved progression holds
 * @returns A saved progression record
 */
function savedProgression(progression: (Chord | null)[] = [CHORD, null]): SavedProgression {
	return {
		id: 'saved-1',
		name: 'Test progression',
		tags: [],
		progression,
		createdAt: 0
	};
}

describe('isRenderableChord', () => {
	it('should accept a chord the app itself would build', () => {
		expect(isRenderableChord(CHORD)).toBe(true);
	});

	it('should accept the widest inversion a quality allows', () => {
		// maj7 has four notes, so a 3rd inversion is real
		expect(isRenderableChord({ ...CHORD, inversion: 3 })).toBe(true);
	});

	// Structurally perfect payloads that would break the theory engine downstream
	it('should reject an unknown quality', () => {
		expect(isRenderableChord({ ...CHORD, quality: 'bogus' })).toBe(false);
	});

	it('should reject an unknown voicing', () => {
		expect(isRenderableChord({ ...CHORD, voicing: 'sideways' })).toBe(false);
	});

	it('should not accept inherited object names as quality or voicing vocabulary', () => {
		expect(isRenderableChord({ ...CHORD, quality: 'constructor' })).toBe(false);
		expect(isRenderableChord({ ...CHORD, voicing: 'toString' })).toBe(false);
	});

	it('should reject an inversion past the chord’s own notes', () => {
		// A triad has three notes; a 4th inversion would rotate past them
		expect(isRenderableChord({ ...CHORD, quality: 'm', inversion: 4 })).toBe(false);
		expect(isRenderableChord({ ...CHORD, inversion: -1 })).toBe(false);
	});

	it('should reject roots outside the MIDI range', () => {
		expect(isRenderableChord({ ...CHORD, root: -1 })).toBe(false);
		expect(isRenderableChord({ ...CHORD, root: 128 })).toBe(false);
		expect(isRenderableChord({ ...CHORD, root: 60.5 })).toBe(false);
	});

	it('should reject octave transposition the app never offers', () => {
		expect(isRenderableChord({ ...CHORD, octave: 7 })).toBe(false);
		expect(isRenderableChord({ ...CHORD, octave: -3 })).toBe(false);
	});

	it('should mirror the inspector’s canonical supported-duration domain', () => {
		expect(SUPPORTED_CHORD_DURATIONS).toEqual(DURATION_OPTIONS);
	});

	it('should accept every duration the app supports', () => {
		for (const duration of SUPPORTED_CHORD_DURATIONS) {
			expect(isRenderableChord({ ...CHORD, duration })).toBe(true);
		}
	});

	it('should reject malformed, zero, and syntactically valid but unsupported durations', () => {
		for (const duration of ['', 'whenever', '0m', '3m', '16n', '1n', '0:0:0', '2:0:0']) {
			expect(isRenderableChord({ ...CHORD, duration })).toBe(false);
		}
	});

	it('should still reject payloads that are not chord-shaped at all', () => {
		expect(isRenderableChord({ root: 60 })).toBe(false);
		expect(isRenderableChord(null)).toBe(false);
		expect(isRenderableChord('Cmaj7')).toBe(false);
	});
});

describe('Library drop rules', () => {
	describe('isPaletteReorderDrag', () => {
		it('should recognise a palette reorder', () => {
			expect(isPaletteReorderDrag(paletteReorderDrag())).toBe(true);
		});

		it('should not treat builder or canvas drags as reorders', () => {
			expect(isPaletteReorderDrag(builderDrag())).toBe(false);
			expect(isPaletteReorderDrag(canvasDrag())).toBe(false);
		});

		it('should tolerate a missing dataTransfer', () => {
			expect(isPaletteReorderDrag(null)).toBe(false);
			expect(isPaletteReorderDrag(undefined)).toBe(false);
		});
	});

	describe('resolveLibraryDrop', () => {
		it('should accept a chord dragged from the builder', () => {
			expect(resolveLibraryDrop(builderDrag())).toEqual({ status: 'accepted', chord: CHORD });
		});

		it('should accept a canvas chord as a copy even though it carries progression-chord', () => {
			expect(resolveLibraryDrop(canvasDrag())).toEqual({ status: 'accepted', chord: CHORD });
		});

		it('should leave palette reorders to the list', () => {
			expect(resolveLibraryDrop(paletteReorderDrag())).toEqual({ status: 'ignored' });
		});

		it('should reject a drag carrying no chord payload', () => {
			expect(resolveLibraryDrop(createDrag({ 'text/plain': 'hello' }))).toEqual({
				status: 'rejected'
			});
		});

		it('should reject malformed JSON', () => {
			expect(resolveLibraryDrop(createDrag({ 'application/json': '{ nope' }))).toEqual({
				status: 'rejected'
			});
		});

		it('should reject JSON that is not a chord', () => {
			expect(resolveLibraryDrop(builderDrag({ root: 60 }))).toEqual({ status: 'rejected' });
		});

		it('should reject a structurally complete chord the engine cannot render', () => {
			expect(resolveLibraryDrop(builderDrag({ ...CHORD, quality: 'bogus' }))).toEqual({
				status: 'rejected'
			});
			expect(resolveLibraryDrop(builderDrag({ ...CHORD, voicing: 'sideways' }))).toEqual({
				status: 'rejected'
			});
			expect(resolveLibraryDrop(builderDrag({ ...CHORD, root: 9999 }))).toEqual({
				status: 'rejected'
			});
		});

		it('should reject zero and syntactically valid unsupported durations at the drop boundary', () => {
			for (const duration of ['0m', '3m', '16n', '0:0:0', '2:0:0']) {
				expect(resolveLibraryDrop(builderDrag({ ...CHORD, duration }))).toEqual({
					status: 'rejected'
				});
			}
		});

		it('should reject a missing dataTransfer rather than hang the gesture', () => {
			expect(resolveLibraryDrop(null)).toEqual({ status: 'rejected' });
		});
	});

	describe('resolveLibraryDropEffect', () => {
		it('should move for a palette reorder', () => {
			expect(resolveLibraryDropEffect(paletteReorderDrag())).toBe('move');
		});

		it('should copy when the source allows copying', () => {
			expect(resolveLibraryDropEffect(builderDrag())).toBe('copy');
			expect(resolveLibraryDropEffect(canvasDrag('copyMove'))).toBe('copy');
			expect(resolveLibraryDropEffect(canvasDrag('all'))).toBe('copy');
		});

		it('should fall back to move when the source forbids copying', () => {
			// A canvas block that only allows 'move' would reject a 'copy' drop outright;
			// the handler still copies, so the gesture survives either way
			expect(resolveLibraryDropEffect(canvasDrag('move'))).toBe('move');
		});
	});
});

describe('Rail drag expansion', () => {
	it('should auto-open the palette when the rail is collapsed', () => {
		expect(resolveDragExpansion(null)).toEqual({ section: 'palette', autoOpened: true });
	});

	it('should switch a user-opened saved panel to the palette without marking it auto-opened', () => {
		expect(resolveDragExpansion('saved')).toEqual({ section: 'palette', autoOpened: false });
	});

	it('should do nothing when the palette is already showing', () => {
		expect(resolveDragExpansion('palette')).toBeNull();
	});
});

describe('needsLoadConfirmation', () => {
	it('should skip confirmation for an empty canvas', () => {
		expect(needsLoadConfirmation([])).toBe(false);
		expect(needsLoadConfirmation([null, null, null, null])).toBe(false);
	});

	it('should confirm once the canvas holds a chord', () => {
		expect(needsLoadConfirmation([null, CHORD, null])).toBe(true);
	});
});

describe('requestProgressionLoad', () => {
	const existing: Chord = { ...CHORD, root: 62, quality: 'm7' };

	/**
	 * Route a load request through the page's real handlers
	 * @param saved - Progression the user asked for
	 * @returns What the confirmation dialog was handed, if anything
	 */
	function routeLoad(saved: SavedProgression): SavedProgression | null {
		let awaitingConfirmation: SavedProgression | null = null;

		requestProgressionLoad(progressionState.progression, saved, {
			onLoad: (target) => loadProgressionToCanvas(target.progression),
			onConfirm: (target) => {
				awaitingConfirmation = target;
			}
		});

		return awaitingConfirmation;
	}

	beforeEach(() => {
		clearProgression();
	});

	it('should load onto an empty canvas without asking', () => {
		const saved = savedProgression();

		expect(routeLoad(saved)).toBeNull();
		expect(progressionState.progression[0]).toEqual(CHORD);
	});

	it('should load onto a canvas of empty slots without asking', () => {
		addChord(CHORD);
		progressionState.progression[0] = null;
		const saved = savedProgression();

		expect(routeLoad(saved)).toBeNull();
		expect(progressionState.progression[0]).toEqual(CHORD);
	});

	it('should ask before overwriting a canvas that holds chords', () => {
		addChord(existing);
		const saved = savedProgression();

		const pending = routeLoad(saved);

		expect(pending).toBe(saved);
		// Nothing moves until the user confirms
		expect(progressionState.progression[0]).toEqual(existing);
	});

	it('should load once the user confirms', () => {
		addChord(existing);
		const saved = savedProgression();
		const pending = routeLoad(saved);

		// What the dialog's confirm does
		loadProgressionToCanvas(pending!.progression);

		expect(progressionState.progression[0]).toEqual(CHORD);
	});

	it('should leave the canvas alone when the user cancels', () => {
		addChord(existing);

		routeLoad(savedProgression());
		// Cancelling simply drops the pending progression

		expect(progressionState.progression[0]).toEqual(existing);
	});
});
