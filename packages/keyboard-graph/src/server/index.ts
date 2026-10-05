/**
 * keyboard-graph/server — fetch contributions straight from GitHub's GraphQL API
 * with your own token. Use it inside a tiny serverless function (Vercel, Netlify,
 * Cloudflare, Express…) and point the component's `endpoint` at it.
 *
 * Runtime-agnostic: only needs a global `fetch` (Node 18+, Deno, Bun, edge runtimes).
 */
import type { ContributionInput, ContributionsApiResponse, YearSelection } from '../core/types.js';

export const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

const LEVELS: Record<string, number> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const QUERY = /* GraphQL */ `
  query KeyboardGraph($login: String!, $from: DateTime, $to: DateTime) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
    }
  }
`;

export class GitHubContributionsError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitHubContributionsError';
    this.status = status;
  }
}

export interface FetchGitHubContributionsOptions {
  /** A GitHub token. A fine-grained token with no extra permissions (public data only) is enough. */
  token: string;
  username: string;
  /** Calendar year, or `'last'` (default) for the rolling last year. */
  year?: YearSelection;
  /** Override for GitHub Enterprise. */
  apiUrl?: string;
  signal?: AbortSignal;
}

interface GraphQLResponse {
  data?: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: { contributionDays: { date: string; contributionCount: number; contributionLevel: string }[] }[];
        };
      };
    } | null;
  };
  errors?: { message: string; type?: string }[];
}

/**
 * Returns `{ total, contributions }` in the same shape as the default public API,
 * so the component can consume it directly via `endpoint`.
 */
export async function fetchGitHubContributions(options: FetchGitHubContributionsOptions): Promise<ContributionsApiResponse> {
  const { token, username, year = 'last', apiUrl = GITHUB_GRAPHQL_URL, signal } = options;
  if (!token) throw new GitHubContributionsError('Missing GitHub token.', 500);

  // GitHub caps a contributionsCollection at one year. Omitting from/to gives the
  // rolling last year, exactly like the profile page.
  const variables: Record<string, string> = { login: username };
  if (typeof year === 'number') {
    variables.from = `${year}-01-01T00:00:00Z`;
    variables.to = `${year}-12-31T23:59:59Z`;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'keyboard-graph',
    },
    body: JSON.stringify({ query: QUERY, variables }),
    signal,
  });

  if (response.status === 401) throw new GitHubContributionsError('GitHub rejected the token.', 401);
  if (response.status === 403 || response.status === 429) {
    throw new GitHubContributionsError('GitHub API rate limit exceeded.', 429);
  }
  if (!response.ok) throw new GitHubContributionsError(`GitHub API responded with ${response.status}.`, 502);

  const json = (await response.json()) as GraphQLResponse;
  if (json.errors?.some((e) => e.type === 'NOT_FOUND') || json.data?.user === null) {
    throw new GitHubContributionsError(`GitHub user "${username}" not found.`, 404);
  }
  if (json.errors?.length || !json.data?.user) {
    throw new GitHubContributionsError(json.errors?.[0]?.message ?? 'Unexpected GitHub API response.', 502);
  }

  const calendar = json.data.user.contributionsCollection.contributionCalendar;
  const contributions: ContributionInput[] = calendar.weeks.flatMap((week) =>
    week.contributionDays.map((day) => ({
      date: day.date,
      count: day.contributionCount,
      level: LEVELS[day.contributionLevel] ?? 0,
    })),
  );

  return {
    total: { [typeof year === 'number' ? String(year) : 'lastYear']: calendar.totalContributions },
    contributions,
  };
}

export interface ContributionsHandlerOptions {
  /** Defaults to `process.env.GITHUB_TOKEN`. */
  token?: string;
  /** CDN cache lifetime in seconds. Default 3600 (contribution data changes slowly). */
  maxAge?: number;
  /** Allowed CORS origin(s). Default `*`. */
  allowOrigin?: string;
}

const USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

function envToken(): string | undefined {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.GITHUB_TOKEN;
}

/**
 * A ready-made Fetch-API handler: `GET ?username=octocat&y=2025` (or a `/octocat`
 * path segment). Works as-is for Vercel/Next.js route handlers, Netlify Functions
 * v2, Cloudflare Workers, Deno and Bun.
 */
export function createContributionsHandler(options: ContributionsHandlerOptions = {}) {
  const maxAge = options.maxAge ?? 3600;
  const cors = {
    'Access-Control-Allow-Origin': options.allowOrigin ?? '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  return async function handler(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const username = url.searchParams.get('username') ?? url.pathname.split('/').filter(Boolean).pop() ?? '';
    const yearParam = url.searchParams.get('y') ?? url.searchParams.get('year') ?? 'last';
    const year: YearSelection = /^\d{4}$/.test(yearParam) ? Number(yearParam) : 'last';

    const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors, ...extra },
      });

    if (!USERNAME.test(username)) return json({ error: 'Invalid username.' }, 400);
    const token = options.token ?? envToken();
    if (!token) return json({ error: 'Server is missing GITHUB_TOKEN.' }, 500);

    try {
      const data = await fetchGitHubContributions({ token, username, year });
      return json(data, 200, {
        'Cache-Control': `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 24}`,
      });
    } catch (error) {
      const status = error instanceof GitHubContributionsError ? error.status : 500;
      const message = error instanceof Error ? error.message : 'Unknown error.';
      return json({ error: message }, status, status === 404 ? { 'Cache-Control': 'public, s-maxage=600' } : {});
    }
  };
}
