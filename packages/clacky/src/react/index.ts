/**
 * clacky/react
 *
 *   import { Clacky } from 'clacky/react';
 *   <Clacky username="octocat" theme="ocean" sound="blue" />
 *
 * Requires `react` and `motion` (peer dependencies).
 */
export { Clacky, type ClackyProps } from './Clacky.js';
export {
  useContributions,
  type UseContributionsOptions,
  type UseContributionsResult,
} from './useContributions.js';
export { createMotionAnimator } from './motionAnimator.js';
export type { ClackyHandle } from '../core/handle.js';
export type { ClackyOptions, ThemeTransitionOptions } from '../core/options.js';
export type { ContributionDay, KeyPressDetail, LoadDetail, YearSelection } from '../core/types.js';
export type { ThemeInput, ThemeName, CustomTheme } from '../core/theme.js';
export type { SoundOption, SoundPack } from '../audio/engine.js';
export type { SwitchProfile } from '../audio/profiles.js';
export { themes, themeNames } from '../core/theme.js';
