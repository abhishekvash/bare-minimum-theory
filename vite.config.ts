import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		sentrySvelteKit({
			sourceMapsUploadOptions: {
				org: 'qwerkyawoo',
				project: 'bare-minimum-theory'
			}
		}),
		tailwindcss(),
		sveltekit()
	],
	ssr: {
		noExternal: ['svelte-sonner', 'bits-ui']
	}
});
