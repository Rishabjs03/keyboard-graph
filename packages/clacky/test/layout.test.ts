import { describe, expect, it } from 'vitest';
import { normalizeContributions } from '../src/core/data';
import {
  boardDenominator,
  buildLayout,
  cellAt,
  initialFocusIndex,
  navigate,
  sameGeometry,
} from '../src/core/layout';

const year2026 = normalizeContributions([{ date: '2026-05-05', count: 1 }], { year: 2026 });

describe('buildLayout', () => {
  it('places days on a 7-row week grid (Sunday start)', () => {
    const layout = buildLayout(year2026);
    // 2026-01-01 is a Thursday → row 4 of the first column.
    expect(layout.cells[0]).toMatchObject({ col: 0, row: 4 });
    expect(layout.columns).toBe(53);
    expect(layout.rows).toBe(7);
    expect(layout.total).toBe(1);
    expect(cellAt(layout, 0, 3)).toBe(-1);
    expect(cellAt(layout, 0, 4)).toBe(0);
  });

  it('supports Monday-start weeks', () => {
    const layout = buildLayout(year2026, { weekStart: 1 });
    expect(layout.cells[0]).toMatchObject({ col: 0, row: 3 });
    expect(layout.weekdays.map((w) => w.label)).toEqual(['Mon', 'Wed', 'Fri']);
    expect(layout.weekdays.map((w) => w.row)).toEqual([0, 2, 4]);
  });

  it('labels months without collisions', () => {
    const layout = buildLayout(year2026);
    expect(layout.months.map((m) => m.label)).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]);
    for (let i = 1; i < layout.months.length; i++) {
      expect(layout.months[i]!.col - layout.months[i - 1]!.col).toBeGreaterThanOrEqual(3);
    }
  });

  it('marks future days and focuses the latest past day', () => {
    const layout = buildLayout(year2026, { today: '2026-10-05' });
    const future = layout.cells.filter((c) => c.future);
    expect(future[0]!.date).toBe('2026-10-06');
    expect(layout.cells[initialFocusIndex(layout)]!.date).toBe('2026-10-05');
  });

  it('handles empty input', () => {
    const layout = buildLayout([]);
    expect(layout.columns).toBe(0);
    expect(layout.cells).toEqual([]);
  });
});

describe('navigate', () => {
  const layout = buildLayout(year2026, { today: '2026-10-05' });
  const index = (date: string) => layout.cells.findIndex((c) => c.date === date);

  it('moves by week horizontally and by day vertically', () => {
    const start = index('2026-03-11');
    expect(layout.cells[navigate(layout, start, 'ArrowRight')]!.date).toBe('2026-03-18');
    expect(layout.cells[navigate(layout, start, 'ArrowLeft')]!.date).toBe('2026-03-04');
    expect(layout.cells[navigate(layout, start, 'ArrowDown')]!.date).toBe('2026-03-12');
    expect(layout.cells[navigate(layout, start, 'ArrowUp')]!.date).toBe('2026-03-10');
    expect(layout.cells[navigate(layout, start, 'PageDown')]!.date).toBe('2026-04-08');
  });

  it('does not wrap rows or enter empty / future slots', () => {
    const first = 0; // Thursday Jan 1, row 4
    expect(navigate(layout, first, 'ArrowLeft')).toBe(first);
    const sat = index('2026-01-03');
    expect(navigate(layout, sat, 'ArrowDown')).toBe(sat);
    const today = index('2026-10-05');
    expect(navigate(layout, today, 'ArrowDown')).toBe(today);
    expect(navigate(layout, today, 'ArrowRight')).toBe(today);
  });

  it('jumps with Home/End', () => {
    const start = index('2026-06-10');
    expect(layout.cells[navigate(layout, start, 'Home')]!.date).toBe('2026-01-07');
    expect(navigate(layout, start, 'Home', true)).toBe(0);
    expect(layout.cells[navigate(layout, start, 'End', true)]!.date).toBe('2026-10-05');
  });
});

describe('geometry helpers', () => {
  it('detects identical geometry', () => {
    const a = buildLayout(year2026);
    const b = buildLayout(
      normalizeContributions([{ date: '2026-02-02', count: 9 }], { year: 2026 }),
    );
    const c = buildLayout(
      normalizeContributions([{ date: '2025-02-02', count: 9 }], { year: 2025 }),
    );
    expect(sameGeometry(a, b)).toBe(true);
    expect(sameGeometry(a, c)).toBe(false);
  });

  it('computes the CSS sizing denominator', () => {
    expect(boardDenominator(53, 0.25, true)).toBe(68.15);
    expect(boardDenominator(53, 0.25, false)).toBe(66);
  });
});
