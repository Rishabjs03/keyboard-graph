export interface GhostTypingOptions {
  /** Average pause between bursts, in ms. Default 2600. */
  interval?: number;
  /** Maximum keys pressed per burst. Default 3. */
  burst?: number;
}

export interface GhostTyper {
  stop(): void;
}

/**
 * Idle "ghost typing": every few seconds a few random keys are pressed softly, as if
 * someone were typing on the graph. It pauses while the graph is off-screen or the
 * tab is hidden, and stops for good on the first real interaction with the page.
 */
export function createGhostTyper(
  target: HTMLElement,
  pressSoftly: (index: number) => void,
  candidates: () => number[],
  { interval = 2600, burst = 3 }: GhostTypingOptions = {},
): GhostTyper {
  let stopped = false;
  let visible = true;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  const tick = () => {
    if (stopped) return;
    const pool = candidates();
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (visible && !hidden && pool.length > 0) {
      const presses = 1 + Math.floor(Math.random() * burst);
      for (let i = 0; i < presses; i++) {
        const index = pool[Math.floor(Math.random() * pool.length)]!;
        // Irregular gaps between presses read as human rhythm.
        later(() => !stopped && pressSoftly(index), i * (110 + Math.random() * 140));
      }
    }
    later(tick, interval * (0.7 + Math.random() * 0.6));
  };

  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === 'function') {
    observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    });
    observer.observe(target);
  }

  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const t of timers) clearTimeout(t);
    timers.clear();
    observer?.disconnect();
    for (const type of events) window.removeEventListener(type, stop, true);
  };
  for (const type of events) window.addEventListener(type, stop, { capture: true, passive: true });

  later(tick, Math.min(1400, interval));
  return { stop };
}
