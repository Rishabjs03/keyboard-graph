import { sampleSpring, springs } from './spring.js';

/** The animated layers of one keycap. */
export interface KeyParts {
  key: HTMLElement;
  cap: HTMLElement;
  shadow: HTMLElement;
}

/**
 * Everything that moves. The core ships a WAAPI implementation (used by the web
 * component); the React wrapper supplies a Motion-powered one. Implementations
 * must only animate `transform` and `opacity` so presses stay on the compositor.
 */
export interface KeyAnimator {
  /** Key travels down and bottoms out; holds until `release`. `depth` 1 = full travel. */
  press(parts: KeyParts, depth: number): void;
  /** Spring back to rest with a subtle overshoot. */
  release(parts: KeyParts, depth: number): void;
  /** A small sympathetic dip on a neighbour of the pressed key. */
  nudge(parts: KeyParts, depth: number, delay: number): void;
  /** Coloured underglow radiating from a point, visible through the gaps between keys. */
  glow(layer: HTMLElement, x: number, y: number, color: string): void;
  /** Staggered drop-in of every key. */
  entrance(keys: readonly HTMLElement[], delays: readonly number[]): void;
  /** Stop and clean up every running animation. */
  cancelAll(): void;
}

export interface AnimatorOptions {
  /** Read on every animation so toggling reduced motion applies immediately. */
  reducedMotion: () => boolean;
}

/** Full key travel, as a percentage of the cap's own height (the skirt is 14% of the key). */
export const KEY_TRAVEL = 13;
const PRESS_MS = 55;
const PRESS_EASE = 'cubic-bezier(.2,.7,.3,1)';
const MAX_GLOWS = 8;

/** Current translateY of an element as a % of its height (reads the live animated value). */
export function currentOffsetPercent(el: HTMLElement): number {
  const transform = getComputedStyle(el).transform;
  if (!transform || transform === 'none') return 0;
  const match = /matrix(?:3d)?\(([^)]+)\)/.exec(transform);
  if (!match) return 0;
  const parts = match[1]!.split(',').map(Number);
  const ty = parts.length === 16 ? parts[13]! : parts[5]!;
  const height = el.offsetHeight || 1;
  return (ty / height) * 100;
}

const pressedCap = (depth: number, p = 1) =>
  `translateY(${(KEY_TRAVEL * depth * p).toFixed(3)}%) scale(${(1 - 0.014 * depth * p).toFixed(4)})`;
const pressedShadow = (depth: number, p = 1) =>
  `translateY(${(-10 * depth * p).toFixed(3)}%) scale(${(1 - 0.06 * depth * p).toFixed(4)}, ${(1 - 0.16 * depth * p).toFixed(4)})`;

export function createWaapiAnimator({ reducedMotion }: AnimatorOptions): KeyAnimator {
  const live = new Set<Animation>();
  const channels = new WeakMap<Element, Animation[]>();
  const held = new WeakSet<Element>();

  const run = (
    el: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
    exclusive = true,
  ) => {
    if (typeof el.animate !== 'function') return null;
    const animation = el.animate(keyframes, options);
    if (exclusive) {
      // Start the new animation before cancelling the old one so there is never a frame
      // where the element snaps back to its un-animated style.
      for (const previous of channels.get(el) ?? []) previous.cancel();
      channels.set(el, [animation]);
    } else {
      channels.set(el, [...(channels.get(el) ?? []), animation]);
    }
    live.add(animation);
    // Cancelling rejects `finished`; nobody awaits it, so keep it from surfacing as unhandled.
    animation.finished?.catch(() => undefined);
    const cleanup = () => {
      live.delete(animation);
      const list = channels.get(el);
      if (list)
        channels.set(
          el,
          list.filter((a) => a !== animation),
        );
    };
    // A forwards-filling animation (a held press) keeps applying its end state after it
    // finishes, so it stays tracked until it is cancelled (on release) or replaced.
    const filling = options.fill === 'forwards' || options.fill === 'both';
    if (!filling) animation.addEventListener('finish', cleanup);
    animation.addEventListener('cancel', cleanup);
    animation.addEventListener('remove', cleanup);
    return animation;
  };

  return {
    press({ cap, shadow }, depth) {
      held.add(cap);
      if (reducedMotion()) {
        run(cap, [{ opacity: 1 }, { opacity: 0.7 }], { duration: 80, fill: 'forwards' });
        return;
      }
      const from = currentOffsetPercent(cap);
      run(
        cap,
        [{ transform: `translateY(${from.toFixed(3)}%)` }, { transform: pressedCap(depth) }],
        { duration: PRESS_MS, easing: PRESS_EASE, fill: 'forwards' },
      );
      run(
        shadow,
        [
          { transform: 'none', opacity: 1 },
          { transform: pressedShadow(depth), opacity: 0.55 },
        ],
        { duration: PRESS_MS, easing: PRESS_EASE, fill: 'forwards' },
      );
    },

    release({ cap, shadow }, depth) {
      held.delete(cap);
      if (reducedMotion()) {
        run(cap, [{ opacity: 0.7 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
        return;
      }
      // Start from wherever the key actually is, so a very fast tap never jumps.
      const from = Math.max(0, currentOffsetPercent(cap)) / KEY_TRAVEL;
      const start = Math.min(depth, from || depth);
      const { values, duration } = sampleSpring(springs.release);
      const last = values.length - 1;
      run(
        cap,
        values.map((p, i) => ({ offset: i / last, transform: pressedCap(start, 1 - p) })),
        { duration, easing: 'linear' },
      );
      run(
        shadow,
        values.map((p, i) => ({
          offset: i / last,
          transform: pressedShadow(start, 1 - p),
          opacity: Math.min(1, 0.55 + 0.45 * p),
        })),
        { duration, easing: 'linear' },
      );
    },

    nudge({ cap }, depth, delay) {
      if (reducedMotion() || held.has(cap) || (channels.get(cap)?.length ?? 0) > 0) return;
      run(
        cap,
        [
          { transform: 'none', offset: 0 },
          { transform: pressedCap(depth), offset: 0.3 },
          { transform: 'none', offset: 1 },
        ],
        { duration: 320, delay, easing: 'cubic-bezier(.3,.7,.4,1)' },
      );
    },

    glow(layer, x, y, color) {
      if (reducedMotion() || typeof document === 'undefined') return;
      const glows = layer.getElementsByClassName('clacky-glow');
      if (glows.length >= MAX_GLOWS) glows[0]?.remove();
      const el = document.createElement('span');
      el.className = 'clacky-glow';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.setProperty('--_gc', color);
      layer.appendChild(el);
      const animation = run(
        el,
        [
          { transform: 'scale(.15)', opacity: 0.75 },
          { transform: 'scale(1)', opacity: 0 },
        ],
        { duration: 700, easing: 'cubic-bezier(.15,.6,.3,1)' },
      );
      if (animation) animation.addEventListener('finish', () => el.remove());
      else el.remove();
    },

    entrance(keys, delays) {
      if (reducedMotion()) return;
      const { values, duration } = sampleSpring(springs.settle);
      const last = values.length - 1;
      const frames = values.map((p, i) => ({
        offset: i / last,
        transform: `translateY(${(-70 * (1 - p)).toFixed(2)}%) scale(${(1 + 0.08 * (1 - p)).toFixed(4)})`,
        opacity: Math.min(1, i / last / 0.2),
      }));
      keys.forEach((key, i) => {
        run(
          key,
          frames,
          { duration, delay: delays[i] ?? 0, easing: 'linear', fill: 'backwards' },
          false,
        );
      });
    },

    cancelAll() {
      for (const animation of live) animation.cancel();
      live.clear();
    },
  };
}
