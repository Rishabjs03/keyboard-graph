import type { ProgrammaticPress } from './interactions.js';
import type { ContributionDay } from './types.js';

/**
 * Imperative API, available as a React ref and as methods on the
 * `<keyboard-graph>` element.
 */
export interface KeyboardGraphHandle {
  /** Press a key by ISO date (`'2026-08-12'`) or by day index. */
  press(target: string | number, options?: ProgrammaticPress): void;
  /** Press the key at a grid position (column = week, row = weekday). */
  pressAt(col: number, row: number, options?: ProgrammaticPress): void;
  /** Move keyboard focus to a day. */
  focusDay(target: string | number): void;
  /** Replay the entrance wave. */
  replayEntrance(): void;
  /** The currently rendered days. */
  getDays(): ContributionDay[];
  /** Number of week columns currently rendered. */
  getColumns(): number;
}
