import { createContributionsHandler } from 'clacky/server';

/**
 * GET /api/contributions/:username?y=2025
 *
 * Reads GITHUB_TOKEN from the site's environment variables.
 */
const handler = createContributionsHandler({ maxAge: 3600 });

export default (request: Request) => handler(request);

export const config = {
  path: '/api/contributions/:username',
};
