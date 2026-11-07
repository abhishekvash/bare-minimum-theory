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
			preprocess: vitePreprocess()
		})
	]
});
