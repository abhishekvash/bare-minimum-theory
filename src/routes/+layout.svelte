<script lang="ts">
	import { Toaster } from '#lib/components/ui/sonner/index.ts';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
	import { JsonLd, MetaTags } from 'svelte-meta-tags';
	import { page } from '$app/state';
	import '../app.css';

	// Mobile drag-drop polyfill for touch devices
	import { onMount } from 'svelte';
	import 'mobile-drag-drop/default.css';

	let { children, data } = $props();

	// Crawlers get one URL per page: no query string (utm etc.) or hash
	const canonical = $derived(page.url.origin + page.url.pathname);

	// Initialize polyfill on mount (only for touch devices)
	onMount(async () => {
		const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
		if (!isTouchDevice) return;

		// Dynamic import to handle CommonJS module
		const { polyfill } = await import('mobile-drag-drop');
		const { scrollBehaviourDragImageTranslateOverride } =
			await import('mobile-drag-drop/scroll-behaviour');

		polyfill({
			dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
			// Allow dragging to start after a short press
			holdToDrag: 200
		});

		// Prevent scrolling when dragging
		window.addEventListener('touchmove', () => {}, { passive: false });
	});
</script>

<MetaTags
	title={data.title}
	description={data.description}
	keywords={data.keywords}
	{canonical}
	robots="index,follow"
	additionalRobotsProps={{ maxImagePreview: 'large' }}
	openGraph={{
		type: data.type,
		url: canonical,
		title: data.title,
		description: data.description,
		siteName: data.siteName,
		images: [{ url: data.imageURL }]
	}}
	twitter={{
		cardType: 'summary_large_image',
		title: data.title,
		description: data.description,
		image: data.imageURL
	}}
	additionalMetaTags={[
		{ name: 'author', content: data.author },
		{ property: 'twitter:domain', content: page.url.hostname },
		{ property: 'twitter:url', content: canonical }
	]}
/>

<JsonLd
	schema={{
		'@type': 'WebApplication',
		name: data.siteName,
		description: data.description,
		url: page.url.origin,
		image: data.imageURL,
		applicationCategory: 'MusicApplication',
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'USD'
		}
	}}
/>

<Tooltip.Provider>
	{@render children()}
</Tooltip.Provider>

<Toaster />
