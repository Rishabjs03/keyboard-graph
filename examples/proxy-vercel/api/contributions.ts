import { createContributionsHandler } from 'keyboard-graph/server';

/**
 * GET /api/contributions?username=octocat&y=2025
 *
 * Reads GITHUB_TOKEN from the environment (Project → Settings → Environment Variables).
 * Responses are cached on Vercel's CDN for an hour.
 */
const handler = createContributionsHandler({ maxAge: 3600 });

export function GET(request: Request): Promise<Response> {
  return handler(request);
}

export function OPTIONS(request: Request): Promise<Response> {
  return handler(request);
}
