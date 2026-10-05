/**
 * keyboard-graph — framework-agnostic core.
 *
 * Data loading, layout, theming, styles, audio and interaction logic. Nothing here
 * touches `window` or `document` at import time, so it is safe to import during SSR.
 *
 *   import { KeyboardGraph } from 'keyboard-graph/react';   // React component
 *   import 'keyboard-graph/element';                         // <keyboard-graph> custom element
 */

export type {
  ColorScheme,
  ContributionDay,
  ContributionInput,
  ContributionLevel,
  ContributionsApiResponse,
  ContributionsFetcher,
  FetcherParams,
  GraphLayout,
  KeyCell,
  KeyPressDetail,
  LoadDetail,
  MonthLabel,
  ReducedMotionSetting,
  ResponsiveMode,
  WeekdayLabel,
  YearSelection,
} from './core/types.js';

export {
  DEFAULT_ENDPOINT,
  KeyboardGraphError,
  buildEndpointUrl,
  clearContributionsCache,
  computeLevels,
  defaultYearOptions,
  isValidUsername,
  loadContributions,
  normalizeContributions,
  parseContributionsPayload,
  parseYear,
  sampleContributions,
  sumContributions,
  type KeyboardGraphErrorCode,
  type LoadContributionsOptions,
  type LoadedContributions,
} from './core/data.js';

export { buildLayout, cellAt, navigate, initialFocusIndex, type LayoutOptions } from './core/layout.js';

export {
  formatAriaLabel,
  formatCount,
  formatTooltipText,
  formatTotal,
  localToday,
  parseISODate,
} from './core/format.js';

export {
  isThemeName,
  paletteToTokens,
  parseThemeAttribute,
  resolveTheme,
  themeNames,
  themeToCssVars,
  themeTokens,
  themes,
  type CustomTheme,
  type ResolvedTheme,
  type ThemeInput,
  type ThemeName,
  type ThemePalette,
  type ThemePreset,
  type ThemeToken,
} from './core/theme.js';

export { keyboardGraphCSS } from './core/styles.js';

export { defaults, type KeyboardGraphOptions, type ThemeTransitionOptions } from './core/options.js';

export {
  createInteractions,
  entranceDelays,
  sweepDelays,
  type InteractionController,
  type ProgrammaticPress,
} from './core/interactions.js';

export { createWaapiAnimator, KEY_TRAVEL, type KeyAnimator, type KeyParts } from './core/animator.js';
export { sampleSpring, springs, type SpringConfig } from './core/spring.js';
export { computeTooltipPosition, type TooltipPosition } from './core/tooltip.js';
export { createGhostTyper, type GhostTypingOptions, type GhostTyper } from './core/ghost.js';

export {
  SwitchAudio,
  isSwitchProfile,
  type SoundOption,
  type SoundPack,
  type SwitchAudioOptions,
} from './audio/engine.js';
export {
  renderStroke,
  renderVariants,
  switchProfiles,
  switchRecipes,
  type StrokePhase,
  type SwitchProfile,
} from './audio/synth.js';

export type { KeyboardGraphHandle } from './core/handle.js';
