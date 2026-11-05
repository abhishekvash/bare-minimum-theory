import { describe, it, expect, beforeEach } from 'vitest';
import { loadLocalSetting, saveLocalSetting } from '$lib/utils/local-setting';
import {
	DEFAULT_MIDI_SETTINGS,
	loadMIDISettings,
	updateMIDISetting
} from '$lib/utils/midi-settings-persistence';
import {
	DEFAULT_MIDI_CLOCK_SETTINGS,
	loadMIDIClockSettings,
	updateMIDIClockSetting
} from '$lib/utils/midi-clock-persistence';

type Setting = { on: boolean };
const DEFAULTS: Setting = { on: false };
const normalize = (stored: Record<string, unknown>, defaults: Setting): Setting => ({
	on: typeof stored.on === 'boolean' ? stored.on : defaults.on
});

describe('loadLocalSetting', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('returns a copy of the defaults, never the defaults object itself', () => {
		const loaded = loadLocalSetting('k', DEFAULTS, normalize);
		expect(loaded).toEqual(DEFAULTS);
		expect(loaded).not.toBe(DEFAULTS);
	});

	it('returns a copy of the defaults for corrupt and non-object data', () => {
		for (const raw of ['{{', 'null', '42', '"x"']) {
			localStorage.setItem('k', raw);
			const loaded = loadLocalSetting('k', DEFAULTS, normalize);
			expect(loaded).toEqual(DEFAULTS);
			expect(loaded).not.toBe(DEFAULTS);
		}
	});

	it('round-trips through saveLocalSetting', () => {
		saveLocalSetting('k', { on: true });
		expect(loadLocalSetting('k', DEFAULTS, normalize)).toEqual({ on: true });
	});
});

describe('updating a setting before anything is stored', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('leaves DEFAULT_MIDI_SETTINGS untouched', () => {
		const before = { ...DEFAULT_MIDI_SETTINGS };
		updateMIDISetting('velocity', 42);

		expect(DEFAULT_MIDI_SETTINGS).toEqual(before);
		expect(loadMIDISettings().velocity).toBe(42);
	});

	it('leaves DEFAULT_MIDI_CLOCK_SETTINGS untouched', () => {
		const before = { ...DEFAULT_MIDI_CLOCK_SETTINGS };
		updateMIDIClockSetting('enabled', true);

		expect(DEFAULT_MIDI_CLOCK_SETTINGS).toEqual(before);
		expect(loadMIDIClockSettings().enabled).toBe(true);
	});
});
