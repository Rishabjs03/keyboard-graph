import { renderVariants, type StrokePhase, type SwitchProfile, switchProfiles } from './synth.js';

/** Your own recorded samples. URLs are fetched and decoded once, then cached. */
export interface SoundPack {
  down: string[];
  /** Optional; falls back to a softer, higher-pitched `down` sample. */
  up?: string[];
}

export type SoundOption = SwitchProfile | SoundPack | false;

export interface SwitchAudioOptions {
  sound: SoundOption;
  /** 0–1 */
  volume: number;
  muted: boolean;
}

interface BufferSet {
  down: AudioBuffer[];
  up: AudioBuffer[];
}

interface Voice {
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  endsAt: number;
}

const SAMPLE_RATE = 44_100;
const VOICES = 12;
/** ± random detune per stroke, in cents (100 cents = 1 semitone). */
const DETUNE_CENTS = 70;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const g = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

// One AudioContext for the whole page: browsers cap how many may exist, and every
// graph on the page can share it.
let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (sharedContext && sharedContext.state !== 'closed') return sharedContext;
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  try {
    sharedContext = new Ctor({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
  return sharedContext;
}

function makeBuffer(samples: Float32Array, context: BaseAudioContext | null): AudioBuffer | null {
  try {
    const buffer =
      typeof AudioBuffer === 'function'
        ? new AudioBuffer({ length: samples.length, sampleRate: SAMPLE_RATE, numberOfChannels: 1 })
        : context?.createBuffer(1, samples.length, SAMPLE_RATE);
    if (!buffer) return null;
    buffer.getChannelData(0).set(samples);
    return buffer;
  } catch {
    return null;
  }
}

// Rendered/decoded buffers are cached per profile or URL for the page's lifetime,
// so they are produced exactly once no matter how many graphs mount.
const synthCache = new Map<SwitchProfile, BufferSet>();
const sampleCache = new Map<string, Promise<AudioBuffer | null>>();

function synthBuffers(profile: SwitchProfile, context: BaseAudioContext | null): BufferSet | null {
  const cached = synthCache.get(profile);
  if (cached) return cached;
  const build = (phase: StrokePhase) =>
    renderVariants(profile, phase, SAMPLE_RATE)
      .map((samples) => makeBuffer(samples, context))
      .filter((b): b is AudioBuffer => b !== null);
  const set = { down: build('down'), up: build('up') };
  if (set.down.length === 0) return null;
  synthCache.set(profile, set);
  return set;
}

function decodeSample(url: string): Promise<AudioBuffer | null> {
  let pending = sampleCache.get(url);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load sound ${url}`);
      const data = await response.arrayBuffer();
      // An OfflineAudioContext can decode before any user gesture (no autoplay
      // restrictions apply), so samples are ready by the first keypress.
      const OfflineCtor =
        typeof OfflineAudioContext === 'function'
          ? OfflineAudioContext
          : (window as Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext })
              .webkitOfflineAudioContext;
      const decoder = OfflineCtor ? new OfflineCtor(1, 1, SAMPLE_RATE) : getContext();
      if (!decoder) return null;
      return await new Promise<AudioBuffer>((resolve, reject) =>
        decoder.decodeAudioData(data, resolve, reject),
      );
    })().catch(() => {
      sampleCache.delete(url);
      return null;
    });
    sampleCache.set(url, pending);
  }
  return pending;
}

/** True inside (or shortly after) a user gesture. Assumes yes where the API is missing. */
function hasUserActivation(): boolean {
  const activation = (globalThis.navigator as Navigator | undefined)?.userActivation;
  return activation ? activation.isActive : true;
}

export function isSwitchProfile(value: unknown): value is SwitchProfile {
  return typeof value === 'string' && (switchProfiles as string[]).includes(value);
}

/** Parse the `sound` attribute: a profile name, or "false"/"off"/"none" to disable. */
export function parseSoundAttribute(value: string | null): SoundOption {
  if (value === null) return 'brown';
  const v = value.trim().toLowerCase();
  if (v === 'false' || v === 'off' || v === 'none' || v === '0') return false;
  return isSwitchProfile(v) ? v : 'brown';
}

/**
 * Plays keydown/keyup switch sounds with low latency.
 *
 * - The AudioContext is only created inside `unlock()`, which callers invoke from a
 *   user gesture, so autoplay policies are always respected.
 * - Buffers are rendered/decoded once and shared between instances.
 * - A fixed pool of voices plays strokes; under very fast typing the oldest voice is
 *   faded out in 4ms and reused, so sounds never lag, pile up, or cut off abruptly.
 * - Each stroke gets a random detune and gain so repeated presses sound human.
 */
export class SwitchAudio {
  private options: SwitchAudioOptions;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: Voice[] = [];
  private buffers: BufferSet | null = null;
  private loadToken = 0;

  constructor(options: Partial<SwitchAudioOptions> = {}) {
    this.options = { sound: 'brown', volume: 0.5, muted: false, ...options };
  }

  /** Prepare buffers ahead of time (safe before any user gesture). */
  preload(): void {
    void this.loadBuffers();
  }

  private async loadBuffers(): Promise<void> {
    const { sound } = this.options;
    const token = ++this.loadToken;
    if (sound === false) {
      this.buffers = null;
      return;
    }
    if (typeof sound === 'string') {
      this.buffers = synthBuffers(sound, this.context);
      return;
    }
    const [down, up] = await Promise.all([
      Promise.all(sound.down.map(decodeSample)),
      Promise.all((sound.up ?? []).map(decodeSample)),
    ]);
    if (token !== this.loadToken) return;
    const valid = (list: (AudioBuffer | null)[]) =>
      list.filter((b): b is AudioBuffer => b !== null);
    this.buffers = { down: valid(down), up: valid(up) };
  }

  /** Create/resume the AudioContext. Must be called from a user-gesture handler. */
  unlock(): void {
    if (this.options.sound === false || this.options.muted) return;
    if (!this.context) {
      // Creating a context outside a gesture leaves it suspended and makes browsers warn.
      if (!hasUserActivation()) return;
      const context = getContext();
      if (!context) return;
      this.context = context;
      this.master = context.createGain();
      this.master.gain.value = this.options.volume;
      this.master.connect(context.destination);
      this.voices = Array.from({ length: VOICES }, () => {
        const gain = context.createGain();
        gain.connect(this.master!);
        return { gain, source: null, endsAt: 0 };
      });
    }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
    if (!this.buffers) void this.loadBuffers();
  }

  get enabled(): boolean {
    return this.options.sound !== false && !this.options.muted && this.options.volume > 0;
  }

  /** Play one stroke. `velocity` scales loudness (ghost presses use ~0.35). */
  play(phase: StrokePhase, velocity = 1): void {
    const { context, master, buffers } = this;
    if (!this.enabled || !context || !master || !buffers) return;
    if (context.state !== 'running') {
      // Resuming is async. Within a gesture, play once it has resumed; otherwise drop the
      // stroke rather than queueing it to burst out on the next interaction.
      if (context.state === 'suspended' && hasUserActivation()) {
        void context.resume().then(
          () => this.play(phase, velocity),
          () => undefined,
        );
      }
      return;
    }

    let list = buffers[phase];
    let rate = 1;
    let gainScale = 1;
    if (list.length === 0) {
      // Sound packs without up-stroke samples reuse the down samples, softer and brighter.
      list = buffers.down;
      rate = 1.06;
      gainScale = 0.55;
    }
    const buffer = list[Math.floor(Math.random() * list.length)];
    if (!buffer) return;

    const now = context.currentTime;
    let voice = this.voices.find((v) => v.endsAt <= now);
    let start = now;
    if (!voice) {
      voice = this.voices.reduce((oldest, v) => (v.endsAt < oldest.endsAt ? v : oldest));
      // Steal: a 4ms fade avoids the click an abrupt stop would cause.
      const g = voice.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + 0.004);
      voice.source?.stop(now + 0.005);
      start = now + 0.005;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    const cents = (Math.random() * 2 - 1) * DETUNE_CENTS;
    source.playbackRate.value = rate * 2 ** (cents / 1200);
    source.connect(voice.gain);
    const gain = velocity * gainScale * (0.82 + Math.random() * 0.18);
    voice.gain.gain.setValueAtTime(gain, start);
    source.start(start);

    const thisVoice = voice;
    thisVoice.source = source;
    thisVoice.endsAt = start + buffer.duration / source.playbackRate.value;
    source.onended = () => {
      if (thisVoice.source === source) thisVoice.source = null;
      source.disconnect();
    };
  }

  update(options: Partial<SwitchAudioOptions>): void {
    const soundChanged = 'sound' in options && !sameSound(options.sound!, this.options.sound);
    this.options = { ...this.options, ...options };
    if (this.master && this.context) {
      const target = this.options.muted ? 0 : this.options.volume;
      this.master.gain.setTargetAtTime(target, this.context.currentTime, 0.015);
    }
    if (soundChanged) {
      this.buffers = null;
      void this.loadBuffers();
    }
  }

  dispose(): void {
    this.loadToken++;
    for (const voice of this.voices) {
      try {
        voice.source?.stop();
      } catch {
        // Already stopped.
      }
      voice.gain.disconnect();
    }
    this.master?.disconnect();
    this.voices = [];
    this.master = null;
    this.context = null;
    this.buffers = null;
  }
}

function sameSound(a: SoundOption, b: SoundOption): boolean {
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return a === b;
  return a.down.join('|') === b.down.join('|') && (a.up ?? []).join('|') === (b.up ?? []).join('|');
}
