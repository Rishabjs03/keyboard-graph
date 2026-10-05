import type { SwitchProfile } from './profiles.js';

/**
 * CDN (IIFE) build: instead of inlining every profile into the single script, fetch
 * the one in use from a public npm CDN, pinned to this exact package version.
 * jsDelivr is tried first; if it errors, returns a non-OK status or stalls, unpkg
 * serves the same file from the same npm tarball.
 */
declare const __CLACKY_VERSION__: string | undefined;

const VERSION = typeof __CLACKY_VERSION__ === 'string' ? __CLACKY_VERSION__ : 'latest';
const ATTEMPT_TIMEOUT_MS = 6_000;

export const soundCdns = [
  (profile: SwitchProfile) =>
    `https://cdn.jsdelivr.net/npm/clacky@${VERSION}/sounds/${profile}.mp3`,
  (profile: SwitchProfile) => `https://unpkg.com/clacky@${VERSION}/sounds/${profile}.mp3`,
];

async function fetchWithTimeout(url: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${url} responded with ${response.status}`);
    return await response.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}

export async function loadSprite(profile: SwitchProfile): Promise<ArrayBuffer> {
  let lastError: unknown;
  for (const cdn of soundCdns) {
    try {
      return await fetchWithTimeout(cdn(profile));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to load ${profile} sounds`);
}
