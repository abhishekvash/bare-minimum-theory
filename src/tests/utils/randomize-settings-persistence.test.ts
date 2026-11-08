import { describe, it, expect, beforeEach } from 'vitest';
import {
	loadRandomizeSettings,
	saveRandomizeSettings,
	DEFAULT_RANDOMIZE_OPTIONS
} from '#lib/utils/settings-persistence.ts';

describe('randomize settings persistence', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('returns the defaults when nothing is stored', () => {
		expect(loadRandomizeSettings()).toEqual(DEFAULT_RANDOMIZE_OPTIONS);
	});

	it('round-trips saved options', () => {
		const options = { inversion: false, voicing: false, octave: true, quality: true };
		saveRandomizeSettings(options);

		expect(loadRandomizeSettings()).toEqual(options);
	});

	it('falls back per field for missing or non-boolean values', () => {
		localStorage.setItem('bmt_randomize_settings', JSON.stringify({ octave: true, voicing: 1 }));

		expect(loadRandomizeSettings()).toEqual({ ...DEFAULT_RANDOMIZE_OPTIONS, octave: true });
	});

	it('returns the defaults for corrupted or non-object data', () => {
		localStorage.setItem('bmt_randomize_settings', 'not json {{');
		expect(loadRandomizeSettings()).toEqual(DEFAULT_RANDOMIZE_OPTIONS);

		localStorage.setItem('bmt_randomize_settings', 'null');
		expect(loadRandomizeSettings()).toEqual(DEFAULT_RANDOMIZE_OPTIONS);
	});
});
