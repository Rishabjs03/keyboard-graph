import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardGraphError, loadContributions, normalizeContributions, sumContributions } from '../core/data.js';
import type { ContributionDay, ContributionInput, ContributionsFetcher, LoadDetail, YearSelection } from '../core/types.js';

export interface UseContributionsOptions {
  username?: string;
  year: YearSelection;
  data?: readonly ContributionInput[];
  fetcher?: ContributionsFetcher;
  endpoint?: string;
  onLoad?: (detail: LoadDetail) => void;
  onError?: (error: KeyboardGraphError) => void;
}

export type ContributionsStatus = 'loading' | 'ready' | 'error' | 'empty';

export interface UseContributionsResult {
  status: ContributionsStatus;
  days: ContributionDay[] | null;
  total: number;
  /** The year the current `days` belong to (lags `year` while a new year loads). */
  year: YearSelection | null;
  error: KeyboardGraphError | null;
  /** True while new data loads behind existing data. */
  busy: boolean;
  retry: () => void;
}

interface RemoteState {
  status: ContributionsStatus;
  days: ContributionDay[] | null;
  total: number;
  year: YearSelection | null;
  error: KeyboardGraphError | null;
  busy: boolean;
}

/** Cheap content signature so an inline `data={[...]}` literal doesn't re-layout every render. */
function signature(data: readonly ContributionInput[] | undefined): string {
  if (!data) return '';
  let sum = 0;
  let levels = 0;
  for (const d of data) {
    sum += Number(d.count) || 0;
    levels += (Number(d.level) || 0) * 31 + (Number(d.count) || 0) * 7;
  }
  return `${data.length}|${data[0]?.date}|${data[data.length - 1]?.date}|${sum}|${levels}`;
}

const toError = (error: unknown) =>
  error instanceof KeyboardGraphError
    ? error
    : new KeyboardGraphError('network', error instanceof Error ? error.message : String(error));

/**
 * Load contributions from `data`, a `fetcher`, or a username (default public API or
 * your `endpoint`). Exported for building your own UI around the same data.
 */
export function useContributions(options: UseContributionsOptions): UseContributionsResult {
  const { username, year, data, fetcher, endpoint } = options;
  const callbacks = useRef(options);
  callbacks.current = options;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  const dataKey = signature(data);
  const staticYear = typeof year === 'number' ? year : null;
  const local = useMemo(() => {
    if (!data) return null;
    try {
      const days = normalizeContributions(data, { year: staticYear });
      return { days, total: sumContributions(days), error: null };
    } catch (error) {
      return { days: null, total: 0, error: toError(error) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by content signature
  }, [dataKey, staticYear]);

  const remoteEnabled = !data && Boolean(username || fetcher);
  const [remote, setRemote] = useState<RemoteState>(() => ({
    status: remoteEnabled ? 'loading' : 'empty',
    days: null,
    total: 0,
    year: null,
    error: null,
    busy: false,
  }));

  useEffect(() => {
    if (!remoteEnabled) {
      setRemote({ status: 'empty', days: null, total: 0, year: null, error: null, busy: false });
      return;
    }
    const controller = new AbortController();
    setRemote((prev) =>
      prev.status === 'ready' ? { ...prev, busy: true } : { ...prev, status: 'loading', error: null, busy: false },
    );
    loadContributions({ username: username ?? '', year, endpoint, fetcher: fetcherRef.current, signal: controller.signal }).then(
      (result) => {
        if (controller.signal.aborted) return;
        setRemote({
          status: result.days.length ? 'ready' : 'empty',
          days: result.days,
          total: result.total,
          year,
          error: null,
          busy: false,
        });
        callbacks.current.onLoad?.({ days: result.days, total: result.total, year, username: username ?? null });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const err = toError(error);
        if (err.code === 'aborted') return;
        setRemote({ status: 'error', days: null, total: 0, year: null, error: err, busy: false });
        callbacks.current.onError?.(err);
      },
    );
    return () => controller.abort();
  }, [remoteEnabled, username, year, endpoint, Boolean(fetcher), nonce]);

  // Fire onLoad / onError for static data too.
  useEffect(() => {
    if (!local) return;
    if (local.error) callbacks.current.onError?.(local.error);
    else if (local.days) callbacks.current.onLoad?.({ days: local.days, total: local.total, year: staticYear, username: username ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  if (local) {
    return {
      status: local.error ? 'error' : local.days && local.days.length > 0 ? 'ready' : 'empty',
      days: local.days,
      total: local.total,
      year: staticYear,
      error: local.error,
      busy: false,
      retry,
    };
  }
  return { ...remote, retry };
}
