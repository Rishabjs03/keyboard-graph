import { createContributionsHandler } from 'keyboard-graph/server';

/**
 * GET /api/contributions/:username?y=2025
 *
 * With GITHUB_TOKEN set, contributions come straight from GitHub's GraphQL API
 * (via `keyboard-graph/server`). Without it, the request is passed through to the
 * public community API so the demo works with zero configuration.
 */
const githubHandler = createContributionsHandler({ maxAge: 3600 });
const USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export async function GET(request: Request, context: { params: Promise<{ username: string }> }) {
  if (process.env.GITHUB_TOKEN) return githubHandler(request);

  const { username } = await context.params;
  if (!USERNAME.test(username)) {
    return Response.json({ error: 'Invalid username.' }, { status: 400 });
  }
  const year = new URL(request.url).searchParams.get('y') ?? 'last';
  const upstream = await fetch(
    `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=${/^\d{4}$/.test(year) ? year : 'last'}`,
    { next: { revalidate: 3600 } },
  );
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': upstream.ok
        ? 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
        : 'no-store',
    },
  });
}
