import { describe, it, expect, beforeEach } from 'vitest';
import {
	loadPreviewSettings,
	savePreviewSettings,
	DEFAULT_PREVIEW_OPTIONS
} from '#lib/utils/settings-persistence.ts';

describe('preview settings persistence', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('defaults to chained preview off and plain previews on', () => {
		expect(DEFAULT_PREVIEW_OPTIONS).toEqual({ chained: false, onSelect: true, onSweep: true });
		expect(loadPreviewSettings()).toEqual(DEFAULT_PREVIEW_OPTIONS);
	});

	it('round-trips saved options', () => {
		const options = { chained: true, onSelect: false, onSweep: false };
		savePreviewSettings(options);

		expect(loadPreviewSettings()).toEqual(options);
	});

	it('falls back per field for missing or non-boolean values', () => {
		localStorage.setItem('bmt_preview_settings', JSON.stringify({ chained: true, onSelect: 'no' }));

		expect(loadPreviewSettings()).toEqual({ chained: true, onSelect: true, onSweep: true });
	});

	it('returns defaults for corrupted data', () => {
		localStorage.setItem('bmt_preview_settings', 'not json {{');

		expect(loadPreviewSettings()).toEqual(DEFAULT_PREVIEW_OPTIONS);
	});
});
