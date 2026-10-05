import { describe, expect, it } from 'vitest';
import { parseSoundAttribute } from '../src/audio/engine';
import { renderStroke, renderVariants, switchProfiles, switchRecipes } from '../src/audio/synth';
import { sampleSpring, springs } from '../src/core/spring';

describe('switch synthesis', () => {
  it.each(switchProfiles)('renders clean %s strokes', (profile) => {
    for (const phase of ['down', 'up'] as const) {
      const samples = renderStroke(switchRecipes[profile][phase], 44_100);
      let peak = 0;
      for (const s of samples) {
        expect(Number.isFinite(s)).toBe(true);
        peak = Math.max(peak, Math.abs(s));
      }
      expect(peak).toBeGreaterThan(0.3);
      expect(peak).toBeLessThanOrEqual(1);
      expect(samples.length / 44_100).toBeLessThan(0.31);
      // Ends in silence (no click at the end of the buffer).
      expect(Math.abs(samples[samples.length - 1]!)).toBeLessThan(0.01);
    }
  });

  it('produces distinct variants', () => {
    const [a, b] = renderVariants('blue', 'down', 44_100, 2);
    expect(a!.length === b!.length && a!.every((v, i) => v === b![i])).toBe(false);
  });

  it('parses the sound attribute', () => {
    expect(parseSoundAttribute('cream')).toBe('cream');
    expect(parseSoundAttribute('off')).toBe(false);
    expect(parseSoundAttribute('false')).toBe(false);
    expect(parseSoundAttribute('weird')).toBe('brown');
  });
});

describe('springs', () => {
  it('overshoots slightly and settles at 1', () => {
    const { values, duration } = sampleSpring(springs.release);
    expect(values[0]).toBe(0);
    expect(values.at(-1)).toBe(1);
    const peak = Math.max(...values);
    expect(peak).toBeGreaterThan(1.05);
    expect(peak).toBeLessThan(1.4);
    expect(duration).toBeLessThan(800);
  });
});
