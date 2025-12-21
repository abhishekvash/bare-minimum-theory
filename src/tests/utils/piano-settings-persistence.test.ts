import { describe, it, expect, beforeEach } from 'vitest';
import {
	loadPianoSettings,
	savePianoSettings,
	updatePianoVisibility,
	DEFAULT_PIANO_SETTINGS
} from '$lib/utils/piano-settings-persistence';

describe('piano-settings-persistence', () => {
	beforeEach(() => {
		// Clear localStorage before each test
		localStorage.clear();
	});

	describe('loadPianoSettings', () => {
		it('returns default settings when no saved settings exist', () => {
			const settings = loadPianoSettings();
			expect(settings).toEqual(DEFAULT_PIANO_SETTINGS);
		});

		it('loads and returns saved settings', () => {
			const savedSettings = {
				visible: true
			};
			localStorage.setItem('bmt_piano_settings', JSON.stringify(savedSettings));

			const settings = loadPianoSettings();
			expect(settings).toEqual(savedSettings);
		});

		it('handles corrupted localStorage data gracefully', () => {
			localStorage.setItem('bmt_piano_settings', 'not valid json {{{');

			const settings = loadPianoSettings();
			expect(settings).toEqual(DEFAULT_PIANO_SETTINGS);
		});

		it('returns defaults for missing fields in saved settings', () => {
			localStorage.setItem('bmt_piano_settings', JSON.stringify({}));

			const settings = loadPianoSettings();
			expect(settings.visible).toBe(DEFAULT_PIANO_SETTINGS.visible);
		});

		it('validates boolean field', () => {
			localStorage.setItem('bmt_piano_settings', JSON.stringify({ visible: 'yes' }));
			expect(loadPianoSettings().visible).toBe(DEFAULT_PIANO_SETTINGS.visible);

			localStorage.setItem('bmt_piano_settings', JSON.stringify({ visible: 1 }));
			expect(loadPianoSettings().visible).toBe(DEFAULT_PIANO_SETTINGS.visible);

			localStorage.setItem('bmt_piano_settings', JSON.stringify({ visible: true }));
			expect(loadPianoSettings().visible).toBe(true);

			localStorage.setItem('bmt_piano_settings', JSON.stringify({ visible: false }));
			expect(loadPianoSettings().visible).toBe(false);
		});
	});

	describe('savePianoSettings', () => {
		it('saves settings to localStorage', () => {
			const settings = {
				visible: true
			};

			savePianoSettings(settings);

			const stored = localStorage.getItem('bmt_piano_settings');
			expect(stored).not.toBeNull();
			expect(JSON.parse(stored as string)).toEqual(settings);
		});
	});

	describe('updatePianoVisibility', () => {
		it('updates visibility to true and persists', () => {
			updatePianoVisibility(true);

			const settings = loadPianoSettings();
			expect(settings.visible).toBe(true);
		});

		it('updates visibility to false and persists', () => {
			// Start with visible
			savePianoSettings({ visible: true });

			updatePianoVisibility(false);

			const settings = loadPianoSettings();
			expect(settings.visible).toBe(false);
		});
	});

	describe('DEFAULT_PIANO_SETTINGS', () => {
		it('has expected default values (collapsed by default)', () => {
			expect(DEFAULT_PIANO_SETTINGS).toEqual({
				visible: false
			});
		});
	});
});
