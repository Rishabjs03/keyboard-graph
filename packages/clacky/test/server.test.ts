import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContributionsHandler, fetchGitHubContributions } from '../src/server/index';

function graphqlResponse(
  days: { date: string; contributionCount: number; contributionLevel: string }[],
) {
  return new Response(
    JSON.stringify({
      data: {
        user: {
          contributionsCollection: {
            contributionCalendar: {
              totalContributions: days.reduce((sum, d) => sum + d.contributionCount, 0),
              weeks: [{ contributionDays: days }],
            },
          },
        },
      },
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
}

describe('fetchGitHubContributions', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('queries GraphQL and maps levels to the public API shape', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      graphqlResponse([
        { date: '2025-03-01', contributionCount: 0, contributionLevel: 'NONE' },
        { date: '2025-03-02', contributionCount: 7, contributionLevel: 'THIRD_QUARTILE' },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchGitHubContributions({
      token: 't0k',
      username: 'octocat',
      year: 2025,
    });
    expect(result).toEqual({
      total: { '2025': 7 },
      contributions: [
        { date: '2025-03-01', count: 0, level: 0 },
        { date: '2025-03-02', count: 7, level: 3 },
      ],
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.github.com/graphql');
    expect((init.headers as Record<string, string>).Authorization).toBe('bearer t0k');
    const body = JSON.parse(String(init.body)) as { variables: Record<string, string> };
    expect(body.variables).toEqual({
      login: 'octocat',
      from: '2025-01-01T00:00:00Z',
      to: '2025-12-31T23:59:59Z',
    });
  });

  it('omits the date range for the rolling last year', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => graphqlResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchGitHubContributions({ token: 't', username: 'octocat' });
    expect(result.total).toEqual({ lastYear: 0 });
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body)).variables).toEqual({
      login: 'octocat',
    });
  });

  it('distinguishes not-found, rate limits and other refusals', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ data: { user: null } })));
    await expect(fetchGitHubContributions({ token: 't', username: 'ghost' })).rejects.toMatchObject(
      { status: 404 },
    );

    vi.stubGlobal(
      'fetch',
      async () => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
    );
    await expect(fetchGitHubContributions({ token: 't', username: 'a' })).rejects.toMatchObject({
      status: 429,
    });

    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ message: 'Nope' }), { status: 403 }),
    );
    await expect(fetchGitHubContributions({ token: 't', username: 'a' })).rejects.toMatchObject({
      status: 403,
      message: 'GitHub refused the request: Nope',
    });
  });
});

describe('createContributionsHandler', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('serves cached JSON with CORS headers', async () => {
    vi.stubGlobal('fetch', async () =>
      graphqlResponse([
        { date: '2026-01-01', contributionCount: 2, contributionLevel: 'FIRST_QUARTILE' },
      ]),
    );
    const handler = createContributionsHandler({ token: 't', maxAge: 60 });
    const res = await handler(new Request('https://x.dev/api/contributions/octocat?y=2026'));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toContain('s-maxage=60');
    expect(await res.json()).toMatchObject({
      contributions: [{ date: '2026-01-01', count: 2, level: 1 }],
    });
  });

  it('validates input and reports a missing token', async () => {
    const handler = createContributionsHandler({ token: 't' });
    expect((await handler(new Request('https://x.dev/api/contributions/-nope-'))).status).toBe(400);
    const noToken = createContributionsHandler({ token: '' });
    vi.stubEnv('GITHUB_TOKEN', '');
    expect((await noToken(new Request('https://x.dev/?username=octocat'))).status).toBe(500);
    vi.unstubAllEnvs();
  });
});
