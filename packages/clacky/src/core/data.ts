import { addDays, daysBetween, parseISODate } from './format.js';
import type {
  ContributionDay,
  ContributionInput,
  ContributionLevel,
  ContributionsApiResponse,
  ContributionsFetcher,
  YearSelection,
} from './types.js';

/**
 * Default public endpoint. A free, community-run service that scrapes the public
 * contribution calendar (no token needed). Responses are cached upstream for about
 * an hour; for high-traffic sites, deploy the self-hosted proxy instead.
 */
export const DEFAULT_ENDPOINT =
  'https://github-contributions-api.jogruber.de/v4/{username}?y={year}';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const USERNAME = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export type ClackyErrorCode = 'not-found' | 'rate-limited' | 'network' | 'invalid' | 'aborted';

export class ClackyError extends Error {
  readonly code: ClackyErrorCode;
  readonly status: number | undefined;

  constructor(code: ClackyErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ClackyError';
    this.code = code;
    this.status = status;
  }
}

export function isValidUsername(username: string): boolean {
  return USERNAME.test(username);
}

/** Fill `{username}` and `{year}` placeholders in an endpoint template. */
export function buildEndpointUrl(template: string, username: string, year: YearSelection): string {
  return template
    .replaceAll('{username}', encodeURIComponent(username))
    .replaceAll('{year}', encodeURIComponent(String(year)));
}

function clampLevel(level: number): ContributionLevel {
  if (!Number.isFinite(level)) return 0;
  return Math.max(0, Math.min(4, Math.round(level))) as ContributionLevel;
}

/**
 * Bucket counts into levels 0 to 4 using quartiles of the non-zero days, which is how
 * GitHub assigns its colours.
 */
export function computeLevels(counts: readonly number[]): ContributionLevel[] {
  const active = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (active.length === 0) return counts.map(() => 0);
  // Linearly interpolated quantiles, so the busiest days land in level 4 even when
  // there are only a handful of active days.
  const q = (p: number) => {
    const pos = (active.length - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.min(active.length - 1, lo + 1);
    return active[lo]! + (active[hi]! - active[lo]!) * (pos - lo);
  };
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  return counts.map((c) => {
    if (c <= 0) return 0;
    if (c <= q1) return 1;
    if (c <= q2) return 2;
    if (c <= q3) return 3;
    return 4;
  });
}

export interface NormalizeOptions {
  /** When a number, keep only days inside that calendar year (and pad it to Jan 1 to Dec 31). */
  year?: YearSelection | null;
}

/**
 * Turn any reasonable day array into a sorted, gap-free, de-duplicated list.
 * Missing days are filled with zero-contribution entries so the grid never has holes.
 */
export function normalizeContributions(
  input: readonly ContributionInput[],
  options: NormalizeOptions = {},
): ContributionDay[] {
  const byDate = new Map<string, ContributionInput>();
  for (const day of input) {
    if (!day || typeof day.date !== 'string') continue;
    const date = day.date.slice(0, 10);
    if (!ISO_DATE.test(date)) continue;
    const count = Number(day.count) || 0;
    const existing = byDate.get(date);
    // Duplicate dates (e.g. merged sources) are summed rather than dropped.
    byDate.set(
      date,
      existing ? { ...existing, count: existing.count + count } : { ...day, date, count },
    );
  }

  let dates = [...byDate.keys()].sort();
  const year = options.year;
  if (typeof year === 'number') {
    dates = dates.filter((d) => d.startsWith(`${year}-`));
  }

  let start = dates[0];
  let end = dates[dates.length - 1];
  if (typeof year === 'number') {
    start = `${year}-01-01`;
    end = `${year}-12-31`;
  }
  if (!start || !end) return [];

  const span = daysBetween(start, end);
  // Guard against absurd ranges (e.g. a typo'd year) so we never allocate millions of keys.
  if (span < 0 || span > 3 * 366) {
    throw new ClackyError('invalid', `Date range ${start} → ${end} is too large to render.`);
  }

  const raw: ContributionInput[] = [];
  for (let i = 0; i <= span; i++) {
    const date = addDays(start, i);
    raw.push(byDate.get(date) ?? { date, count: 0, level: 0 });
  }

  // Trust upstream levels when every day carries one, otherwise derive them.
  const hasLevels = raw.every((d) => d.level !== undefined && d.level !== null);
  const levels = hasLevels
    ? raw.map((d) => clampLevel(d.level!))
    : computeLevels(raw.map((d) => d.count));

  return raw.map((d, i) => ({ date: d.date, count: Math.max(0, d.count), level: levels[i]! }));
}

/** Accept either a bare array or an API-shaped `{ contributions }` object. */
export function parseContributionsPayload(payload: unknown): ContributionInput[] {
  if (Array.isArray(payload)) return payload as ContributionInput[];
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as ContributionsApiResponse).contributions)
  ) {
    return (payload as ContributionsApiResponse).contributions;
  }
  throw new ClackyError(
    'invalid',
    'Unexpected contributions payload: expected an array or { contributions: [] }.',
  );
}

export interface LoadContributionsOptions {
  username: string;
  year: YearSelection;
  endpoint?: string;
  fetcher?: ContributionsFetcher;
  signal?: AbortSignal;
}

export interface LoadedContributions {
  days: ContributionDay[];
  total: number;
}

// In-memory cache of in-flight and settled requests, keyed by URL. Switching years
// back and forth (or rendering several graphs for one user) never refetches.
const responseCache = new Map<string, Promise<ContributionInput[]>>();

/** Give up on a stalled request so the UI can offer a retry instead of loading forever. */
const REQUEST_TIMEOUT_MS = 15_000;

async function fetchFromEndpoint(url: string): Promise<ContributionInput[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } catch (error) {
      throw timeoutOr(controller, `Network error while loading contributions: ${String(error)}`);
    }
    if (response.status === 404) {
      throw new ClackyError('not-found', 'GitHub user not found.', 404);
    }
    if (response.status === 403 || response.status === 429) {
      throw new ClackyError(
        'rate-limited',
        'The contributions API is rate limiting requests. Try again shortly.',
        response.status,
      );
    }
    if (!response.ok) {
      throw new ClackyError(
        'network',
        `Contributions API responded with ${response.status}.`,
        response.status,
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw timeoutOr(controller, `Invalid response from the contributions API: ${String(error)}`);
    }
    return parseContributionsPayload(payload);
  } finally {
    clearTimeout(timer);
  }
}

function timeoutOr(controller: AbortController, message: string) {
  return new ClackyError(
    'network',
    controller.signal.aborted ? 'The contributions API took too long to respond.' : message,
  );
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new ClackyError('aborted', 'Request aborted.'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new ClackyError('aborted', 'Request aborted.'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

/** Fetch and normalise contributions for a user. Used by both wrappers. */
export async function loadContributions(
  options: LoadContributionsOptions,
): Promise<LoadedContributions> {
  const { username, year, fetcher, signal } = options;
  let raw: ContributionInput[];

  if (fetcher) {
    const controller = new AbortController();
    signal?.addEventListener('abort', () => controller.abort(), { once: true });
    raw = parseContributionsPayload(
      await abortable(fetcher({ username, year, signal: controller.signal }), signal),
    );
  } else {
    if (!isValidUsername(username)) {
      throw new ClackyError('not-found', `"${username}" is not a valid GitHub username.`);
    }
    const url = buildEndpointUrl(options.endpoint ?? DEFAULT_ENDPOINT, username, year);
    let request = responseCache.get(url);
    if (!request) {
      request = fetchFromEndpoint(url);
      responseCache.set(url, request);
      // Failed requests are evicted so a retry actually hits the network again.
      request.catch(() => responseCache.delete(url));
    }
    raw = await abortable(request, signal);
  }

  const days = normalizeContributions(raw, { year: typeof year === 'number' ? year : null });
  return { days, total: sumContributions(days) };
}

export function sumContributions(days: readonly ContributionDay[]): number {
  let total = 0;
  for (const day of days) total += day.count;
  return total;
}

/** Clear the in-memory response cache (mainly useful in tests). */
export function clearContributionsCache(): void {
  responseCache.clear();
}

/** The year options shown by the built-in year selector. */
export function defaultYearOptions(now: Date = new Date(), count = 5): YearSelection[] {
  const current = now.getFullYear();
  return ['last', ...Array.from({ length: count }, (_, i) => current - i)];
}

/** Parse a `year` attribute/prop value. */
export function parseYear(value: unknown): YearSelection {
  if (value === 'last' || value === undefined || value === null || value === '') return 'last';
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 2000 && n < 3000 ? n : 'last';
}

/** Fabricate a plausible-looking year of data (used for previews and docs). Deterministic per seed. */
export function sampleContributions(end: string, seed = 7, days = 371): ContributionDay[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const start = addDays(end, -(days - 1));
  const raw: ContributionInput[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const weekday = parseISODate(date).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    const burst = Math.sin(i / 9) + Math.sin(i / 23) * 0.6;
    const active = rand() < (weekend ? 0.35 : 0.78);
    const count = active ? Math.max(0, Math.round((burst + 1.4) * rand() * 7)) : 0;
    raw.push({ date, count });
  }
  return normalizeContributions(raw);
}
