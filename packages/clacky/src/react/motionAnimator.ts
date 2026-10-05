import { animate } from 'motion/react';
import { KEY_TRAVEL, type AnimatorOptions, type KeyAnimator } from '../core/animator.js';
import { springs } from '../core/spring.js';

type Controls = ReturnType<typeof animate>;

const PRESS = { duration: 0.055, ease: [0.2, 0.7, 0.3, 1] as const };
const MAX_GLOWS = 8;

const capAt = (depth: number) =>
  `translateY(${(KEY_TRAVEL * depth).toFixed(3)}%) scale(${(1 - 0.014 * depth).toFixed(4)})`;
const shadowAt = (depth: number) =>
  `translateY(${(-10 * depth).toFixed(3)}%) scale(${(1 - 0.06 * depth).toFixed(4)}, ${(1 - 0.16 * depth).toFixed(4)})`;
const REST = 'translateY(0%) scale(1)';
const SHADOW_REST = 'translateY(0%) scale(1, 1)';

/**
 * Motion-powered keycap animations for the React wrapper. Uses full `transform`
 * strings so Motion can hand springs to the browser as hardware-accelerated
 * WAAPI animations (springs become `linear()` easing curves).
 */
export function createMotionAnimator({ reducedMotion }: AnimatorOptions): KeyAnimator {
  const live = new Set<Controls>();
  const busy = new WeakSet<Element>();

  const track = (controls: Controls, el?: Element) => {
    live.add(controls);
    if (el) busy.add(el);
    void controls.finished.then(
      () => {
        live.delete(controls);
        if (el) busy.delete(el);
      },
      () => live.delete(controls),
    );
    return controls;
  };

  return {
    press({ cap, shadow }, depth) {
      busy.add(cap);
      if (reducedMotion()) {
        track(animate(cap, { opacity: 0.7 }, { duration: 0.08 }));
        return;
      }
      track(animate(cap, { transform: capAt(depth) }, PRESS));
      track(animate(shadow, { transform: shadowAt(depth), opacity: 0.55 }, PRESS));
    },

    release({ cap, shadow }) {
      if (reducedMotion()) {
        track(animate(cap, { opacity: 1 }, { duration: 0.16, ease: 'easeOut' }), cap);
        return;
      }
      const spring = { type: 'spring' as const, ...springs.release };
      track(animate(cap, { transform: REST }, spring), cap);
      track(animate(shadow, { transform: SHADOW_REST, opacity: 1 }, spring));
    },

    nudge({ cap }, depth, delay) {
      if (reducedMotion() || busy.has(cap)) return;
      track(
        animate(
          cap,
          { transform: [REST, capAt(depth), REST] },
          { duration: 0.32, delay: delay / 1000, times: [0, 0.3, 1], ease: [0.3, 0.7, 0.4, 1] },
        ),
        cap,
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
      const controls = animate(
        el,
        { transform: ['scale(0.15)', 'scale(1)'], opacity: [0.75, 0] },
        { duration: 0.7, ease: [0.15, 0.6, 0.3, 1] },
      );
      track(controls);
      void controls.finished.then(
        () => el.remove(),
        () => el.remove(),
      );
    },

    entrance(keys, delays) {
      if (reducedMotion() || keys.length === 0) return;
      const list: HTMLElement[] = [];
      const seconds: number[] = [];
      keys.forEach((key, i) => {
        if (!key) return;
        list.push(key);
        seconds.push((delays[i] ?? 0) / 1000);
      });
      const delayOf = (i: number) => seconds[i] ?? 0;
      // Transform springs into place; opacity is a short tween so it never overshoots.
      const drop = track(
        animate(
          list,
          { transform: ['translateY(-70%) scale(1.08)', REST] },
          { type: 'spring', ...springs.settle, delay: (i) => delayOf(i) },
        ),
      );
      const fade = track(
        animate(
          list,
          { opacity: [0, 1] },
          { duration: 0.18, ease: 'easeOut', delay: (i) => delayOf(i) },
        ),
      );
      // Motion commits final values as inline styles; drop them so the stylesheet's
      // hover lift (a transform on the key) keeps working.
      void Promise.all([drop.finished, fade.finished]).then(
        () => {
          for (const key of list) {
            key.style.removeProperty('transform');
            key.style.removeProperty('opacity');
          }
        },
        () => undefined,
      );
    },

    cancelAll() {
      for (const controls of live) controls.stop();
      live.clear();
    },
  };
}
