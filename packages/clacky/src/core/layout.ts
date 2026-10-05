import { addDays, formatMonth, formatWeekday, parseISODate } from './format.js';
import type { ContributionDay, GraphLayout, KeyCell, MonthLabel, WeekdayLabel } from './types.js';

export interface LayoutOptions {
  /** 0 = weeks start on Sunday (GitHub default), 1 = Monday. */
  weekStart?: 0 | 1;
  locale?: string;
  /** `YYYY-MM-DD`; days after it are marked `future`. Defaults to no future days. */
  today?: string;
}

/** Minimum number of columns between two month labels before the earlier one is dropped. */
const MIN_MONTH_GAP = 3;

/**
 * Place days on a 7-row week grid, exactly like GitHub's calendar: one column per
 * week, one row per weekday. The first and last columns may be partial.
 */
export function buildLayout(
  days: readonly ContributionDay[],
  options: LayoutOptions = {},
): GraphLayout {
  const weekStart = options.weekStart ?? 0;
  const { locale, today } = options;

  if (days.length === 0) {
    return {
      cells: [],
      columns: 0,
      rows: 7,
      months: [],
      weekdays: weekdayLabels(weekStart, locale),
      total: 0,
      positions: new Int32Array(0),
      start: '',
      end: '',
    };
  }

  const first = days[0]!;
  const offset = (parseISODate(first.date).getUTCDay() - weekStart + 7) % 7;
  const cells: KeyCell[] = new Array(days.length);
  let total = 0;

  for (let i = 0; i < days.length; i++) {
    const day = days[i]!;
    const slot = offset + i;
    total += day.count;
    cells[i] = {
      ...day,
      index: i,
      col: Math.floor(slot / 7),
      row: slot % 7,
      future: today !== undefined && day.date > today,
    };
  }

  const columns = cells[cells.length - 1]!.col + 1;
  const positions = new Int32Array(columns * 7).fill(-1);
  for (const cell of cells) positions[cell.col * 7 + cell.row] = cell.index;

  return {
    cells,
    columns,
    rows: 7,
    months: monthLabels(cells, columns, locale),
    weekdays: weekdayLabels(weekStart, locale),
    total,
    positions,
    start: first.date,
    end: days[days.length - 1]!.date,
  };
}

function monthLabels(cells: KeyCell[], columns: number, locale?: string): MonthLabel[] {
  const labels: MonthLabel[] = [];
  let previousMonth = '';
  let cursor = 0;
  for (let col = 0; col < columns; col++) {
    // The first day that falls in this column decides which month it belongs to.
    while (cursor < cells.length && cells[cursor]!.col < col) cursor++;
    const cell = cells[cursor];
    if (!cell) break;
    const month = cell.date.slice(0, 7);
    if (month !== previousMonth) {
      labels.push({ label: formatMonth(cell.date, locale), col });
      previousMonth = month;
    }
  }
  // Drop labels that would collide with the next one (GitHub hides the partial first month).
  return labels.filter((label, i) => {
    const next = labels[i + 1];
    return !next || next.col - label.col >= MIN_MONTH_GAP;
  });
}

function weekdayLabels(weekStart: 0 | 1, locale?: string): WeekdayLabel[] {
  // 2023-01-01 was a Sunday: a fixed reference for weekday names.
  const labels: WeekdayLabel[] = [];
  for (let row = 0; row < 7; row++) {
    const weekday = (row + weekStart) % 7;
    if (weekday === 1 || weekday === 3 || weekday === 5) {
      labels.push({ label: formatWeekday(addDays('2023-01-01', weekday), locale), row });
    }
  }
  return labels;
}

/** Look up the cell index at a grid position, or -1. */
export function cellAt(layout: GraphLayout, col: number, row: number): number {
  if (col < 0 || row < 0 || row > 6 || col >= layout.columns) return -1;
  return layout.positions[col * 7 + row] ?? -1;
}

export type NavigationKey =
  'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'PageUp' | 'PageDown';

/**
 * Resolve keyboard navigation on the grid. Left/Right move by week, Up/Down by day,
 * Home/End jump to the first/last day in the row (Ctrl/⌘ = first/last day overall),
 * PageUp/PageDown move four weeks. Future days are skipped.
 */
export function navigate(
  layout: GraphLayout,
  from: number,
  key: NavigationKey,
  modifier = false,
): number {
  const cell = layout.cells[from];
  if (!cell) return from;
  const usable = (index: number) => index >= 0 && !layout.cells[index]!.future;
  const lastUsable = () => {
    for (let i = layout.cells.length - 1; i >= 0; i--) if (usable(i)) return i;
    return from;
  };

  const step = (dc: number, dr: number, repeat = 1) => {
    let { col, row } = cell;
    let found = from;
    for (let n = 0; n < repeat; n++) {
      col += dc;
      row += dr;
      // Skip over empty slots (partial first/last week) in the direction of travel.
      while (col >= 0 && col < layout.columns && row >= 0 && row <= 6) {
        const index = cellAt(layout, col, row);
        if (usable(index)) {
          found = index;
          break;
        }
        if (index >= 0 && layout.cells[index]!.future) return found;
        if (dr !== 0) break;
        col += dc;
      }
    }
    return found;
  };

  switch (key) {
    case 'ArrowLeft':
      return step(-1, 0);
    case 'ArrowRight':
      return step(1, 0);
    case 'ArrowUp':
      return step(0, -1);
    case 'ArrowDown':
      return step(0, 1);
    case 'PageUp':
      return step(-1, 0, 4);
    case 'PageDown':
      return step(1, 0, 4);
    case 'Home': {
      if (modifier) return 0;
      for (let col = 0; col < layout.columns; col++) {
        const index = cellAt(layout, col, cell.row);
        if (usable(index)) return index;
      }
      return from;
    }
    case 'End': {
      if (modifier) return lastUsable();
      for (let col = layout.columns - 1; col >= 0; col--) {
        const index = cellAt(layout, col, cell.row);
        if (usable(index)) return index;
      }
      return from;
    }
  }
}

/** The key that receives focus when tabbing into the grid: today, or the latest past day. */
export function initialFocusIndex(layout: GraphLayout): number {
  for (let i = layout.cells.length - 1; i >= 0; i--) {
    if (!layout.cells[i]!.future) return i;
  }
  return 0;
}

/** Same shape, same alignment: lets wrappers morph levels in place instead of rebuilding keys. */
export function sameGeometry(a: GraphLayout | null, b: GraphLayout | null): boolean {
  if (!a || !b) return false;
  return (
    a.columns === b.columns &&
    a.cells.length === b.cells.length &&
    a.cells[0]?.row === b.cells[0]?.row
  );
}

/** Ratios used by the CSS sizing math. Keep in sync with `styles.ts`. */
export const DAY_LABEL_WIDTH = 1.9;

/**
 * Width of the whole board measured in key sizes, so CSS can solve
 * `keySize = availableWidth / denominator` for responsive scaling.
 */
export function boardDenominator(
  columns: number,
  gapRatio: number,
  showDayLabels: boolean,
): number {
  const labelColumns = showDayLabels ? DAY_LABEL_WIDTH : 0;
  const gaps = Math.max(0, columns - 1) + (showDayLabels ? 1 : 0);
  return Number((columns + labelColumns + gaps * gapRatio).toFixed(4));
}
