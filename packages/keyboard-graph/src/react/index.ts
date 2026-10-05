/**
 * keyboard-graph/react
 *
 *   import { KeyboardGraph } from 'keyboard-graph/react';
 *   <KeyboardGraph username="octocat" theme="ocean" sound="blue" />
 *
 * Requires `react` and `motion` (peer dependencies).
 */
export { KeyboardGraph, type KeyboardGraphProps } from './KeyboardGraph.js';
export {
  useContributions,
  type UseContributionsOptions,
  type UseContributionsResult,
} from './useContributions.js';
export { createMotionAnimator } from './motionAnimator.js';
export type { KeyboardGraphHandle } from '../core/handle.js';
export type { KeyboardGraphOptions, ThemeTransitionOptions } from '../core/options.js';
export type { ContributionDay, KeyPressDetail, LoadDetail, YearSelection } from '../core/types.js';
export type { ThemeInput, ThemeName, CustomTheme } from '../core/theme.js';
export type { SoundOption, SoundPack } from '../audio/engine.js';
export type { SwitchProfile } from '../audio/synth.js';
export { themes, themeNames } from '../core/theme.js';
