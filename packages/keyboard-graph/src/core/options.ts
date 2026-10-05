import type { SoundOption } from '../audio/engine.js';
import type { GhostTypingOptions } from './ghost.js';
import { boardDenominator } from './layout.js';
import { resolveTheme, themeToCssVars, type ThemeInput } from './theme.js';
import type {
  ColorScheme,
  ContributionDay,
  ContributionInput,
  ContributionsFetcher,
  ReducedMotionSetting,
  ResponsiveMode,
  YearSelection,
} from './types.js';

export interface ThemeTransitionOptions {
  /** Viewport point the colour sweep radiates from (e.g. the clicked swatch). Default: the grid's left edge. */
  origin?: { x: number; y: number } | null;
  /** Colour fade duration per key, ms. Default 420. */
  duration?: number;
  /** Delay added per key of distance from the origin, ms. Default 12. */
  stagger?: number;
}

/** Every option shared by `<KeyboardGraph>` and `<keyboard-graph>`. */
export interface KeyboardGraphOptions {
  /** GitHub username to fetch. */
  username?: string;
  /** Calendar year, or `'last'` for the rolling last 12 months. Default `'last'`. */
  year?: YearSelection;
  /** Static data (skips fetching): `[{ date, count, level? }]`. */
  data?: readonly ContributionInput[];
  /** Custom data source; receives `{ username, year, signal }`. */
  fetcher?: ContributionsFetcher;
  /** Endpoint template with `{username}` and `{year}` placeholders, returning the same shape as the default API. */
  endpoint?: string;

  /** Preset name or custom theme object. Default `'github'`. */
  theme?: ThemeInput;
  /** Default `'light'`. `'auto'` follows the OS setting. */
  colorScheme?: ColorScheme;

  /** Switch profile, a custom sound pack, or `false` for silence. Default `'brown'`. */
  sound?: SoundOption;
  /** 0–1. Default 0.5. */
  volume?: number;
  muted?: boolean;

  /** Maximum keycap size in px (keys scale down to fit narrow containers). Default 16. */
  keySize?: number;
  /** Gap between keys in px at full size. Default 4. */
  gap?: number;
  /** Corner radius in px at full size. Default 4. */
  radius?: number;
  /** Smallest key size before the graph scrolls horizontally instead. Default 9. */
  minKeySize?: number;
  /** `'scale'` shrinks keys to fit, then scrolls; `'scroll'` keeps full size and scrolls. Default `'scale'`. */
  responsive?: ResponsiveMode;

  showMonthLabels?: boolean;
  showDayLabels?: boolean;
  /** "1,204 contributions in the last year". Default true. */
  showTotal?: boolean;
  /** "Less ▢▢▢▢▢ More". Default true. */
  showLegend?: boolean;
  /** Built-in year switcher. `true` = last year + the past 5 years, or pass your own list. Default false. */
  yearSelector?: boolean | readonly YearSelection[];
  /** 0 = Sunday (GitHub), 1 = Monday. */
  weekStart?: 0 | 1;
  /** Draw the background plate. Default true. */
  plate?: boolean;

  /** Keys drop into the plate in a diagonal wave on load. Default true. */
  entrance?: boolean;
  /** Neighbouring keys dip and glow when one is pressed. Default true. */
  ripple?: boolean;
  /** Show the date/count popover on press. Default true. */
  tooltip?: boolean;
  /** Softly press random keys while idle. Default false. */
  ghostTyping?: boolean | GhostTypingOptions;
  /** Animate colour changes as a ripple across the keys. Default true. */
  themeTransition?: boolean | ThemeTransitionOptions;
  /** Default `'user'` (follows `prefers-reduced-motion`). */
  reducedMotion?: ReducedMotionSetting;

  /** BCP 47 locale for dates and numbers. */
  locale?: string;
  formatTooltip?: (day: ContributionDay) => string;
  formatAriaLabel?: (day: ContributionDay) => string;
  formatTotal?: (total: number, year: YearSelection | null) => string;
}

export const defaults = {
  year: 'last' as YearSelection,
  theme: 'github' as ThemeInput,
  colorScheme: 'light' as ColorScheme,
  sound: 'brown' as SoundOption,
  volume: 0.5,
  muted: false,
  keySize: 16,
  gap: 4,
  radius: 4,
  minKeySize: 9,
  responsive: 'scale' as ResponsiveMode,
  showMonthLabels: true,
  showDayLabels: true,
  showTotal: true,
  showLegend: true,
  yearSelector: false as boolean | readonly YearSelection[],
  weekStart: 0 as 0 | 1,
  plate: true,
  entrance: true,
  ripple: true,
  tooltip: true,
  ghostTyping: false as boolean | GhostTypingOptions,
  themeTransition: true as boolean | ThemeTransitionOptions,
  reducedMotion: 'user' as ReducedMotionSetting,
} as const;

export type ResolvedOptions = Omit<KeyboardGraphOptions, keyof typeof defaults> & {
  -readonly [K in keyof typeof defaults]: (typeof defaults)[K];
};

/** Fill in defaults, ignoring `undefined` values. */
export function withDefaults(options: KeyboardGraphOptions): ResolvedOptions {
  const resolved: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) resolved[key] = value;
  }
  return resolved as ResolvedOptions;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function transitionSettings(value: boolean | ThemeTransitionOptions) {
  if (value === false) return null;
  const o = value === true ? {} : value;
  return { origin: o.origin ?? null, duration: o.duration ?? 420, stagger: o.stagger ?? 12 };
}

/** Sizing + colour variables written on the root element. */
export function rootStyleVars(o: ResolvedOptions): Record<string, string> {
  const keySize = clamp(o.keySize, 6, 64);
  const transition = transitionSettings(o.themeTransition);
  return {
    '--_max': `${keySize}px`,
    '--_min': `${clamp(Math.min(o.minKeySize, keySize), 4, 64)}px`,
    '--_gap-r': String(Number((clamp(o.gap, 0, keySize) / keySize).toFixed(4))),
    '--_radius-r': String(Number((clamp(o.radius, 0, keySize / 2) / keySize).toFixed(4))),
    '--_sweep': `${transition ? transition.duration : 0}ms`,
  };
}

/** Theme variables (`--kg-light-*` / `--kg-dark-*`). */
export function themeStyleVars(theme: ThemeInput | undefined): Record<string, string> {
  return themeToCssVars(resolveTheme(theme));
}

/** Variables that depend on the grid size. */
export function frameStyleVars(
  columns: number,
  o: Pick<ResolvedOptions, 'gap' | 'keySize' | 'showDayLabels'>,
) {
  const keySize = clamp(o.keySize, 6, 64);
  const gapRatio = clamp(o.gap, 0, keySize) / keySize;
  return {
    '--_cols': String(columns),
    '--_denom': String(boardDenominator(columns, gapRatio, o.showDayLabels)),
  };
}

export type RootState = 'loading' | 'ready' | 'error' | 'empty';

export function rootDataAttributes(
  o: ResolvedOptions,
  state: RootState,
  reducedMotion: boolean | null,
) {
  return {
    'data-scheme': o.colorScheme,
    'data-state': state,
    'data-responsive': o.responsive,
    'data-plate': String(o.plate),
    'data-motion':
      o.reducedMotion === 'always' || reducedMotion
        ? 'reduce'
        : o.reducedMotion === 'never'
          ? 'full'
          : 'user',
  } as const;
}

/** Year options for the built-in selector. */
export function yearOptions(
  value: boolean | readonly YearSelection[],
  now = new Date(),
): YearSelection[] {
  if (Array.isArray(value)) return [...value];
  if (!value) return [];
  const current = now.getFullYear();
  return ['last', current, current - 1, current - 2, current - 3, current - 4];
}

/** Read the OS reduced-motion preference (false during SSR). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export function shouldReduceMotion(setting: ReducedMotionSetting): boolean {
  if (setting === 'always') return true;
  if (setting === 'never') return false;
  return prefersReducedMotion();
}
