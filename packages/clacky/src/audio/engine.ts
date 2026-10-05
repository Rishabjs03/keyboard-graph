import { loadSprite } from './loader.js';
import {
  isSwitchProfile,
  sprites,
  type StrokePhase,
  type StrokeSlice,
  type SwitchProfile,
} from './profiles.js';

/** Your own recorded samples. URLs are fetched and decoded once, then cached. */
export interface SoundPack {
  down: string[];
  /** Optional; falls back to a softer, slightly higher `down` sample. */
  up?: string[];
}

export type SoundOption = SwitchProfile | SoundPack | false;

export interface SwitchAudioOptions {
  sound: SoundOption;
  /** 0 to 1 */
  volume: number;
  muted: boolean;
}

/** One playable stroke: a region of a decoded buffer. */
interface Stroke {
  buffer: AudioBuffer;
  offset: number;
  duration: number;
}

interface StrokeSet {
  down: Stroke[];
  up: Stroke[];
}

interface Voice {
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  endsAt: number;
}

const DECODE_RATE = 44_100;
const VOICES = 12;
/** Random detune per stroke, in cents. Small: these are real recordings. */
const DETUNE_CENTS = 35;

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

/** True inside (or shortly after) a user gesture. Assumes yes where the API is missing. */
function hasUserActivation(): boolean {
  const activation = (globalThis.navigator as Navigator | undefined)?.userActivation;
  return activation ? activation.isActive : true;
}

/**
 * Decode with an OfflineAudioContext: allowed before any user gesture, so sounds
 * are ready by the first keypress without ever creating a live AudioContext early.
 */
async function decode(data: ArrayBuffer): Promise<AudioBuffer | null> {
  const g = globalThis as {
    OfflineAudioContext?: typeof OfflineAudioContext;
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  };
  const Offline = g.OfflineAudioContext ?? g.webkitOfflineAudioContext;
  const decoder: BaseAudioContext | null = Offline ? new Offline(1, 1, DECODE_RATE) : getContext();
  if (!decoder) return null;
  return new Promise<AudioBuffer>((resolve, reject) =>
    decoder.decodeAudioData(data, resolve, reject),
  );
}

/**
 * MP3 decoders add a few milliseconds of padding, and how much differs between
 * browsers. Re-detect each stroke's real onset in the decoded audio so playback
 * starts exactly on the transient: no clipped attack, no added latency.
 */
function locate(buffer: AudioBuffer, [startMs, durationMs]: StrokeSlice): Stroke {
  const data = buffer.getChannelData(0);
  const rate = buffer.sampleRate;
  const from = Math.max(0, Math.floor(((startMs - 40) / 1000) * rate));
  const to = Math.min(data.length, Math.floor(((startMs + durationMs) / 1000) * rate));
  let peak = 0;
  for (let i = from; i < to; i++) peak = Math.max(peak, Math.abs(data[i]!));
  let onset = Math.floor((startMs / 1000) * rate);
  for (let i = from; i < to; i++) {
    if (Math.abs(data[i]!) > peak * 0.12) {
      onset = i;
      break;
    }
  }
  const offset = Math.max(0, onset / rate - 0.002);
  return {
    buffer,
    offset,
    duration: Math.min(durationMs / 1000 + 0.004, buffer.duration - offset),
  };
}

// Decoded audio is cached per profile / URL for the page's lifetime, so it is
// fetched and decoded exactly once no matter how many graphs mount.
const profileCache = new Map<SwitchProfile, Promise<StrokeSet | null>>();
const sampleCache = new Map<string, Promise<AudioBuffer | null>>();

function loadProfile(profile: SwitchProfile): Promise<StrokeSet | null> {
  let pending = profileCache.get(profile);
  if (!pending) {
    pending = loadSprite(profile)
      .then(decode)
      .then((buffer) => {
        if (!buffer) return null;
        const sprite = sprites[profile];
        return {
          down: sprite.down.map((slice) => locate(buffer, slice)),
          up: sprite.up.map((slice) => locate(buffer, slice)),
        };
      })
      .catch(() => {
        profileCache.delete(profile);
        return null;
      });
    profileCache.set(profile, pending);
  }
  return pending;
}

function loadSample(url: string): Promise<AudioBuffer | null> {
  let pending = sampleCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load sound ${url}`);
        return response.arrayBuffer();
      })
      .then(decode)
      .catch(() => {
        sampleCache.delete(url);
        return null;
      });
    sampleCache.set(url, pending);
  }
  return pending;
}

const whole = (buffer: AudioBuffer): Stroke => ({ buffer, offset: 0, duration: buffer.duration });

export { isSwitchProfile };

/** Parse the `sound` attribute: a profile name, or "false"/"off"/"none" to disable. */
export function parseSoundAttribute(value: string | null): SoundOption {
  if (value === null) return 'brown';
  const v = value.trim().toLowerCase();
  if (v === 'false' || v === 'off' || v === 'none' || v === '0') return false;
  return isSwitchProfile(v) ? v : 'brown';
}

/**
 * Plays real keydown/keyup switch recordings with low latency.
 *
 * - The AudioContext is only created inside `unlock()` during a user gesture, so
 *   autoplay policies are always respected.
 * - A profile's sprite is downloaded and decoded once (lazily, or on `preload()`)
 *   and shared by every graph on the page.
 * - A fixed pool of voices plays strokes; under very fast typing the oldest voice is
 *   faded out in 4 ms and reused, so sounds never lag, pile up, or cut off abruptly.
 * - Each stroke gets a random sample, a slight detune and a gain variation, so
 *   repeated presses sound human.
 */
export class SwitchAudio {
  private options: SwitchAudioOptions;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices: Voice[] = [];
  private strokes: StrokeSet | null = null;
  private loadToken = 0;
  private lastPick: Record<StrokePhase, number> = { down: -1, up: -1 };

  constructor(options: Partial<SwitchAudioOptions> = {}) {
    this.options = { sound: 'brown', volume: 0.5, muted: false, ...options };
  }

  /** Fetch and decode the current profile ahead of time (safe before any gesture). */
  preload(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const { sound } = this.options;
    const token = ++this.loadToken;
    if (sound === false) {
      this.strokes = null;
      return;
    }
    let strokes: StrokeSet | null;
    if (typeof sound === 'string') {
      strokes = await loadProfile(sound);
    } else {
      const [down, up] = await Promise.all([
        Promise.all(sound.down.map(loadSample)),
        Promise.all((sound.up ?? []).map(loadSample)),
      ]);
      const valid = (list: (AudioBuffer | null)[]) =>
        list.filter((b): b is AudioBuffer => b !== null).map(whole);
      strokes = { down: valid(down), up: valid(up) };
    }
    if (token === this.loadToken) this.strokes = strokes;
  }

  /** Create/resume the AudioContext. Call from a user-gesture handler. */
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
    if (!this.strokes) void this.load();
  }

  get enabled(): boolean {
    return this.options.sound !== false && !this.options.muted && this.options.volume > 0;
  }

  /** Pick a random stroke, avoiding an immediate repeat of the same sample. */
  private pick(list: Stroke[], phase: StrokePhase): Stroke | undefined {
    if (list.length <= 1) return list[0];
    let index = Math.floor(Math.random() * list.length);
    if (index === this.lastPick[phase]) index = (index + 1) % list.length;
    this.lastPick[phase] = index;
    return list[index];
  }

  /** Play one stroke. `velocity` scales loudness (soft presses use ~0.35). */
  play(phase: StrokePhase, velocity = 1): void {
    const { context, master, strokes } = this;
    if (!this.enabled || !context || !master || !strokes) return;
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

    let list = strokes[phase];
    let rate = 1;
    let gainScale = 1;
    if (list.length === 0) {
      // Packs without up-stroke samples reuse the down samples, softer and brighter.
      list = strokes.down;
      rate = 1.05;
      gainScale = 0.5;
    }
    const stroke = this.pick(list, phase);
    if (!stroke) return;

    const now = context.currentTime;
    let voice = this.voices.find((v) => v.endsAt <= now);
    let start = now;
    if (!voice) {
      voice = this.voices.reduce((oldest, v) => (v.endsAt < oldest.endsAt ? v : oldest));
      // Steal: a 4 ms fade avoids the click an abrupt stop would cause.
      const g = voice.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + 0.004);
      voice.source?.stop(now + 0.005);
      start = now + 0.005;
    }

    const source = context.createBufferSource();
    source.buffer = stroke.buffer;
    const cents = (Math.random() * 2 - 1) * DETUNE_CENTS;
    source.playbackRate.value = rate * 2 ** (cents / 1200);
    source.connect(voice.gain);
    voice.gain.gain.setValueAtTime(velocity * gainScale * (0.86 + Math.random() * 0.14), start);
    source.start(start, stroke.offset, stroke.duration);

    const thisVoice = voice;
    thisVoice.source = source;
    thisVoice.endsAt = start + stroke.duration / source.playbackRate.value;
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
      this.strokes = null;
      void this.load();
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
    this.strokes = null;
  }
}

function sameSound(a: SoundOption, b: SoundOption): boolean {
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return a === b;
  return a.down.join('|') === b.down.join('|') && (a.up ?? []).join('|') === (b.up ?? []).join('|');
}
