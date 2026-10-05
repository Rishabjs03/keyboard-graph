import type { SwitchProfile } from './profiles.js';

/**
 * CDN (IIFE) build: instead of inlining every profile into the single script, fetch
 * the one in use from jsDelivr, pinned to this exact package version.
 */
declare const __CLACKY_VERSION__: string;

export async function loadSprite(profile: SwitchProfile): Promise<ArrayBuffer> {
  const url = `https://cdn.jsdelivr.net/npm/clacky@${__CLACKY_VERSION__}/sounds/${profile}.mp3`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.arrayBuffer();
}
