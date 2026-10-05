/**
 * Procedural mechanical-switch sounds.
 *
 * Every sound is synthesised from scratch (filtered noise bursts + damped
 * resonances), so the library ships no audio samples and carries no licensing
 * baggage: the generated audio is original and covered by the MIT licence.
 *
 * A keystroke is modelled as a few physical events layered in time:
 *   • the click leaf / tactile bump (blue, brown): a bright, very short transient
 *   • the bottom-out: the stem hitting the housing — a "clack" (1–2 kHz noise ring)
 *     plus a low "thock" body (a pitched resonance that drops slightly as it decays)
 *   • the upstroke / top-out: a softer, shorter version on release
 */

export type SwitchProfile = 'blue' | 'brown' | 'red' | 'cream';
export type StrokePhase = 'down' | 'up';

type FilterType = 'bandpass' | 'lowpass' | 'highpass';

interface NoiseLayer {
  kind: 'noise';
  /** Onset in seconds from the start of the stroke. */
  at: number;
  filter: FilterType;
  freq: number;
  q: number;
  attack: number;
  /** Exponential decay time constant in seconds. */
  decay: number;
  gain: number;
}

interface ToneLayer {
  kind: 'tone';
  at: number;
  freq: number;
  /** Fractional pitch drop at onset (0.3 = starts 30% sharp), recovering over `dropTime`. */
  drop?: number;
  dropTime?: number;
  attack?: number;
  decay: number;
  gain: number;
}

type Layer = NoiseLayer | ToneLayer;

export interface StrokeRecipe {
  layers: Layer[];
  /** Peak amplitude after normalisation. Up-strokes are quieter than down-strokes. */
  peak: number;
}

const noise = (at: number, filter: FilterType, freq: number, q: number, decay: number, gain: number, attack = 0.0005): NoiseLayer => ({
  kind: 'noise', at, filter, freq, q, attack, decay, gain,
});
const tone = (at: number, freq: number, decay: number, gain: number, drop = 0, dropTime = 0.012): ToneLayer => ({
  kind: 'tone', at, freq, decay, gain, drop, dropTime, attack: 0.0004,
});

export const switchRecipes: Record<SwitchProfile, Record<StrokePhase, StrokeRecipe>> = {
  // Clicky: a sharp click-leaf snap, then a bright bottom-out ~14ms later.
  blue: {
    down: {
      peak: 0.95,
      layers: [
        noise(0, 'bandpass', 5200, 2.2, 0.0025, 1, 0.0003),
        noise(0, 'bandpass', 3000, 1.2, 0.006, 0.6, 0.0003),
        tone(0, 3400, 0.004, 0.12),
        noise(0.014, 'bandpass', 1800, 1, 0.012, 0.55),
        tone(0.014, 520, 0.016, 0.3, 0.25, 0.01),
        noise(0.014, 'lowpass', 400, 0.7, 0.02, 0.35, 0.001),
      ],
    },
    up: {
      peak: 0.7,
      layers: [
        noise(0, 'bandpass', 4600, 2, 0.0025, 0.9, 0.0003),
        noise(0, 'bandpass', 2600, 1.1, 0.005, 0.5, 0.0003),
        noise(0.008, 'bandpass', 1500, 1, 0.008, 0.3),
      ],
    },
  },
  // Tactile: a soft scratchy bump, then a mid-pitched bottom-out.
  brown: {
    down: {
      peak: 0.9,
      layers: [
        noise(0, 'bandpass', 2200, 0.9, 0.006, 0.25, 0.002),
        noise(0.009, 'bandpass', 1400, 0.9, 0.016, 0.8, 0.0006),
        tone(0.009, 380, 0.022, 0.5, 0.3, 0.012),
        noise(0.009, 'lowpass', 320, 0.8, 0.025, 0.45, 0.001),
        tone(0.009, 1350, 0.007, 0.1),
      ],
    },
    up: {
      peak: 0.55,
      layers: [
        noise(0, 'bandpass', 1900, 1, 0.01, 0.6),
        tone(0, 600, 0.012, 0.25),
        noise(0, 'lowpass', 500, 0.7, 0.012, 0.3),
      ],
    },
  },
  // Linear: no bump, just a rounded, thocky bottom-out.
  red: {
    down: {
      peak: 0.9,
      layers: [
        noise(0, 'bandpass', 1000, 0.8, 0.02, 0.75, 0.0008),
        tone(0, 260, 0.03, 0.65, 0.35, 0.012),
        noise(0, 'lowpass', 260, 0.8, 0.03, 0.55, 0.001),
        tone(0, 900, 0.01, 0.12),
      ],
    },
    up: {
      peak: 0.5,
      layers: [noise(0, 'bandpass', 1400, 0.9, 0.011, 0.55), tone(0, 480, 0.013, 0.22)],
    },
  },
  // Deep thock: low body resonance, highs strongly damped.
  cream: {
    down: {
      peak: 0.95,
      layers: [
        noise(0, 'lowpass', 520, 0.9, 0.04, 1, 0.0012),
        tone(0, 165, 0.05, 0.8, 0.45, 0.015),
        tone(0, 105, 0.06, 0.4),
        noise(0, 'bandpass', 700, 1.1, 0.018, 0.35),
        tone(0, 620, 0.01, 0.07),
      ],
    },
    up: {
      peak: 0.5,
      layers: [noise(0, 'lowpass', 800, 0.8, 0.018, 0.55, 0.0008), tone(0, 330, 0.02, 0.3, 0.2)],
    },
  },
};

export const switchProfiles = Object.keys(switchRecipes) as SwitchProfile[];

/** Small deterministic PRNG (mulberry32) so variants are reproducible. */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** RBJ audio-EQ-cookbook coefficients, normalised by a0. */
function biquad(type: FilterType, freq: number, q: number, sampleRate: number): Biquad {
  const w0 = (2 * Math.PI * Math.min(freq, sampleRate * 0.45)) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  let b0: number, b1: number, b2: number;
  if (type === 'lowpass') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = (1 - cos) / 2;
  } else if (type === 'highpass') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = (1 + cos) / 2;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

function filterInPlace(buf: Float32Array, c: Biquad): void {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x0 = buf[i]!;
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    buf[i] = y0;
  }
}

/** Seconds until an exponential decay falls below -60dB (ln(1000) ≈ 6.9 time constants). */
const tail = (layer: Layer) => layer.at + (layer.attack ?? 0) + layer.decay * 6.9;

function envelope(t: number, attack: number, decay: number): number {
  if (t < 0) return 0;
  if (t < attack) return t / attack;
  return Math.exp(-(t - attack) / decay);
}

/** Jitter a recipe so every rendered variant sounds slightly different. */
function vary(recipe: StrokeRecipe, rng: () => number, amount: number): StrokeRecipe {
  const j = (v: number, spread: number) => v * (1 + (rng() * 2 - 1) * spread * amount);
  return {
    peak: recipe.peak,
    layers: recipe.layers.map((layer) => ({
      ...layer,
      at: layer.at > 0 ? Math.max(0, layer.at + (rng() * 2 - 1) * 0.0025 * amount) : 0,
      freq: j(layer.freq, 0.07),
      decay: j(layer.decay, 0.12),
      gain: j(layer.gain, 0.1),
    })),
  };
}

/** Render one stroke to raw PCM samples (mono, -1…1). Pure: runs in Node, workers or the browser. */
export function renderStroke(recipe: StrokeRecipe, sampleRate: number): Float32Array {
  const duration = Math.min(0.3, Math.max(...recipe.layers.map(tail)) + 0.004);
  const length = Math.ceil(duration * sampleRate);
  const out = new Float32Array(length);
  const rng = createRng(Math.round(recipe.layers[0]!.freq * 1000));

  for (const layer of recipe.layers) {
    const start = Math.floor(layer.at * sampleRate);
    const layerLength = Math.min(length - start, Math.ceil((tail(layer) - layer.at) * sampleRate));
    if (layerLength <= 0) continue;
    const buf = new Float32Array(layerLength);
    const attack = layer.attack ?? 0;

    if (layer.kind === 'noise') {
      // Envelope the excitation first, then filter: the filter's own ring adds the
      // resonant "body" that makes it sound like plastic rather than hiss.
      for (let i = 0; i < layerLength; i++) {
        buf[i] = (rng() * 2 - 1) * envelope(i / sampleRate, attack, layer.decay);
      }
      filterInPlace(buf, biquad(layer.filter, layer.freq, layer.q, sampleRate));
      // Bandpass at constant-peak gain loses energy vs. lowpass; compensate roughly.
      const makeup = layer.filter === 'bandpass' ? 1.6 + layer.q * 0.6 : 1;
      for (let i = 0; i < layerLength; i++) buf[i]! *= makeup * layer.gain;
    } else {
      let phase = 0;
      const drop = layer.drop ?? 0;
      const dropTime = layer.dropTime ?? 0.012;
      for (let i = 0; i < layerLength; i++) {
        const t = i / sampleRate;
        const freq = layer.freq * (1 + drop * Math.exp(-t / dropTime));
        phase += (2 * Math.PI * freq) / sampleRate;
        buf[i] = Math.sin(phase) * envelope(t, attack, layer.decay) * layer.gain;
      }
    }
    for (let i = 0; i < layerLength; i++) out[start + i]! += buf[i]!;
  }

  // Remove DC / sub-audio rumble, then normalise to the recipe's peak.
  filterInPlace(out, biquad('highpass', 35, 0.707, sampleRate));
  let peak = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(out[i]!));
  const scale = peak > 0 ? recipe.peak / peak : 0;
  const fadeIn = Math.max(1, Math.round(sampleRate * 0.0002));
  const fadeOut = Math.max(1, Math.round(sampleRate * 0.004));
  for (let i = 0; i < length; i++) {
    let g = scale;
    if (i < fadeIn) g *= i / fadeIn;
    if (i > length - fadeOut) g *= (length - i) / fadeOut;
    out[i]! *= g;
  }
  return out;
}

/** Render `count` slightly different variants of a stroke for natural-sounding repetition. */
export function renderVariants(
  profile: SwitchProfile,
  phase: StrokePhase,
  sampleRate: number,
  count = 4,
): Float32Array[] {
  const base = switchRecipes[profile][phase];
  const rng = createRng(profile.length * 7919 + (phase === 'down' ? 1 : 2));
  return Array.from({ length: count }, (_, i) => renderStroke(i === 0 ? base : vary(base, rng, 1), sampleRate));
}
