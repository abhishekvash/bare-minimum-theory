/**
 * Root layout SEO: the canonical URL must not echo query strings (utm etc.) back to crawlers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { readable } from 'svelte/store';

vi.mock('$app/stores', () => ({
	page: readable({
		url: new URL('https://example.com/some/path?utm_source=newsletter&ref=abc#top'),
		data: {}
	})
}));

const { default: Layout } = await import('../../routes/+layout.svelte');

let component: Record<string, unknown> | null = null;

beforeEach(() => {
	// jsdom has no matchMedia; the layout's Toaster reads it for the colour scheme
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
	});
});

afterEach(() => {
	if (component) unmount(component);
	component = null;
	Reflect.deleteProperty(window, 'matchMedia');
	document.head.innerHTML = '';
	document.body.innerHTML = '';
});

describe('root layout SEO', () => {
	it('uses origin + pathname for the canonical link, dropping query and hash', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		component = mount(Layout, {
			target,
			props: {
				data: {
					title: 't',
					description: 'd',
					keywords: 'k',
					siteName: 's',
					imageURL: 'https://example.com/og.png',
					author: 'a',
					type: 'website'
				},
				children: createRawSnippet(() => ({ render: () => '<span></span>' }))
			}
		});
		flushSync();

		const canonical = document.head.querySelector('link[rel="canonical"]');
		expect(canonical?.getAttribute('href')).toBe('https://example.com/some/path');
	});
});
