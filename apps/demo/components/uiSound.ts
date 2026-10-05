'use client';

import { SwitchAudio, type SoundOption } from 'keyboard-graph';

/**
 * The demo's controls click with the same synthesised switch as the graph, so the
 * whole page feels like one keyboard. One shared instance, created lazily.
 */
let audio: SwitchAudio | null = null;
let settings: { sound: SoundOption; volume: number; muted: boolean } = {
  sound: 'brown',
  volume: 0.5,
  muted: false,
};

export function configureUiSound(next: typeof settings) {
  settings = next;
  audio?.update({ ...next, volume: next.volume * 0.6 });
}

export function uiClick() {
  if (typeof window === 'undefined') return;
  if (!audio) {
    audio = new SwitchAudio({ ...settings, volume: settings.volume * 0.6 });
    audio.preload();
  }
  audio.unlock();
  audio.play('down', 0.7);
  setTimeout(() => audio?.play('up', 0.7), 70);
}
