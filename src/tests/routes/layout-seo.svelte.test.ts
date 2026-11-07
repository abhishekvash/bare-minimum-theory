/**
 * Root layout SEO: the canonical URL must not echo query strings (utm etc.) back to crawlers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';

// $app/state's page is a plain (rune-backed) object, so the mock is too
vi.mock('$app/state', () => ({
	page: {
		url: new URL('https://example.com/some/path?utm_source=newsletter&ref=abc#top'),
		data: {}
	}
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
					keywords: ['k1', 'k2'],
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
		// Social cards point at the same clean URL
		expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
			'https://example.com/some/path'
		);
	});

	it('renders the meta tags and the WebApplication JSON-LD', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		component = mount(Layout, {
			target,
			props: {
				data: {
					title: 't',
					description: 'd',
					keywords: ['k1', 'k2'],
					siteName: 's',
					imageURL: 'https://example.com/og.png',
					author: 'a',
					type: 'website'
				},
				children: createRawSnippet(() => ({ render: () => '<span></span>' }))
			}
		});
		flushSync();

		const meta = (selector: string) =>
			document.head.querySelector(`meta[${selector}]`)?.getAttribute('content');
		expect(document.head.querySelector('title')?.textContent).toBe('t');
		expect(meta('name="description"')).toBe('d');
		expect(meta('name="keywords"')).toBe('k1, k2');
		expect(meta('name="author"')).toBe('a');
		expect(meta('name="robots"')).toBe('index,follow,max-image-preview:large');
		expect(meta('property="og:image"')).toBe('https://example.com/og.png');
		expect(meta('property="og:site_name"')).toBe('s');
		expect(meta('name="twitter:card"')).toBe('summary_large_image');

		const ld = document.head.querySelector('script[type="application/ld+json"]');
		expect(JSON.parse(ld?.textContent ?? '{}')).toMatchObject({
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			name: 's',
			url: 'https://example.com',
			applicationCategory: 'MusicApplication'
		});
	});
});
