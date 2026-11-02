/** Mounted ReadyBar coverage: visibility, action copy and the builder drag payload. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import ReadyBar from '$lib/components/ReadyBar.svelte';
import type { Chord } from '$lib/utils/theory-engine';
import {
	MAX_PROGRESSION_SLOTS,
	addChord,
	clearBuilderState,
	clearProgression,
	progressionState,
	selectQuality,
	selectRoot,
	stageCandidate
} from '$lib/stores/progression.svelte';
import { resetUIState, selectSlot, setTransportActive } from '$lib/stores/ui.svelte';

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

function chord(root = 60, quality: Chord['quality'] = 'maj7'): Chord {
	return { root, quality, inversion: 0, voicing: 'close', octave: 0, duration: '1m' };
}

function renderReadyBar(): void {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(ReadyBar, { target });
	flushSync();
}

function ready(root = 60, quality: Chord['quality'] = 'maj7'): void {
	selectRoot(root);
	selectQuality(quality);
	flushSync();
}

function actionButton(): HTMLButtonElement | null {
	return target.querySelector<HTMLButtonElement>('[data-ready-bar] button');
}

describe('ReadyBar', () => {
	beforeEach(() => {
		clearProgression();
		clearBuilderState();
		resetUIState();
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
	});

	it('should render only for a complete chord', () => {
		renderReadyBar();
		expect(target.querySelector('[data-ready-bar]')).toBeNull();

		selectRoot(60);
		flushSync();
		expect(target.querySelector('[data-ready-bar]')).toBeNull();

		selectQuality('maj7');
		flushSync();
		expect(target.querySelector('[data-ready-bar]')?.textContent).toContain('Cmaj7');
	});

	it('should expose Add, Replace and pending Commit in their contexts', () => {
		ready();
		renderReadyBar();
		expect(actionButton()?.textContent).toContain('+ Add to progression');

		addChord(chord());
		selectSlot(0);
		flushSync();
		expect(actionButton()?.textContent).toContain('Replace');

		setTransportActive(true);
		flushSync();
		expect(actionButton()).toBeNull();

		stageCandidate(0, chord(60, 'm9'));
		flushSync();
		expect(actionButton()?.textContent).toContain('Commit');
	});

	it('should show the full hint and disable Add at sixteen occupied slots', () => {
		progressionState.progression = Array.from({ length: MAX_PROGRESSION_SLOTS }, (_, index) =>
			chord(60 + index)
		);
		ready();
		renderReadyBar();

		expect(actionButton()?.disabled).toBe(true);
		expect(target.textContent).toContain('Progression is full');
	});

	it('should carry the same application/json chord payload as a quality button', () => {
		ready(62, 'm7');
		renderReadyBar();
		const payloads: Record<string, string> = {};
		const dataTransfer = {
			effectAllowed: 'none',
			setData: (format: string, value: string) => (payloads[format] = value)
		};
		const event = new Event('dragstart', { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });

		target.querySelector<HTMLElement>('[draggable="true"]')?.dispatchEvent(event);

		expect(dataTransfer.effectAllowed).toBe('copy');
		expect(JSON.parse(payloads['application/json'])).toEqual(chord(62, 'm7'));
	});
});
