import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
	plugins: [
		// Only upload sourcemaps in production builds
		...(mode === 'production'
			? [
					sentrySvelteKit({
						sourceMapsUploadOptions: {
							org: 'qwerkyawoo',
							project: 'bare-minimum-theory',
							authToken: process.env.SENTRY_AUTH_TOKEN
						}
					})
				]
			: []),
		tailwindcss(),
		sveltekit()
	],
	build: {
		sourcemap: true
	},
	ssr: {
		noExternal: ['svelte-sonner', 'bits-ui']
	}
}));
