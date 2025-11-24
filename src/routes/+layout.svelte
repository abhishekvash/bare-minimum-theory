<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from '$lib/components/ui/sonner';
	import Seo from 'sk-seo';
	import { page } from '$app/stores';
	import '../app.css';

	let { children, data } = $props();
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
		name: 'Bare Minimum Theory',
		description: 'Free chord progression builder for self-taught musicians',
		url: $page.url.origin,
		applicationCategory: 'MusicApplication',
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'USD'
		}
	}}
/>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<Toaster />
