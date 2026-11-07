/** Preferences save themselves once autosave starts, and not before. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import {
	startSettingsAutosave,
	stopSettingsAutosave
} from '#lib/stores/settings-autosave.svelte.ts';
import {
	initPianoSettings,
	initPreviewOptions,
	initRandomizeOptions,
	setPianoVisible,
	setPreviewOption,
	setRandomizeOption
} from '#lib/stores/settings.svelte.ts';
import {
	initMIDIClockSettings,
	initMIDISettings,
	setClockInputDevice,
	setClockSyncEnabled,
	setMIDIDevice,
	setMIDIVelocity
} from '#lib/stores/midi.svelte.ts';
import {
	DEFAULT_PREVIEW_OPTIONS,
	DEFAULT_RANDOMIZE_OPTIONS,
	loadPreviewSettings,
	loadRandomizeSettings
} from '#lib/utils/settings-persistence.ts';
import { loadPianoSettings } from '#lib/utils/piano-settings-persistence.ts';
import { DEFAULT_MIDI_SETTINGS, loadMIDISettings } from '#lib/utils/midi-settings-persistence.ts';
import {
	DEFAULT_MIDI_CLOCK_SETTINGS,
	loadMIDIClockSettings
} from '#lib/utils/midi-clock-persistence.ts';

describe('settings autosave', () => {
	beforeEach(() => {
		localStorage.clear();
		initPreviewOptions(DEFAULT_PREVIEW_OPTIONS);
		initRandomizeOptions(DEFAULT_RANDOMIZE_OPTIONS);
		initPianoSettings({ visible: false });
		initMIDISettings({ ...DEFAULT_MIDI_SETTINGS });
		initMIDIClockSettings({ ...DEFAULT_MIDI_CLOCK_SETTINGS });
	});

	afterEach(() => {
		stopSettingsAutosave();
	});

	it('saves nothing until started', () => {
		setPianoVisible(true);
		flushSync();
		expect(localStorage.length).toBe(0);
	});

	it('writes every preference once when started, then each change as it happens', () => {
		startSettingsAutosave();
		flushSync();
		expect(loadPianoSettings()).toEqual({ visible: false });

		setPreviewOption('chained', true);
		setRandomizeOption('octave', true);
		setPianoVisible(true);
		setMIDIDevice('out-1');
		setMIDIVelocity(64);
		setClockSyncEnabled(true);
		setClockInputDevice('in-1');
		flushSync();

		expect(loadPreviewSettings().chained).toBe(true);
		expect(loadRandomizeSettings().octave).toBe(true);
		expect(loadPianoSettings()).toEqual({ visible: true });
		expect(loadMIDISettings()).toMatchObject({ selectedDeviceId: 'out-1', velocity: 64 });
		expect(loadMIDIClockSettings()).toEqual({ enabled: true, selectedInputId: 'in-1' });
	});

	it('stops saving when stopped', () => {
		startSettingsAutosave();
		flushSync();
		stopSettingsAutosave();

		setPianoVisible(true);
		flushSync();
		expect(loadPianoSettings()).toEqual({ visible: false });
	});
});
