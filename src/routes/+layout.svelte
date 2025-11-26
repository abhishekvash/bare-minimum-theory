<script lang="ts">
	import { Toaster } from '$lib/components/ui/sonner';
	import Seo from 'sk-seo';
	import { page } from '$app/stores';
	import '../app.css';

	// Mobile drag-drop polyfill for touch devices
	import { onMount } from 'svelte';

	let { children, data } = $props();

	// Initialize polyfill on mount (only for touch devices)
	onMount(async () => {
		const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
		if (!isTouchDevice) return;

		// Dynamic import to handle CommonJS module
		const mobileDragDrop = await import('mobile-drag-drop');
		const scrollBehaviour = await import('mobile-drag-drop/scroll-behaviour');

		mobileDragDrop.polyfill({
			dragImageTranslateOverride: scrollBehaviour.scrollBehaviourDragImageTranslateOverride
		});
	});
</script>

<Seo
	title={data.title}
	description={data.description}
	keywords={data.keywords}
	siteName={data.siteName}
	imageURL={data.imageURL}
	author={data.author}
	type={data.type}
	openGraph={true}
	twitter={true}
	canonical={$page.url.href}
	schemaOrg={true}
	schemaType="WebApplication"
	jsonld={{
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: data.siteName,
		description: data.description,
		url: $page.url.origin,
		applicationCategory: 'MusicApplication',
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'USD'
		}
	}}
/>

{@render children()}

<Toaster />
