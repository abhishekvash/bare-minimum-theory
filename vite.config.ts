import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		// SvelteKit 3 reads its config from here; svelte.config.js is no longer supported
		sveltekit({
			adapter: adapter(),
			preprocess: vitePreprocess(),
			// The page is prerendered, so `url.origin` at build time is this origin
			// (canonical, Open Graph, sitemap and robots URLs all derive from it)
			paths: { origin: 'https://bare-minimum-theory.abhishekvash.xyz' }
		})
	],
	optimizeDeps: {
		// Only imported dynamically from hooks.client.ts, which the dev dependency scan does not
		// crawl. Without this, Vite finds them on first load, re-optimises and reloads, and requests
		// still holding the old chunk hashes fail ("file does not exist ... optimize deps directory").
		include: ['mobile-drag-drop', 'mobile-drag-drop/scroll-behaviour']
	}
});
