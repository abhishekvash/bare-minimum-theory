import { sequence } from '@sveltejs/kit/hooks';
import { handleErrorWithSentry, sentryHandle } from '@sentry/sveltekit';
import { dev } from '$app/environment';

// Only use Sentry handlers in production
// If you have custom handlers, make sure to place them after `sentryHandle()` in the `sequence` function.
export const handle = dev ? sequence() : sequence(sentryHandle());

// If you have a custom error handler, pass it to `handleErrorWithSentry`
export const handleError = handleErrorWithSentry();
