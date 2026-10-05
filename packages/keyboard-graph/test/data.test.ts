import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KeyboardGraphError,
  buildEndpointUrl,
  clearContributionsCache,
  computeLevels,
  isValidUsername,
  loadContributions,
  normalizeContributions,
  parseContributionsPayload,
  parseYear,
  sampleContributions,
} from '../src/core/data';

describe('normalizeContributions', () => {
  it('sorts, fills gaps and keeps upstream levels', () => {
    const days = normalizeContributions([
      { date: '2026-01-03', count: 4, level: 2 },
      { date: '2026-01-01', count: 1, level: 1 },
    ]);
    expect(days.map((d) => d.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
    expect(days[1]).toEqual({ date: '2026-01-02', count: 0, level: 0 });
    expect(days[2]!.level).toBe(2);
  });

  it('computes levels from counts when they are missing', () => {
    const days = normalizeContributions([
      { date: '2026-01-01', count: 0 },
      { date: '2026-01-02', count: 1 },
      { date: '2026-01-03', count: 20 },
    ]);
    expect(days.map((d) => d.level)).toEqual([0, 1, 4]);
  });

  it('pads a calendar year to Jan 1 – Dec 31 and drops other years', () => {
    const days = normalizeContributions(
      [
        { date: '2025-12-31', count: 9 },
        { date: '2026-06-01', count: 2 },
      ],
      { year: 2026 },
    );
    expect(days).toHaveLength(365);
    expect(days[0]!.date).toBe('2026-01-01');
    expect(days.at(-1)!.date).toBe('2026-12-31');
  });

  it('sums duplicate dates and ignores invalid entries', () => {
    const days = normalizeContributions([
      { date: '2026-02-01', count: 2 },
      { date: '2026-02-01T10:00:00Z', count: 3 },
      { date: 'nope', count: 1 },
    ]);
    expect(days).toEqual([{ date: '2026-02-01', count: 5, level: 1 }]);
  });

  it('rejects absurd ranges', () => {
    expect(() =>
      normalizeContributions([
        { date: '2000-01-01', count: 1 },
        { date: '2026-01-01', count: 1 },
      ]),
    ).toThrow(KeyboardGraphError);
  });
});

describe('helpers', () => {
  it('computeLevels uses quartiles of non-zero days', () => {
    expect(computeLevels([0, 1, 2, 3, 4, 5, 6, 7, 8])).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(computeLevels([0, 0])).toEqual([0, 0]);
  });

  it('builds endpoint URLs', () => {
    expect(buildEndpointUrl('https://x.dev/{username}?y={year}', 'octo cat', 2025)).toBe(
      'https://x.dev/octo%20cat?y=2025',
    );
  });

  it('validates usernames like GitHub does', () => {
    expect(isValidUsername('Rishabjs03')).toBe(true);
    expect(isValidUsername('a-b')).toBe(true);
    expect(isValidUsername('-ab')).toBe(false);
    expect(isValidUsername('a--b')).toBe(false);
    expect(isValidUsername('x'.repeat(40))).toBe(false);
  });

  it('parses year values', () => {
    expect(parseYear('2024')).toBe(2024);
    expect(parseYear('last')).toBe('last');
    expect(parseYear('banana')).toBe('last');
    expect(parseYear(undefined)).toBe('last');
  });

  it('parses payloads', () => {
    expect(parseContributionsPayload([{ date: '2026-01-01', count: 1 }])).toHaveLength(1);
    expect(parseContributionsPayload({ contributions: [] })).toEqual([]);
    expect(() => parseContributionsPayload({ nope: true })).toThrow(KeyboardGraphError);
  });

  it('generates deterministic sample data', () => {
    const a = sampleContributions('2026-10-05', 3);
    const b = sampleContributions('2026-10-05', 3);
    expect(a).toEqual(b);
    expect(a).toHaveLength(371);
    expect(a.at(-1)!.date).toBe('2026-10-05');
  });
});

describe('loadContributions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearContributionsCache();
  });

  it('fetches, normalises and caches by URL', async () => {
    const fetchMock = vi.fn(
      async (_url: string) =>
        new Response(
          JSON.stringify({
            total: { lastYear: 3 },
            contributions: [{ date: '2026-01-01', count: 3, level: 2 }],
          }),
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const first = await loadContributions({ username: 'octocat', year: 'last' });
    const second = await loadContributions({ username: 'octocat', year: 'last' });
    expect(first.total).toBe(3);
    expect(second.days).toEqual(first.days);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://github-contributions-api.jogruber.de/v4/octocat?y=last',
    );
  });

  it('maps 404 to a not-found error and does not cache failures', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadContributions({ username: 'ghost-user', year: 'last' })).rejects.toMatchObject(
      { code: 'not-found' },
    );
    await expect(loadContributions({ username: 'ghost-user', year: 'last' })).rejects.toMatchObject(
      { code: 'not-found' },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses a custom fetcher with an abort signal', async () => {
    const fetcher = vi.fn(async ({ signal }: { signal: AbortSignal }) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return [{ date: '2026-03-01', count: 5 }];
    });
    const result = await loadContributions({ username: 'x', year: 2026, fetcher });
    expect(result.days).toHaveLength(365);
    expect(result.total).toBe(5);
  });

  it('rejects with an aborted error when the signal fires', async () => {
    const controller = new AbortController();
    const fetcher = () => new Promise<never>(() => undefined);
    const promise = loadContributions({
      username: 'x',
      year: 'last',
      fetcher,
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'aborted' });
  });
});
