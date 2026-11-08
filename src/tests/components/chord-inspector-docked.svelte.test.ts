/** Mounted inspector: a placeholder until a chord is selected, then that chord's controls. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import ChordInspectorHarness from './ChordInspectorHarness.svelte';
import type { Chord } from '#lib/utils/theory-engine/index.ts';
import {
	addChord,
	addSlot,
	clearProgression,
	progressionState,
	selectQuality
} from '#lib/stores/progression.svelte.ts';
import {
	deselectSlot,
	resetUIState,
	selectSlot,
	setTransportActive
} from '#lib/stores/ui.svelte.ts';

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

function chord(root: number, quality: Chord['quality'] = 'maj7'): Chord {
	return { root, quality, inversion: 0, voicing: 'close', octave: 0, duration: '1m' };
}

function render(): void {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(ChordInspectorHarness, { target });
	flushSync();
}

const inspector = () => target.querySelector('[data-slot="chord-inspector"]');
const placeholder = () => target.querySelector('[data-slot="chord-inspector-placeholder"]');

describe('ChordInspector placeholder', () => {
	beforeEach(() => {
		clearProgression();
		resetUIState();
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
	});

	it('shows an add-then-select placeholder on an empty progression', () => {
		render();

		expect(inspector()).toBeNull();
		expect(placeholder()?.textContent).toContain('No chord selected');
		expect(placeholder()?.textContent).toContain('Add a chord to the progression');
	});

	it('shows a select placeholder when chords exist but none is selected', () => {
		addChord(chord(60));
		render();

		expect(inspector()).toBeNull();
		expect(placeholder()?.textContent).toContain('Select a chord in the progression');
	});

	it('disables Remove slot at the minimum slot count and enables it above', () => {
		addChord(chord(60));
		selectSlot(0);
		render();
		const removeButton = () =>
			[...target.querySelectorAll('button')].find((button) =>
				button.textContent?.includes('Remove slot')
			);

		expect(removeButton()?.disabled).toBe(true);

		addSlot();
		flushSync();
		expect(removeButton()?.disabled).toBe(false);
	});

	it('swaps to the selected chord and back to the placeholder on deselect', () => {
		addChord(chord(60));
		addChord(chord(67, '7'));
		render();

		selectSlot(1);
		flushSync();
		expect(placeholder()).toBeNull();
		expect(inspector()?.textContent).toContain('Slot 2');
		expect(inspector()?.textContent).toContain('G7');

		deselectSlot();
		flushSync();
		expect(inspector()).toBeNull();
		expect(placeholder()).not.toBeNull();
	});

	it('offers Replace only once the builder holds different harmony, while stopped', () => {
		addChord({ ...chord(60), voicing: 'drop2' });
		selectSlot(0);
		render();
		const replace = () => target.querySelector<HTMLButtonElement>('[data-inspector-replace]');

		// Selecting syncs the builder to the slot, so there is nothing to replace yet
		expect(replace()).toBeNull();

		selectQuality('m7');
		flushSync();
		expect(replace()?.textContent).toContain('Replace with Cm7');

		setTransportActive(true);
		flushSync();
		expect(replace()).toBeNull();

		setTransportActive(false);
		flushSync();
		replace()?.click();
		flushSync();
		expect(progressionState.progression[0]).toMatchObject({ quality: 'm7', voicing: 'drop2' });
		expect(replace()).toBeNull();
	});

	it('labels the inversion and voicing selects with their captions', () => {
		addChord(chord(60));
		selectSlot(0);
		render();

		const triggers = target.querySelectorAll<HTMLElement>('[data-slot="select-trigger"]');
		expect(triggers).toHaveLength(2);
		const names = [...triggers].map((trigger) =>
			(trigger.getAttribute('aria-labelledby') ?? '')
				.split(' ')
				.map((id) => document.getElementById(id)?.textContent?.trim())
				.join(' ')
		);
		expect(names).toEqual(['Inversion Root', 'Voicing Close']);
	});
});

describe('ChordInspector focus after destructive actions', () => {
	let slots: HTMLElement[] = [];

	/** Stand-ins for the canvas slots the inspector hands focus back to */
	function addSlotTargets(count: number): void {
		slots = Array.from({ length: count }, (_, i) => {
			const el = document.createElement('div');
			el.dataset.slotIndex = String(i);
			el.tabIndex = -1;
			document.body.appendChild(el);
			return el;
		});
	}

	function clickAction(label: string): void {
		const button = [...target.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
			b.textContent?.includes(label)
		);
		if (!button) throw new Error(`No ${label} button`);
		button.focus();
		button.click();
		flushSync();
	}

	beforeEach(() => {
		clearProgression();
		resetUIState();
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target?.remove();
		slots.forEach((el) => el.remove());
		slots = [];
	});

	it('moves focus to the emptied slot after Delete chord', async () => {
		addChord(chord(60));
		addChord(chord(67, '7'));
		addSlotTargets(2);
		selectSlot(1);
		render();

		clickAction('Delete chord');
		await tick();

		expect(placeholder()).not.toBeNull();
		expect(document.activeElement).toBe(slots[1]);
	});

	it('moves focus to the slot that moved into place after Remove slot', async () => {
		addChord(chord(60));
		addChord(chord(67, '7'));
		// Four slots is the minimum, so add a fifth to make Remove slot available
		addSlot();
		addSlotTargets(5);
		selectSlot(1);
		render();

		clickAction('Remove slot');
		await tick();

		expect(progressionState.progression).toHaveLength(4);
		expect(document.activeElement).toBe(slots[1]);
	});

	it('moves focus to the new last slot after removing the last slot', async () => {
		addChord(chord(60));
		// Four slots is the minimum, so add a fifth to make Remove slot available
		addSlot();
		addSlotTargets(5);
		selectSlot(4);
		render();

		clickAction('Remove slot');
		await tick();

		expect(progressionState.progression).toHaveLength(4);
		expect(document.activeElement).toBe(slots[3]);
	});
});
