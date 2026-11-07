import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadLocalSetting, saveLocalSetting } from '#lib/utils/local-setting.ts';

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
	it('warns instead of throwing when storage rejects the write', () => {
		const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('Quota exceeded', 'QuotaExceededError');
		});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		try {
			expect(() => saveLocalSetting('k', { on: true })).not.toThrow();
			expect(warn).toHaveBeenCalledOnce();
		} finally {
			setItem.mockRestore();
			warn.mockRestore();
		}
	});
});
