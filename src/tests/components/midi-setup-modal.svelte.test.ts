/**
 * Test-connection feedback in the MIDI Setup modal: each test gets its full two seconds of
 * feedback rather than being cut short by an earlier test's reset.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';

const output = vi.hoisted(() => ({ playChord: vi.fn() }));
vi.mock('$lib/utils/midi-output', () => output);
vi.mock('$lib/utils/midi-connection', () => ({
	markMIDISetupSeen: vi.fn(),
	refreshMIDIDevices: vi.fn(),
	switchMIDIOutput: vi.fn()
}));

import MIDISetupModal from '$lib/components/MIDISetupModal.svelte';
import { midiState } from '$lib/stores/midi.svelte';

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

function testButton(): HTMLButtonElement {
	const button = Array.from(document.querySelectorAll('button')).find((b) =>
		['Send Test Chord', 'Sent!', 'Sending...'].includes(b.textContent?.trim() ?? '')
	);
	if (!button) throw new Error('Test button not rendered');
	return button;
}

async function settle(): Promise<void> {
	await Promise.resolve();
	flushSync();
	await tick();
}

describe('MIDISetupModal test connection', () => {
	beforeEach(async () => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		midiState.outputs = [{ id: 'out-1', name: 'IAC Bus 1' }];
		midiState.selectedDeviceId = 'out-1';
		midiState.isConnected = true;
		target = document.createElement('div');
		document.body.appendChild(target);
		component = mount(MIDISetupModal, { target, props: { open: true } });
		flushSync();
		await tick();
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target.remove();
		vi.useRealTimers();
	});

	it('keeps a second test result for its full two seconds', async () => {
		testButton().click();
		await settle();
		expect(testButton().textContent?.trim()).toBe('Sent!');

		vi.advanceTimersByTime(1500);
		testButton().click();
		await settle();

		// The first test's reset would fire here
		vi.advanceTimersByTime(600);
		await settle();
		expect(testButton().textContent?.trim()).toBe('Sent!');

		// Still showing just before two seconds have passed since the second click
		vi.advanceTimersByTime(1300);
		await settle();
		expect(testButton().textContent?.trim()).toBe('Sent!');

		vi.advanceTimersByTime(100);
		await settle();
		expect(testButton().textContent?.trim()).toBe('Send Test Chord');
		expect(output.playChord).toHaveBeenCalledTimes(2);
	});
});
