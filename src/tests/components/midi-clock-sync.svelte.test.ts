/**
 * Clock sync status: a saved input that is no longer connected counts as no selection, so the
 * status line does not claim to be waiting on a device the picker does not show.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import MIDIClockSync from '$lib/components/midi/MIDIClockSync.svelte';

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

function render(selectedInputId: string | null): void {
	target = document.createElement('div');
	document.body.appendChild(target);
	component = mount(MIDIClockSync, {
		target,
		props: {
			inputs: [{ id: 'in-1', name: 'IAC Bus 1' }],
			selectedInputId,
			isEnabled: true,
			isReceivingClock: false,
			detectedBpm: null,
			onToggle: () => {},
			onInputChange: () => {},
			onRefresh: () => {}
		}
	});
	flushSync();
}

describe('MIDIClockSync status', () => {
	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target.remove();
	});

	it('waits for clock on a present input', () => {
		render('in-1');
		expect(target.textContent).toContain('Waiting for clock...');
		expect(target.textContent).toContain('IAC Bus 1');
	});

	it('treats a saved input that has gone away as no selection', () => {
		render('gone');
		expect(target.textContent).not.toContain('Waiting for clock...');
		expect(target.textContent).toContain('Select clock source');
	});

	it('prompts through the picker, not a status line, when nothing is selected', () => {
		render(null);
		expect(target.textContent).not.toContain('Waiting for clock...');
		expect(target.textContent).toContain('Select clock source');
	});
});
