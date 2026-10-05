/** GitHub-style intensity bucket. 0 = no contributions, 4 = the busiest days. */
export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

/** One day of contributions — the shape every data source is normalised into. */
export interface ContributionDay {
  /** ISO calendar date, `YYYY-MM-DD`. */
  date: string;
  /** Number of contributions on that day. */
  count: number;
  /** Intensity bucket 0–4. Computed from `count` (quartiles) when omitted. */
  level: ContributionLevel;
}

/** A raw day as accepted by the `data` prop. `level` is optional. */
export interface ContributionInput {
  date: string;
  count: number;
  level?: number;
}

/** `'last'` = the rolling last 12 months (GitHub's default view). */
export type YearSelection = number | 'last';

/** Shape returned by github-contributions-api.jogruber.de (and by the bundled proxy helpers). */
export interface ContributionsApiResponse {
  total?: Record<string, number>;
  contributions: ContributionInput[];
}

export interface FetcherParams {
  username: string;
  year: YearSelection;
  signal: AbortSignal;
}

/**
 * Custom data source. Return either the raw day array or an API-shaped object;
 * both are normalised for you.
 */
export type ContributionsFetcher = (
  params: FetcherParams,
) => Promise<ContributionInput[] | ContributionsApiResponse>;

/** A day placed on the keyboard. */
export interface KeyCell extends ContributionDay {
  /** Position in the chronological day list. */
  index: number;
  /** Week column, 0-based. */
  col: number;
  /** Weekday row, 0-based (0 = `weekStart`). */
  row: number;
  /** True for days after today (rendered as dimmed, inert keys). */
  future: boolean;
}

export interface MonthLabel {
  label: string;
  col: number;
}

export interface WeekdayLabel {
  label: string;
  row: number;
}

export interface GraphLayout {
  cells: KeyCell[];
  columns: number;
  rows: 7;
  months: MonthLabel[];
  weekdays: WeekdayLabel[];
  /** Sum of all contributions in the range. */
  total: number;
  /** `positions[col * 7 + row]` → cell index, or -1 for an empty slot. */
  positions: Int32Array;
  start: string;
  end: string;
}

/** Payload handed to `onKeyPress`. */
export interface KeyPressDetail extends ContributionDay {
  col: number;
  row: number;
  /** What triggered the press. */
  source: 'pointer' | 'keyboard' | 'program';
}

export interface LoadDetail {
  days: ContributionDay[];
  total: number;
  year: YearSelection | null;
  username: string | null;
}

export type ColorScheme = 'light' | 'dark' | 'auto';

/** `'user'` follows `prefers-reduced-motion`. */
export type ReducedMotionSetting = 'user' | 'always' | 'never';

export type ResponsiveMode = 'scale' | 'scroll';
