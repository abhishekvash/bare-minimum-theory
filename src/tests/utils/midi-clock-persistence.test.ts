import { describe, it, expect, beforeEach } from 'vitest';
import {
	loadMIDIClockSettings,
	saveMIDIClockSettings,
	updateMIDIClockSetting,
	DEFAULT_MIDI_CLOCK_SETTINGS
} from '$lib/utils/midi-clock-persistence';

describe('midi-clock-persistence', () => {
	beforeEach(() => {
		// Clear localStorage before each test
		localStorage.clear();
	});

	describe('loadMIDIClockSettings', () => {
		it('returns default settings when no saved settings exist', () => {
			const settings = loadMIDIClockSettings();
			expect(settings).toEqual(DEFAULT_MIDI_CLOCK_SETTINGS);
		});

		it('loads and returns saved settings', () => {
			const savedSettings = {
				enabled: true,
				selectedInputId: 'test-input-123'
			};
			localStorage.setItem('bmt_midi_clock_settings', JSON.stringify(savedSettings));

			const settings = loadMIDIClockSettings();
			expect(settings).toEqual(savedSettings);
		});

		it('handles corrupted localStorage data gracefully', () => {
			localStorage.setItem('bmt_midi_clock_settings', 'not valid json {{{');

			const settings = loadMIDIClockSettings();
			expect(settings).toEqual(DEFAULT_MIDI_CLOCK_SETTINGS);
		});

		it('returns defaults for missing fields in saved settings', () => {
			localStorage.setItem('bmt_midi_clock_settings', JSON.stringify({ enabled: true }));

			const settings = loadMIDIClockSettings();
			expect(settings.enabled).toBe(true);
			expect(settings.selectedInputId).toBe(DEFAULT_MIDI_CLOCK_SETTINGS.selectedInputId);
		});

		it('validates boolean fields', () => {
			localStorage.setItem('bmt_midi_clock_settings', JSON.stringify({ enabled: 'yes' }));
			expect(loadMIDIClockSettings().enabled).toBe(DEFAULT_MIDI_CLOCK_SETTINGS.enabled);

			localStorage.setItem('bmt_midi_clock_settings', JSON.stringify({ enabled: true }));
			expect(loadMIDIClockSettings().enabled).toBe(true);
		});

		it('validates selectedInputId is string or null', () => {
			localStorage.setItem('bmt_midi_clock_settings', JSON.stringify({ selectedInputId: 123 }));
			expect(loadMIDIClockSettings().selectedInputId).toBe(
				DEFAULT_MIDI_CLOCK_SETTINGS.selectedInputId
			);

			localStorage.setItem(
				'bmt_midi_clock_settings',
				JSON.stringify({ selectedInputId: 'my-input' })
			);
			expect(loadMIDIClockSettings().selectedInputId).toBe('my-input');

			localStorage.setItem('bmt_midi_clock_settings', JSON.stringify({ selectedInputId: null }));
			expect(loadMIDIClockSettings().selectedInputId).toBeNull();
		});
	});

	describe('saveMIDIClockSettings', () => {
		it('saves settings to localStorage', () => {
			const settings = {
				enabled: true,
				selectedInputId: 'my-input-device'
			};

			saveMIDIClockSettings(settings);

			const stored = localStorage.getItem('bmt_midi_clock_settings');
			expect(stored).not.toBeNull();
			expect(JSON.parse(stored as string)).toEqual(settings);
		});

		it('can save null selectedInputId', () => {
			const settings = {
				enabled: false,
				selectedInputId: null
			};

			saveMIDIClockSettings(settings);

			const loaded = loadMIDIClockSettings();
			expect(loaded.selectedInputId).toBeNull();
		});
	});

	describe('updateMIDIClockSetting', () => {
		it('updates a single setting and persists', () => {
			// Start with defaults
			saveMIDIClockSettings(DEFAULT_MIDI_CLOCK_SETTINGS);

			updateMIDIClockSetting('enabled', true);

			const settings = loadMIDIClockSettings();
			expect(settings.enabled).toBe(true);
			expect(settings.selectedInputId).toBe(DEFAULT_MIDI_CLOCK_SETTINGS.selectedInputId);
		});

		it('preserves other settings when updating one', () => {
			const initial = {
				enabled: true,
				selectedInputId: 'input-1'
			};
			saveMIDIClockSettings(initial);

			updateMIDIClockSetting('selectedInputId', 'input-2');

			const settings = loadMIDIClockSettings();
			expect(settings.selectedInputId).toBe('input-2');
			expect(settings.enabled).toBe(true);
		});
	});

	describe('DEFAULT_MIDI_CLOCK_SETTINGS', () => {
		it('has expected default values (opt-in, disabled by default)', () => {
			expect(DEFAULT_MIDI_CLOCK_SETTINGS).toEqual({
				enabled: false,
				selectedInputId: null
			});
		});
	});
});
