import { describe, expect, it } from 'vitest';
import { parseSoundAttribute } from '../src/audio/engine';
import { isSwitchProfile, sprites, switchProfiles } from '../src/audio/profiles';
import { sampleSpring, springs } from '../src/core/spring';

const modules = {
  blue: () => import('../src/audio/sounds/blue'),
  brown: () => import('../src/audio/sounds/brown'),
  red: () => import('../src/audio/sounds/red'),
  cream: () => import('../src/audio/sounds/cream'),
};

describe('switch recordings', () => {
  it.each(switchProfiles)('%s has enough clean, ordered strokes', (profile) => {
    const { down, up } = sprites[profile];
    expect(down.length).toBeGreaterThanOrEqual(3);
    expect(up.length).toBeGreaterThanOrEqual(2);
    let cursor = 0;
    for (const [start, duration] of [...down, ...up]) {
      expect(start).toBeGreaterThanOrEqual(cursor);
      expect(duration).toBeGreaterThan(20);
      expect(duration).toBeLessThan(300);
      cursor = start + duration;
    }
  });

  it.each(switchProfiles)('%s ships a small, valid MP3 sprite', async (profile) => {
    const { default: base64 } = await modules[profile]();
    const bytes = Buffer.from(base64, 'base64');
    expect(bytes.length).toBeLessThan(40 * 1024);
    // ID3 tag or an MPEG frame sync at the start.
    const id3 = bytes.subarray(0, 3).toString('latin1') === 'ID3';
    const sync = bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0;
    expect(id3 || sync).toBe(true);
  });

  it('parses the sound attribute', () => {
    expect(parseSoundAttribute('cream')).toBe('cream');
    expect(parseSoundAttribute('off')).toBe(false);
    expect(parseSoundAttribute('false')).toBe(false);
    expect(parseSoundAttribute('weird')).toBe('brown');
    expect(isSwitchProfile('blue')).toBe(true);
    expect(isSwitchProfile('constructor')).toBe(false);
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
