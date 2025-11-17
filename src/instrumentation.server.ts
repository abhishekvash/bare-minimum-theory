import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: 'https://795e0b77f49bcaf62860e7dbbdd37c08@o4510379509481472.ingest.us.sentry.io/4510379517214720',

	tracesSampleRate: 1.0,

	// Enable logs to be sent to Sentry
	enableLogs: true

	// uncomment the line below to enable Spotlight (https://spotlightjs.com)
	// spotlight: import.meta.env.DEV,
});
