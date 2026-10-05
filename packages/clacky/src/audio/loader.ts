import type { SwitchProfile } from './profiles.js';

/**
 * Each profile's sprite lives in its own module (a base64 MP3 string), loaded
 * with a dynamic import: bundlers emit one small chunk per profile, so a page
 * only downloads the switch it actually uses, and nothing until it is needed.
 */
const modules: Record<SwitchProfile, () => Promise<{ default: string }>> = {
  blue: () => import('./sounds/blue.js'),
  brown: () => import('./sounds/brown.js'),
  red: () => import('./sounds/red.js'),
  cream: () => import('./sounds/cream.js'),
};

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function loadSprite(profile: SwitchProfile): Promise<ArrayBuffer> {
  const { default: data } = await modules[profile]();
  return base64ToBuffer(data);
}
