import { manifest } from './sounds/manifest.js';

/** The four switch characters. Each one is a set of real CC0 recordings. */
export type SwitchProfile = 'blue' | 'brown' | 'red' | 'cream';
export type StrokePhase = 'down' | 'up';

/** `[startMs, durationMs]` of one stroke inside a profile's sprite. */
export type StrokeSlice = readonly [number, number];

export interface SpriteManifest {
  down: readonly StrokeSlice[];
  up: readonly StrokeSlice[];
}

export const switchProfiles: readonly SwitchProfile[] = ['blue', 'brown', 'red', 'cream'];

export const sprites: Record<SwitchProfile, SpriteManifest> = manifest;

export function isSwitchProfile(value: unknown): value is SwitchProfile {
  return typeof value === 'string' && (switchProfiles as readonly string[]).includes(value);
}
