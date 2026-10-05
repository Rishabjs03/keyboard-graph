import { describe, expect, it } from 'vitest';
import { computeTooltipPosition } from '../src/core/tooltip';

const viewport = { width: 400, height: 300 };
const tip = { width: 200, height: 30 };

describe('computeTooltipPosition', () => {
  it('centres above the key when there is room', () => {
    const p = computeTooltipPosition({ left: 190, top: 150, width: 20, height: 20 }, tip, viewport);
    expect(p).toEqual({ x: 100, y: 110, placement: 'top', arrowX: 100 });
  });

  it('flips below near the top edge', () => {
    const p = computeTooltipPosition({ left: 190, top: 10, width: 20, height: 20 }, tip, viewport);
    expect(p.placement).toBe('bottom');
    expect(p.y).toBe(40);
  });

  it('clamps horizontally and keeps the arrow on the key', () => {
    const left = computeTooltipPosition({ left: 0, top: 150, width: 20, height: 20 }, tip, viewport);
    expect(left.x).toBe(8);
    expect(left.arrowX).toBe(12);
    const right = computeTooltipPosition({ left: 385, top: 150, width: 10, height: 20 }, tip, viewport);
    expect(right.x).toBe(192);
    expect(right.arrowX).toBe(188);
  });
});
