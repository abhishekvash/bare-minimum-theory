/** The touch polyfill is optional: failing to load it must never stop the app from starting. */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('mobile-drag-drop', () => {
	throw new Error('chunk failed to load');
});

describe('hooks.client init', () => {
	afterEach(() => {
		Reflect.deleteProperty(window, 'ontouchstart');
		vi.restoreAllMocks();
	});

	it('resolves on a touch device even when the polyfill import fails', async () => {
		Object.defineProperty(window, 'ontouchstart', { configurable: true, value: null });
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { init } = await import('../../hooks.client.ts');

		await expect(init()).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledWith(
			'Touch drag-and-drop polyfill failed to load:',
			expect.any(Error)
		);
	});
});
