/** Colours for one colour scheme (light or dark). */
export interface ThemePalette {
  /** Keycap colours for contribution levels 0–4. Level 0 is the blank, neutral cap. */
  levels: readonly [string, string, string, string, string];
  /** Colour mixed into each cap colour to shade its side walls and skirt. */
  side: string;
  /** Soft drop shadow beneath each key. */
  shadow: string;
  /** The plate (background) the keys sit on. */
  plate: string;
  /** Labels, legend and totals. */
  text: string;
  /** Keyboard focus ring. */
  focus: string;
  /** Strength (0–1) of the specular highlight on each cap. */
  highlight: number;
  tooltip: {
    background: string;
    text: string;
    border: string;
  };
}

export type ThemeName =
  | 'github'
  | 'halloween'
  | 'ocean'
  | 'sunset'
  | 'mono'
  | 'sakura'
  | 'retro'
  | 'night';

export interface ThemePreset {
  name: ThemeName;
  label: string;
  light: ThemePalette;
  dark: ThemePalette;
}

type PartialPalette = Partial<Omit<ThemePalette, 'tooltip' | 'levels'>> & {
  levels?: readonly (string | undefined)[];
  tooltip?: Partial<ThemePalette['tooltip']>;
};

/**
 * A custom theme: override any colour of a preset (`extends`, default `github`).
 * Top-level values apply to both schemes; `dark` values override dark mode only.
 */
export interface CustomTheme extends PartialPalette {
  extends?: ThemeName;
  dark?: PartialPalette;
}

export type ThemeInput = ThemeName | CustomTheme;

export interface ResolvedTheme {
  light: ThemePalette;
  dark: ThemePalette;
}

const lightTooltip = { background: '#1f2328', text: '#ffffff', border: 'rgba(255,255,255,0.08)' };
const darkTooltip = { background: '#f6f8fa', text: '#1f2328', border: 'rgba(0,0,0,0.08)' };

function palette(
  levels: ThemePalette['levels'],
  base: Partial<ThemePalette> & Pick<ThemePalette, 'plate' | 'text'>,
  dark: boolean,
): ThemePalette {
  return {
    levels,
    side: dark ? '#000000' : '#1b1f24',
    shadow: dark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(27, 31, 36, 0.22)',
    focus: dark ? '#58a6ff' : '#0969da',
    highlight: dark ? 0.14 : 0.34,
    tooltip: dark ? darkTooltip : lightTooltip,
    ...base,
  };
}

export const themes: Record<ThemeName, ThemePreset> = {
  github: {
    name: 'github',
    label: 'GitHub Green',
    light: palette(['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'], { plate: '#f6f8fa', text: '#59636e' }, false),
    dark: palette(['#2a313c', '#0e4429', '#006d32', '#26a641', '#39d353'], { plate: '#0d1117', text: '#9198a1' }, true),
  },
  halloween: {
    name: 'halloween',
    label: 'Halloween',
    light: palette(['#ebedf0', '#ffee4a', '#ffc501', '#fe9600', '#03001c'], { plate: '#f7f4ee', text: '#5f5646' }, false),
    dark: palette(['#2b2a33', '#631c03', '#bd561d', '#fa7a18', '#fddf68'], { plate: '#110f14', text: '#a39b8f', focus: '#fa7a18' }, true),
  },
  ocean: {
    name: 'ocean',
    label: 'Ocean',
    light: palette(['#e7edf3', '#b7e1f3', '#5ab4e0', '#2a7fc1', '#12417a'], { plate: '#f3f7fa', text: '#4c6275' }, false),
    dark: palette(['#1f2a38', '#0b3954', '#087e8b', '#2fb4c6', '#8ee3ef'], { plate: '#0a121c', text: '#8aa1b4', focus: '#2fb4c6' }, true),
  },
  sunset: {
    name: 'sunset',
    label: 'Sunset',
    light: palette(['#f1ebe9', '#ffd3a5', '#fd9f6c', '#f2617a', '#8e3a8c'], { plate: '#fbf7f5', text: '#6f5a5a', focus: '#f2617a' }, false),
    dark: palette(['#2d2529', '#5a2a4a', '#a63d63', '#ec6c5b', '#ffb36b'], { plate: '#151013', text: '#b09a9c', focus: '#ec6c5b' }, true),
  },
  mono: {
    name: 'mono',
    label: 'Mono',
    light: palette(['#ececec', '#c6c6c6', '#909090', '#575757', '#1f1f1f'], { plate: '#f7f7f7', text: '#666666', focus: '#111111' }, false),
    dark: palette(['#2a2a2a', '#474747', '#727272', '#ababab', '#f0f0f0'], { plate: '#0f0f0f', text: '#9a9a9a', focus: '#f0f0f0' }, true),
  },
  sakura: {
    name: 'sakura',
    label: 'Sakura',
    light: palette(['#f4ecee', '#fbd3df', '#f5a3bd', '#e5739a', '#b8456f'], { plate: '#fdf8f9', text: '#7a5a66', focus: '#e5739a' }, false),
    dark: palette(['#2e2529', '#5c3443', '#93506a', '#d2799a', '#f7b9cd'], { plate: '#161013', text: '#b39aa4', focus: '#f7b9cd' }, true),
  },
  retro: {
    name: 'retro',
    label: 'Retro Beige',
    light: palette(
      ['#ece5d3', '#d8ceb3', '#bdb092', '#8b8371', '#cf5236'],
      { plate: '#d9d1bc', text: '#5c5446', side: '#4a3b22', focus: '#cf5236', highlight: 0.4 },
      false,
    ),
    dark: palette(
      ['#3d382f', '#5c5545', '#837960', '#b4a886', '#e0663f'],
      { plate: '#221f1a', text: '#a59c88', side: '#000000', focus: '#e0663f' },
      true,
    ),
  },
  night: {
    name: 'night',
    label: 'Night',
    light: palette(
      ['#262a3d', '#2d3f76', '#3e63dd', '#7c5cff', '#c4b5fd'],
      { plate: '#14151f', text: '#8b90b0', side: '#000000', shadow: 'rgba(0,0,0,0.6)', focus: '#a78bfa', highlight: 0.16, tooltip: darkTooltip },
      false,
    ),
    dark: palette(
      ['#22263a', '#2d3f76', '#3e63dd', '#7c5cff', '#c4b5fd'],
      { plate: '#0c0d14', text: '#8b90b0', focus: '#a78bfa' },
      true,
    ),
  },
};

export const themeNames = Object.keys(themes) as ThemeName[];

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && value in themes;
}

function mergePalette(base: ThemePalette, patch: PartialPalette | undefined): ThemePalette {
  if (!patch) return base;
  const levels = base.levels.map((c, i) => patch.levels?.[i] ?? c) as unknown as ThemePalette['levels'];
  return {
    ...base,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    levels,
    tooltip: { ...base.tooltip, ...patch.tooltip },
  };
}

/** Resolve a preset name or custom theme object into concrete light + dark palettes. */
export function resolveTheme(input: ThemeInput | undefined | null): ResolvedTheme {
  if (!input) return themes.github;
  if (typeof input === 'string') return themes[input] ?? themes.github;
  const base = themes[input.extends ?? 'github'] ?? themes.github;
  const { dark, extends: _extends, ...shared } = input;
  void _extends;
  const light = mergePalette(base.light, shared);
  return { light, dark: mergePalette(mergePalette(base.dark, shared), dark) };
}

/** Parse the `theme` attribute: a preset name or a JSON custom theme. */
export function parseThemeAttribute(value: string | null): ThemeInput | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as CustomTheme;
    } catch {
      return undefined;
    }
  }
  return isThemeName(trimmed) ? trimmed : undefined;
}

/** CSS custom-property names for each palette token. */
const TOKEN_NAMES = [
  'level-0',
  'level-1',
  'level-2',
  'level-3',
  'level-4',
  'side',
  'shadow',
  'plate',
  'text',
  'focus',
  'highlight',
  'tooltip-bg',
  'tooltip-text',
  'tooltip-border',
] as const;

export type ThemeToken = (typeof TOKEN_NAMES)[number];
export const themeTokens: readonly ThemeToken[] = TOKEN_NAMES;

export function paletteToTokens(p: ThemePalette): Record<ThemeToken, string> {
  return {
    'level-0': p.levels[0],
    'level-1': p.levels[1],
    'level-2': p.levels[2],
    'level-3': p.levels[3],
    'level-4': p.levels[4],
    side: p.side,
    shadow: p.shadow,
    plate: p.plate,
    text: p.text,
    focus: p.focus,
    highlight: String(p.highlight),
    'tooltip-bg': p.tooltip.background,
    'tooltip-text': p.tooltip.text,
    'tooltip-border': p.tooltip.border,
  };
}

/**
 * Inline CSS variables for a resolved theme: `--kg-light-*` and `--kg-dark-*`.
 * The stylesheet picks one set depending on the colour scheme, so switching
 * light/dark never needs JavaScript.
 */
export function themeToCssVars(theme: ResolvedTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const scheme of ['light', 'dark'] as const) {
    const tokens = paletteToTokens(theme[scheme]);
    for (const name of TOKEN_NAMES) vars[`--kg-${scheme}-${name}`] = tokens[name];
  }
  return vars;
}
