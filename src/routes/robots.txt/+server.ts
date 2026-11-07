import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const baseUrl = url.origin;

	return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml`, {
		headers: {
			'Content-Type': 'text/plain'
		}
	});
};
