export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
}

export interface SampledSpring {
  /** Progress values from 0 → 1 (may overshoot past 1). */
  values: number[];
  /** Total settle time in milliseconds. */
  duration: number;
}

const cache = new Map<string, SampledSpring>();

/**
 * Integrate a damped spring once and sample it, so WAAPI can play real spring
 * physics as plain linear keyframes on the compositor (no JS per frame).
 */
export function sampleSpring({ stiffness = 700, damping = 24, mass = 1 }: SpringConfig = {}): SampledSpring {
  const key = `${stiffness}|${damping}|${mass}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const dt = 1 / 240;
  const raw: number[] = [0];
  let x = 0;
  let v = 0;
  let t = 0;
  // Semi-implicit Euler is plenty accurate at 240Hz for UI springs.
  while (t < 2) {
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * dt;
    x += v * dt;
    t += dt;
    raw.push(x);
    if (Math.abs(x - 1) < 0.0015 && Math.abs(v) < 0.02) break;
  }
  raw[raw.length - 1] = 1;

  // Downsample to ~30 keyframes; plenty for a smooth curve, cheap for WAAPI.
  const target = Math.min(raw.length, 32);
  const values: number[] = [];
  for (let i = 0; i < target; i++) {
    values.push(raw[Math.round((i / (target - 1)) * (raw.length - 1))]!);
  }
  const result = { values, duration: Math.round(t * 1000) };
  cache.set(key, result);
  return result;
}

/** Spring presets tuned for the keycap feel. */
export const springs = {
  /** Key return after release: fast, a hint of overshoot, no wobble. */
  release: { stiffness: 900, damping: 26, mass: 1 },
  /** Keys settling into the plate on entrance. */
  settle: { stiffness: 380, damping: 17, mass: 1 },
  /** Tooltip pop. */
  pop: { stiffness: 520, damping: 30, mass: 1 },
} satisfies Record<string, SpringConfig>;
