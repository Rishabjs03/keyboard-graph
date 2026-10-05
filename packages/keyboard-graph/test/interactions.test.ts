import { describe, expect, it, vi } from 'vitest';
import type { KeyAnimator } from '../src/core/animator';
import { normalizeContributions } from '../src/core/data';
import { createInteractions } from '../src/core/interactions';
import { buildLayout } from '../src/core/layout';
import { boardHTML } from '../src/core/render';
import { withDefaults } from '../src/core/options';

function setup() {
  const layout = buildLayout(
    normalizeContributions([{ date: '2026-03-01', count: 3 }], { year: 2026 }),
  );
  const host = document.createElement('div');
  host.innerHTML = boardHTML(layout, withDefaults({}), { label: 'test', hintId: 'hint' });
  document.body.appendChild(host);
  const grid = host.querySelector<HTMLElement>('.kg-grid')!;
  const animator: KeyAnimator = {
    press: vi.fn(),
    release: vi.fn(),
    nudge: vi.fn(),
    glow: vi.fn(),
    entrance: vi.fn(),
    cancelAll: vi.fn(),
  };
  const onPress = vi.fn();
  const controller = createInteractions({
    grid,
    fx: null,
    layout,
    animator,
    audio: null,
    ripple: false,
    tooltip: false,
    onPress,
  });
  return { layout, host, grid, animator, onPress, controller };
}

describe('interaction controller', () => {
  it('releases a key only when every overlapping hold has ended', async () => {
    vi.useFakeTimers();
    const { grid, animator, controller, host } = setup();
    const key = grid.querySelector<HTMLElement>('.kg-key[data-i="10"]')!;
    key.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
      }),
    );
    controller.press(10, { sound: false, hold: 50 });
    expect(animator.press).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60);
    expect(animator.release).not.toHaveBeenCalled(); // the pointer is still holding it
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'mouse' }));
    expect(animator.release).toHaveBeenCalledTimes(1);
    controller.destroy();
    host.remove();
    vi.useRealTimers();
  });

  it('keeps exactly one tabbable key and moves it with the arrow keys', () => {
    const { grid, controller, host, onPress } = setup();
    const tabbable = () =>
      [...grid.querySelectorAll<HTMLElement>('.kg-key')].filter((k) => k.tabIndex === 0);
    expect(tabbable()).toHaveLength(1);
    const start = tabbable()[0]!;
    start.focus();
    start.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(tabbable()).toHaveLength(1);
    expect(tabbable()[0]).not.toBe(start);
    tabbable()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ source: 'keyboard' }));
    controller.destroy();
    host.remove();
  });
});
