/**
 * Turning on DAW clock sync in Settings must obtain MIDI access first: output may never have been
 * enabled, in which case there is no access and the input list would stay empty.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';

const connection = vi.hoisted(() => ({
	ensureMIDIAccess: vi.fn(async () => true),
	persistMIDISettings: vi.fn(),
	refreshMIDIDevices: vi.fn(),
	startClockSync: vi.fn()
}));
const clockPersistence = vi.hoisted(() => ({ saveMIDIClockSettings: vi.fn() }));
const sonner = vi.hoisted(() => ({ toast: { error: vi.fn() } }));

vi.mock('#lib/utils/midi-connection.ts', () => connection);
vi.mock('#lib/utils/midi-clock-persistence.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/utils/midi-clock-persistence.ts')>()),
	...clockPersistence
}));
vi.mock('svelte-sonner', () => sonner);
vi.mock('#lib/utils/midi-output.ts', () => ({
	getMIDIAccess: vi.fn(() => null),
	getMIDIInputs: vi.fn(() => [])
}));
vi.mock('#lib/utils/midi-clock.ts', () => ({ initMIDIClock: vi.fn() }));
vi.mock('#lib/utils/midi-clock-listener.ts', () => ({ teardownClockListener: vi.fn() }));

import MIDISettingsSection from '#lib/components/settings/MIDISettingsSection.svelte';
import { midiState } from '#lib/stores/midi.svelte.ts';

let target: HTMLElement;
let component: Record<string, unknown> | null = null;

function enableButton(): HTMLButtonElement {
	const button = Array.from(target.querySelectorAll('button')).find(
		(b) => b.textContent?.trim() === 'Enable'
	);
	if (!button) throw new Error('Clock sync Enable button not rendered');
	return button;
}

async function settle(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
	flushSync();
	await tick();
}

describe('MIDISettingsSection clock sync toggle', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		midiState.isSupported = true;
		midiState.clockSync.enabled = false;
		midiState.clockSync.selectedInputId = null;
		target = document.createElement('div');
		document.body.appendChild(target);
		component = mount(MIDISettingsSection, { target });
		flushSync();
	});

	afterEach(() => {
		if (component) unmount(component);
		component = null;
		target.remove();
	});

	it('requests MIDI access and refreshes inputs before enabling', async () => {
		enableButton().click();
		await settle();

		expect(connection.ensureMIDIAccess).toHaveBeenCalledTimes(1);
		expect(connection.refreshMIDIDevices).toHaveBeenCalledWith({ inputs: true });
		expect(midiState.clockSync.enabled).toBe(true);
		expect(clockPersistence.saveMIDIClockSettings).toHaveBeenCalledWith({
			enabled: true,
			selectedInputId: null
		});
	});

	it('ignores further toggles while the access request is pending', async () => {
		let grant!: (granted: boolean) => void;
		connection.ensureMIDIAccess.mockImplementationOnce(
			() => new Promise<boolean>((resolve) => (grant = resolve))
		);

		const button = enableButton();
		button.click();
		flushSync();
		expect(button.disabled).toBe(true);

		// A second click (e.g. a double-click on the permission prompt) must not start another request
		button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await settle();
		expect(connection.ensureMIDIAccess).toHaveBeenCalledTimes(1);

		// Nothing is enabled or saved until the browser answers
		expect(midiState.clockSync.enabled).toBe(false);
		expect(clockPersistence.saveMIDIClockSettings).not.toHaveBeenCalled();
		expect(connection.startClockSync).not.toHaveBeenCalled();

		grant(true);
		await settle();
		expect(midiState.clockSync.enabled).toBe(true);
		expect(button.disabled).toBe(false);
	});

	it('stays off and is not persisted when MIDI access is denied', async () => {
		connection.ensureMIDIAccess.mockResolvedValueOnce(false);

		enableButton().click();
		await settle();

		expect(midiState.clockSync.enabled).toBe(false);
		expect(clockPersistence.saveMIDIClockSettings).not.toHaveBeenCalled();
		expect(connection.startClockSync).not.toHaveBeenCalled();
		expect(sonner.toast.error).toHaveBeenCalledTimes(1);
	});
});
