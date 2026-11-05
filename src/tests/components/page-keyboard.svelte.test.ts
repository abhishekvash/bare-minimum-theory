/** End-to-end keyboard coverage through the real page listener and component focus seams. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import PageHarness from './PageHarness.svelte';
import type { Chord } from '$lib/utils/theory-engine';
import { QUALITY_GRADIENT } from '$lib/utils/theory-engine/constants';
import {
	addChord,
	clearBuilderState,
	clearProgression,
	progressionState,
	selectQuality,
	selectRoot,
	stageCandidate
} from '$lib/stores/progression.svelte';
import { auditionChord } from '$lib/utils/audition-controller';
import {
	openLibraryPanel,
	resetUIState,
	selectSlot,
	setTransportActive,
	uiState
} from '$lib/stores/ui.svelte';

import { stopLoopingPlayback } from '$lib/utils/audio-playback';

vi.mock('$lib/app-init', () => ({
	initializeApplication: vi.fn().mockResolvedValue(undefined)
}));

// Page tests act as a returning visitor; the tour has its own coverage
vi.mock('$lib/utils/onboarding-tour', () => ({
	shouldAutoStartTour: vi.fn(() => false),
	startTour: vi.fn()
}));

vi.mock('$lib/utils/audio-playback', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/utils/audio-playback')>()),
	stopLoopingPlayback: vi.fn(),
	disposeAudio: vi.fn()
}));

vi.mock('$lib/utils/audition-controller', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/utils/audition-controller')>()),
	auditionChord: vi.fn(() => 'played'),
	auditionNotes: vi.fn(() => 'played')
}));

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

async function renderPage(): Promise<void> {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(PageHarness, { target });
	flushSync();
	await tick();
}

async function press(key: string, eventTarget: EventTarget = document.activeElement ?? window) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
	eventTarget.dispatchEvent(event);
	flushSync();
	await tick();
	return event;
}

describe('page keyboard flow', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// The real stop is the only writer of the transport mirror; keep that contract
		vi.mocked(stopLoopingPlayback).mockImplementation(() => setTransportActive(false));
		clearProgression();
		clearBuilderState();
		resetUIState();
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
		clearProgression();
		clearBuilderState();
		resetUIState();
		Reflect.deleteProperty(window, 'matchMedia');
	});

	it('selects real slots, ignores unavailable digits, and returns focus on Escape', async () => {
		addChord(CHORD);
		await renderPage();

		await press('1', window);
		expect(uiState.selectedSlot).toBe(0);
		expect(document.activeElement).toBe(target.querySelector('[data-slot="chord-inspector"]'));

		await press('Escape');
		expect(uiState.selectedSlot).toBeNull();
		expect(document.activeElement).toBe(
			target.querySelector('[data-chord-index="0"] [data-slot-selection]')
		);

		await press('9', window);
		expect(uiState.selectedSlot).toBeNull();
		expect(document.activeElement).toBe(
			target.querySelector('[data-chord-index="0"] [data-slot-selection]')
		);
	});

	it('keeps an empty progression stopped when Space requests playback', async () => {
		await renderPage();

		await press(' ', window);
		await tick();

		expect(uiState.transportActive).toBe(false);
	});

	it('returns focus to the chord block when the inspector close control is used', async () => {
		addChord(CHORD);
		await renderPage();
		await press('1', window);

		target.querySelector<HTMLButtonElement>('[aria-label="Close inspector"]')?.click();
		flushSync();
		await tick();

		expect(uiState.selectedSlot).toBeNull();
		expect(document.activeElement).toBe(
			target.querySelector('[data-chord-index="0"] [data-slot-selection]')
		);
	});

	it('returns focus to an empty slot when the inspector close control is used', async () => {
		await renderPage();
		await press('1', window);
		expect(uiState.selectedSlot).toBe(0);

		target.querySelector<HTMLButtonElement>('[aria-label="Close inspector"]')?.click();
		flushSync();
		await tick();

		expect(uiState.selectedSlot).toBeNull();
		expect(document.activeElement).toBe(target.querySelector('[data-slot-index="0"]'));
	});

	it('returns focus to an empty slot when Escape closes the inspector', async () => {
		await renderPage();
		await press('1', window);
		expect(uiState.selectedSlot).toBe(0);

		await press('Escape', window);
		await tick();

		expect(uiState.selectedSlot).toBeNull();
		expect(document.activeElement).toBe(target.querySelector('[data-slot-index="0"]'));
	});

	it('walks audition, inspector, library, modal, and transport one Escape at a time', async () => {
		addChord(CHORD);
		selectSlot(0);
		setTransportActive(true);
		stageCandidate(0, { ...CHORD, quality: 'm9' });
		openLibraryPanel('palette');
		await renderPage();
		await press('?', window);

		expect(progressionState.audition).not.toBeNull();
		expect(uiState.selectedSlot).toBe(0);
		expect(uiState.libraryPanel.open).toBe('palette');
		expect(document.body.textContent).toContain('Help & Documentation');
		expect(uiState.transportActive).toBe(true);

		// The modal consumes Escape before the page-level surface stack.
		await press('Escape');
		expect(document.body.textContent).not.toContain('Help & Documentation');
		expect(progressionState.audition).not.toBeNull();

		await press('Escape');
		expect(progressionState.audition).toBeNull();
		expect(progressionState.progression[0]?.quality).toBe('maj7');
		expect(uiState.selectedSlot).toBe(0);

		await press('Escape');
		expect(uiState.selectedSlot).toBeNull();
		expect(uiState.libraryPanel.open).toBe('palette');

		await press('Escape');
		expect(uiState.libraryPanel.open).toBeNull();
		expect(uiState.transportActive).toBe(true);

		await press('Escape');
		expect(uiState.transportActive).toBe(false);
	});

	it('restores focus to the rail icon when Escape closes its panel', async () => {
		await renderPage();
		const palette = target.querySelector<HTMLButtonElement>('[data-library-section="palette"]');
		palette?.click();
		flushSync();
		await tick();

		const close = target.querySelector<HTMLButtonElement>('[aria-label="Close library"]');
		close?.focus();
		await press('Escape', close!);

		expect(uiState.libraryPanel.open).toBeNull();
		expect(document.activeElement).toBe(palette);
	});

	it('restores focus to the rail icon when the panel close button is used', async () => {
		await renderPage();
		const palette = target.querySelector<HTMLButtonElement>('[data-library-section="palette"]');
		palette?.click();
		flushSync();
		await tick();

		target.querySelector<HTMLButtonElement>('[aria-label="Close library"]')?.click();
		flushSync();
		await tick();

		expect(uiState.libraryPanel.open).toBeNull();
		expect(document.activeElement).toBe(palette);
	});

	it('closes a builder popover before stopping transport', async () => {
		setTransportActive(true);
		await renderPage();
		const scale = Array.from(target.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
			button.textContent?.includes('Key & Scale')
		);
		scale?.click();
		flushSync();
		await tick();

		expect(uiState.activePopover).toBe('scale');
		expect(document.body.textContent).toContain('Select key');

		await press('Escape');
		expect(uiState.activePopover).toBeNull();
		expect(document.body.textContent).not.toContain('Select key');
		expect(uiState.transportActive).toBe(true);
	});

	it('selects and chained-auditions an arrowed quality while stopped', async () => {
		addChord(CHORD);
		selectRoot(60);
		selectQuality('maj7');
		await renderPage();

		const startIndex = QUALITY_GRADIENT.indexOf('maj7');
		const nextQuality = QUALITY_GRADIENT[startIndex + 1];
		const start = target.querySelector<HTMLButtonElement>('[data-quality="maj7"]');
		start?.focus();
		await press('ArrowRight', start!);

		expect(progressionState.builderState.selectedQuality).toBe(nextQuality);
		expect(auditionChord).toHaveBeenLastCalledWith(
			expect.objectContaining({ root: 60, quality: nextQuality }),
			{ mode: 'click', targetSlot: 1 }
		);
	});

	it('browses qualities silently during playback and stages only on Enter', async () => {
		addChord(CHORD);
		selectSlot(0);
		setTransportActive(true);
		await renderPage();

		const startIndex = QUALITY_GRADIENT.indexOf('maj7');
		const nextQuality = QUALITY_GRADIENT[startIndex + 1];
		const start = target.querySelector<HTMLButtonElement>('[data-quality="maj7"]');
		start?.focus();
		await press('ArrowRight', start!);

		expect(uiState.browseQuality).toBe(nextQuality);
		expect(progressionState.builderState.selectedQuality).toBe('maj7');
		expect(progressionState.progression[0]?.quality).toBe('maj7');
		expect(document.activeElement).toBe(target.querySelector(`[data-quality="${nextQuality}"]`));

		await press('Enter');
		expect(progressionState.builderState.selectedQuality).toBe(nextQuality);
		expect(progressionState.progression[0]?.quality).toBe(nextQuality);
		expect(progressionState.audition?.baselineQuality).toBe('maj7');
	});

	it('ignores page shortcuts while the onboarding tour is running', async () => {
		addChord(CHORD);
		await renderPage();
		uiState.tourActive = true;

		await press('1', window);
		await press('?', window);
		await press(' ', window);

		expect(uiState.selectedSlot).toBeNull();
		expect(document.body.textContent).not.toContain('Help & Documentation');
		expect(uiState.transportActive).toBe(false);
	});

	it('documents the rewritten keyboard and audition contract', async () => {
		await renderPage();
		await press('?', window);

		expect(document.body.textContent).toContain('One layer closes per press');
		expect(document.body.textContent).toContain('1-9');
		expect(document.body.textContent).toContain('normal page order');
		expect(document.body.textContent).toContain('chained preview');
		expect(document.body.textContent).toContain('browse cursor');
	});
});
