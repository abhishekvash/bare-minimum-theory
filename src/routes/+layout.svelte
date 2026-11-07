<script lang="ts">
	import { Toaster } from '#lib/components/ui/sonner/index.ts';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
	import { JsonLd, MetaTags } from 'svelte-meta-tags';
	import { page } from '$app/state';
	import '../app.css';

	// Styles for the touch drag-and-drop polyfill installed in hooks.client.ts
	import 'mobile-drag-drop/default.css';

	let { children, data } = $props();

	// Crawlers get one URL per page: no query string (utm etc.) or hash
	const canonical = $derived(page.url.origin + page.url.pathname);
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
