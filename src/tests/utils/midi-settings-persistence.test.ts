import { describe, it, expect, beforeEach } from 'vitest';
import {
	loadMIDISettings,
	saveMIDISettings,
	updateMIDISetting,
	DEFAULT_MIDI_SETTINGS
} from '$lib/utils/midi-settings-persistence';

describe('midi-settings-persistence', () => {
	beforeEach(() => {
		// Clear localStorage before each test
		localStorage.clear();
	});

	describe('loadMIDISettings', () => {
		it('returns default settings when no saved settings exist', () => {
			const settings = loadMIDISettings();
			expect(settings).toEqual(DEFAULT_MIDI_SETTINGS);
		});

		it('loads and returns saved settings', () => {
			const savedSettings = {
				enabled: true,
				selectedDeviceId: 'test-device-123',
				hasSeenSetupModal: true,
				midiChannel: 5,
				velocity: 80,
				strumEnabled: false
			};
			localStorage.setItem('bmt_midi_settings', JSON.stringify(savedSettings));

			const settings = loadMIDISettings();
			expect(settings).toEqual(savedSettings);
		});

		it('handles corrupted localStorage data gracefully', () => {
			localStorage.setItem('bmt_midi_settings', 'not valid json {{{');

			const settings = loadMIDISettings();
			expect(settings).toEqual(DEFAULT_MIDI_SETTINGS);
		});

		it('returns defaults for missing fields in saved settings', () => {
			localStorage.setItem('bmt_midi_settings', JSON.stringify({ enabled: true }));

			const settings = loadMIDISettings();
			expect(settings.enabled).toBe(true);
			expect(settings.selectedDeviceId).toBe(DEFAULT_MIDI_SETTINGS.selectedDeviceId);
			expect(settings.hasSeenSetupModal).toBe(DEFAULT_MIDI_SETTINGS.hasSeenSetupModal);
			expect(settings.midiChannel).toBe(DEFAULT_MIDI_SETTINGS.midiChannel);
			expect(settings.velocity).toBe(DEFAULT_MIDI_SETTINGS.velocity);
		});

		it('validates midiChannel is within range 1-16', () => {
			localStorage.setItem('bmt_midi_settings', JSON.stringify({ midiChannel: 20 }));
			expect(loadMIDISettings().midiChannel).toBe(DEFAULT_MIDI_SETTINGS.midiChannel);

			localStorage.setItem('bmt_midi_settings', JSON.stringify({ midiChannel: 0 }));
			expect(loadMIDISettings().midiChannel).toBe(DEFAULT_MIDI_SETTINGS.midiChannel);

			localStorage.setItem('bmt_midi_settings', JSON.stringify({ midiChannel: 16 }));
			expect(loadMIDISettings().midiChannel).toBe(16);
		});

		it('validates velocity is within range 0-127', () => {
			localStorage.setItem('bmt_midi_settings', JSON.stringify({ velocity: 200 }));
			expect(loadMIDISettings().velocity).toBe(DEFAULT_MIDI_SETTINGS.velocity);

			localStorage.setItem('bmt_midi_settings', JSON.stringify({ velocity: -10 }));
			expect(loadMIDISettings().velocity).toBe(DEFAULT_MIDI_SETTINGS.velocity);

			localStorage.setItem('bmt_midi_settings', JSON.stringify({ velocity: 127 }));
			expect(loadMIDISettings().velocity).toBe(127);
		});

		it('validates boolean fields', () => {
			localStorage.setItem('bmt_midi_settings', JSON.stringify({ enabled: 'yes' }));
			expect(loadMIDISettings().enabled).toBe(DEFAULT_MIDI_SETTINGS.enabled);

			localStorage.setItem('bmt_midi_settings', JSON.stringify({ enabled: true }));
			expect(loadMIDISettings().enabled).toBe(true);
		});
	});

	describe('saveMIDISettings', () => {
		it('saves settings to localStorage', () => {
			const settings = {
				enabled: true,
				selectedDeviceId: 'my-device',
				hasSeenSetupModal: true,
				midiChannel: 10,
				velocity: 90,
				strumEnabled: false
			};

			saveMIDISettings(settings);

			const stored = localStorage.getItem('bmt_midi_settings');
			expect(stored).not.toBeNull();
			expect(JSON.parse(stored as string)).toEqual(settings);
		});
	});

	describe('updateMIDISetting', () => {
		it('updates a single setting and persists', () => {
			// Start with defaults
			saveMIDISettings(DEFAULT_MIDI_SETTINGS);

			updateMIDISetting('enabled', true);

			const settings = loadMIDISettings();
			expect(settings.enabled).toBe(true);
			expect(settings.velocity).toBe(DEFAULT_MIDI_SETTINGS.velocity);
		});

		it('preserves other settings when updating one', () => {
			const initial = {
				enabled: true,
				selectedDeviceId: 'device-1',
				hasSeenSetupModal: true,
				midiChannel: 5,
				velocity: 100,
				strumEnabled: true
			};
			saveMIDISettings(initial);

			updateMIDISetting('velocity', 50);

			const settings = loadMIDISettings();
			expect(settings.velocity).toBe(50);
			expect(settings.enabled).toBe(true);
			expect(settings.selectedDeviceId).toBe('device-1');
			expect(settings.midiChannel).toBe(5);
			expect(settings.strumEnabled).toBe(true);
		});
	});

	describe('DEFAULT_MIDI_SETTINGS', () => {
		it('has expected default values', () => {
			expect(DEFAULT_MIDI_SETTINGS).toEqual({
				enabled: false,
				selectedDeviceId: null,
				hasSeenSetupModal: false,
				midiChannel: 1,
				velocity: 100,
				strumEnabled: true
			});
		});
	});
});
