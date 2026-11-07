/**
 * Turning MIDI output off while the loop plays: a loop routed to MIDI must stop with it, since it
 * would keep sending to the still-selected port, while a loop on the internal synth plays on.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';

const output = vi.hoisted(() => ({
	isMIDILoopPlaying: vi.fn(() => false),
	onStateChange: vi.fn(() => () => {})
}));
const transport = vi.hoisted(() => ({ stopProgressionPlayback: vi.fn() }));

vi.mock('#lib/utils/midi-output.ts', () => output);
vi.mock('#lib/stores/transport.svelte.ts', () => transport);
vi.mock('#lib/utils/midi-connection.ts', () => ({
	ensureMIDIAccess: vi.fn(async () => true),
	persistMIDISettings: vi.fn(),
	reconcileSelectedOutput: vi.fn()
}));

import MIDIOutputToggleHarness from './MIDIOutputToggleHarness.svelte';
import { midiState } from '#lib/stores/midi.svelte.ts';

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

function toggle(): HTMLButtonElement {
	const button = target.querySelector<HTMLButtonElement>('button[data-midi-state]');
	if (!button) throw new Error('MIDI toggle was not rendered');
	return button;
}

describe('MIDIOutputToggle', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		midiState.isSupported = true;
		midiState.enabled = true;
		midiState.isConnected = true;
		target = document.createElement('div');
		document.body.appendChild(target);
		component = mount(MIDIOutputToggleHarness, { target });
		flushSync();
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target.remove();
	});

	it('stops a loop playing through MIDI when MIDI is turned off', async () => {
		output.isMIDILoopPlaying.mockReturnValue(true);

		toggle().click();
		await Promise.resolve();
		flushSync();

		expect(transport.stopProgressionPlayback).toHaveBeenCalledTimes(1);
		expect(midiState.enabled).toBe(false);
		expect(midiState.isConnected).toBe(false);
	});

	it('leaves a loop on the internal synth playing when MIDI is turned off', async () => {
		output.isMIDILoopPlaying.mockReturnValue(false);

		toggle().click();
		await Promise.resolve();
		flushSync();

		expect(transport.stopProgressionPlayback).not.toHaveBeenCalled();
		expect(midiState.enabled).toBe(false);
	});
});
