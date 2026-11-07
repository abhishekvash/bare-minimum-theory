/**
 * Page-level coverage for the saved-progression load gate. These tests mount the real page,
 * click through LibraryRail and SavedProgressionItem, then answer the real confirmation dialog.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { settle } from '../helpers/settle';
import type { Chord } from '#lib/utils/theory-engine/types.ts';
import type { SavedProgression } from '#lib/utils/progression-persistence.ts';
import { addChord, clearProgression, progressionState } from '#lib/stores/progression.svelte.ts';
import { resetUIState } from '#lib/stores/ui.svelte.ts';
import PageHarness from './PageHarness.svelte';

const { mockStopLoopingPlayback } = vi.hoisted(() => ({
	mockStopLoopingPlayback: vi.fn()
}));

vi.mock('#lib/app-init.ts', () => ({
	initializeApplication: vi.fn().mockResolvedValue(undefined)
}));

// Page tests act as a returning visitor; the tour has its own coverage
vi.mock('#lib/utils/onboarding-tour.ts', () => ({
	shouldAutoStartTour: vi.fn(() => false),
	startTour: vi.fn()
}));

vi.mock('#lib/utils/audio-playback.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/utils/audio-playback.ts')>()),
	stopLoopingPlayback: mockStopLoopingPlayback,
	disposeAudio: vi.fn()
}));

const CHORD: Chord = {
	root: 60,
	quality: 'maj7',
	inversion: 0,
	voicing: 'close',
	octave: 0,
	duration: '1m'
};

const SAVED: SavedProgression = {
	id: 'saved-1',
	name: 'Test progression',
	tags: [],
	progression: [CHORD, null],
	createdAt: 0
};

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

async function renderPage(): Promise<void> {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(PageHarness, { target });
	flushSync();
	await tick();
}

function buttonByLabel(prefix: string): HTMLButtonElement {
	const button = document.body.querySelector<HTMLButtonElement>(`button[aria-label^="${prefix}"]`);
	if (!button) throw new Error(`button labelled ${prefix} was not rendered`);
	return button;
}

function buttonByText(text: string): HTMLButtonElement {
	const button = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find(
		(candidate) => candidate.textContent?.trim() === text
	);
	if (!button) throw new Error(`button named ${text} was not rendered`);
	return button;
}

async function openSavedAndRequestLoad(): Promise<void> {
	buttonByLabel('Saved').click();
	flushSync();
	buttonByLabel('Load to canvas').click();
	flushSync();
	await tick();
}

describe('page saved-progression load confirmation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearProgression();
		resetUIState();
		progressionState.savedProgressions.items = [SAVED];
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
		progressionState.savedProgressions.items = [];
		clearProgression();
		resetUIState();
		Reflect.deleteProperty(window, 'matchMedia');
	});

	it('loads immediately when the canvas is empty', async () => {
		await renderPage();
		await openSavedAndRequestLoad();

		expect(progressionState.progression[0]).toEqual(CHORD);
		expect(mockStopLoopingPlayback).toHaveBeenCalled();
		expect(document.body.querySelector('[role="alertdialog"], [role="dialog"]')).toBeNull();
	});

	it('waits for confirmation before replacing a non-empty canvas', async () => {
		const existing: Chord = { ...CHORD, root: 62, quality: 'm7' };
		addChord(existing);
		await renderPage();
		await openSavedAndRequestLoad();

		expect(progressionState.progression[0]).toEqual(existing);
		expect(document.body.textContent).toContain('Replace Current Progression?');

		buttonByText('Load Progression').click();
		flushSync();
		await tick();

		expect(progressionState.progression[0]).toEqual(CHORD);
		expect(mockStopLoopingPlayback).toHaveBeenCalled();
	});

	it('leaves the non-empty canvas unchanged when confirmation is cancelled', async () => {
		const existing: Chord = { ...CHORD, root: 62, quality: 'm7' };
		addChord(existing);
		await renderPage();
		await openSavedAndRequestLoad();

		buttonByText('Cancel').click();
		flushSync();
		await settle();

		expect(progressionState.progression[0]).toEqual(existing);
		expect(document.body.textContent).not.toContain('Replace Current Progression?');
	});
});
