"""
Slice keystroke recordings into clean down/up strokes and pack a switch profile
into a small MP3 sprite + JSON offsets. See sounds/SOURCES.md.

usage: python3 scripts/slice-recordings.py <profile> <out_dir> <recording> [...]
requires: python3, numpy, ffmpeg (with libmp3lame)
"""
import json
import subprocess
import sys

import numpy as np

SR = 44100


def decode(path):
    raw = subprocess.check_output(
        ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'])
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def highpass(x, hz=40):
    # One-pole high-pass to remove rumble / DC.
    rc = 1 / (2 * np.pi * hz)
    a = rc / (rc + 1 / SR)
    y = np.zeros_like(x)
    prev_x = prev_y = 0.0
    for i, v in enumerate(x):
        prev_y = a * (prev_y + v - prev_x)
        prev_x = v
        y[i] = prev_y
    return y


def frame_db(x, frame=88, hop=44):
    n = 1 + (len(x) - frame) // hop
    idx = np.arange(frame)[None, :] + hop * np.arange(n)[:, None]
    rms = np.sqrt(np.mean(x[idx] ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms), hop


def onsets(x):
    db, hop = frame_db(x)
    floor = np.percentile(db, 20)
    found = []
    last = -10**9
    lookback = 20  # frames (~20 ms)
    for i in range(lookback, len(db)):
        if db[i] < floor + 16:
            continue
        rise = db[i] - db[i - lookback:i].min()
        if rise > 12 and (i - last) * hop > SR * 0.035:
            # Refine to the first sample above 20% of the local peak.
            start = i * hop
            window = np.abs(x[max(0, start - 600):start + 900])
            peak = window.max()
            first = np.argmax(window > peak * 0.2)
            pos = max(0, start - 600) + first
            found.append(pos)
            last = i
    return found, floor


def segment(x, start, next_start, floor_db):
    begin = max(0, start - int(0.003 * SR))
    limit = min(len(x), begin + int(0.26 * SR), next_start - int(0.004 * SR) if next_start else len(x))
    seg = x[begin:limit].copy()
    # Trim the tail once the level stays near the noise floor for 12 ms.
    env_db, hop = frame_db(seg, 88, 44)
    quiet = env_db < floor_db + 5
    end = len(seg)
    run = 0
    for i in range(int(0.02 * SR / hop), len(quiet)):
        run = run + 1 if quiet[i] else 0
        if run * hop > 0.012 * SR:
            end = min(len(seg), (i - run + 1) * hop + int(0.006 * SR))
            break
    seg = seg[:end]
    fade_in = int(0.0008 * SR)
    fade_out = min(len(seg) // 3, int(0.012 * SR))
    seg[:fade_in] *= np.linspace(0, 1, fade_in)
    seg[-fade_out:] *= np.linspace(1, 0, fade_out) ** 2
    cut = next_start is not None and begin + end >= next_start - int(0.006 * SR)
    return seg, cut


def analyse(path):
    x = highpass(decode(path))
    found, floor = onsets(x)
    strokes = []
    for i, s in enumerate(found):
        nxt = found[i + 1] if i + 1 < len(found) else None
        seg, cut = segment(x, s, nxt, floor)
        if len(seg) < int(0.02 * SR):
            continue
        env = np.abs(seg)
        peak = float(env.max())
        frames = [env[i:i + 44].max() for i in range(0, len(env) - 44, 44)]
        hits, last = 0, -99
        for i, v in enumerate(frames):
            if v > peak * 0.5 and i - last > 15:
                hits += 1
                last = i
        spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
        freqs = np.fft.rfftfreq(len(seg), 1 / SR)
        strokes.append({'pos': s, 'seg': seg, 'peak': peak, 'snr': 20 * np.log10(peak + 1e-9) - floor,
                        'clipped': peak > 0.985, 'cut': cut, 'hits': hits,
                        't_peak': env.argmax() / SR * 1000, 'ms': len(seg) / SR * 1000,
                        'centroid': float((spec * freqs).sum() / spec.sum()), 'file': path})
    # Pair a loud stroke with a quieter one 40 to 220 ms later: down + up.
    for a, b in zip(strokes, strokes[1:]):
        gap = (b['pos'] - a['pos']) / SR
        if 0.04 <= gap <= 0.22 and b['peak'] < a['peak'] * 0.85 and 'kind' not in a:
            a['kind'] = 'down'
            b['kind'] = 'up'
    for s in strokes:
        s.setdefault('kind', 'down')
    return strokes, floor


def pick(strokes, kind, n):
    strict = {'down': dict(t=8, hits=1, ms=55, snr=30), 'up': dict(t=8, hits=1, ms=22, snr=24)}[kind]
    relaxed = {'down': dict(t=12, hits=1, ms=42, snr=26), 'up': dict(t=12, hits=2, ms=18, snr=20)}[kind]
    def passes(s, r):
        if s['kind'] != kind or s['clipped'] or s['t_peak'] > r['t'] or s['hits'] > r['hits']:
            return False
        if s['ms'] < r['ms'] or s['snr'] < r['snr']:
            return False
        return not (kind == 'down' and s['cut'])
    pool = [s for s in strokes if passes(s, strict)]
    if len(pool) < n:
        pool += [s for s in strokes if passes(s, relaxed) and s not in pool]
    if not pool:
        return []
    peak_m = np.median([s['peak'] for s in pool])
    cen_m = np.median([s['centroid'] for s in pool])
    # Consistent loudness and tone (no stray keys), then cleanliness.
    pool.sort(key=lambda s: abs(np.log(s['peak'] / peak_m)) + 0.8 * abs(np.log(s['centroid'] / cen_m)) - s['snr'] / 90)
    return pool[:n]


def main():
    profile, out_dir, files = sys.argv[1], sys.argv[2], sys.argv[3:]
    strokes = []
    for f in files:
        s, floor = analyse(f)
        downs = sum(1 for k in s if k['kind'] == 'down')
        ups = sum(1 for k in s if k['kind'] == 'up')
        good = len(pick(s, 'down', 999)); good_up = len(pick(s, 'up', 999))
        print(f'{f}: {len(s)} strokes ({downs} down, {ups} up), usable {good} down / {good_up} up, noise floor {floor:.1f} dB')
        strokes += s
    downs = pick(strokes, 'down', 6)
    ups = pick(strokes, 'up', 4)
    if not downs:
        sys.exit('no usable strokes')
    # Loudness: downs to -2 dBFS peak; ups keep their natural ratio to downs.
    down_gain = 0.79 / np.median([d['peak'] for d in downs])
    ratio = (np.median([u['peak'] for u in ups]) / np.median([d['peak'] for d in downs])) if ups else 0
    # Keep the natural press/release balance, but a release is never louder than
    # ~55% of the press (some recordings mix in other keys' presses).
    up_gain = down_gain * min(1.0, 0.55 / ratio) if ups and ratio > 0 else 0
    ratio = min(ratio, 0.55)
    gap = np.zeros(int(0.07 * SR))
    sprite = [gap.copy()]
    meta = {'down': [], 'up': []}
    cursor = len(gap)
    for kind, chosen, gain in (('down', downs, down_gain), ('up', ups, up_gain)):
        for s in chosen:
            seg = np.clip(s['seg'] * gain, -1, 1)
            meta[kind].append([round(cursor / SR * 1000, 2), round(len(seg) / SR * 1000, 2)])
            sprite += [seg, gap.copy()]
            cursor += len(seg) + len(gap)
    audio = np.concatenate(sprite).astype(np.float32)
    wav = f'{out_dir}/{profile}.wav'
    pcm = (audio * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', wav],
                   input=pcm, check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '96k',
                    f'{out_dir}/{profile}.mp3'], check=True)
    meta['upToDownRatio'] = round(float(ratio), 3)
    json.dump(meta, open(f'{out_dir}/{profile}.json', 'w'))
    print(f'{profile}: {len(downs)} down, {len(ups)} up, up/down loudness {ratio:.2f}, '
          f'sprite {len(audio) / SR:.2f}s')


if __name__ == '__main__':
    main()
