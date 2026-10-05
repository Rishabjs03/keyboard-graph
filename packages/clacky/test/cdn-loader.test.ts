import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSprite } from '../src/audio/loader.cdn';

const sprite = new Uint8Array([0xff, 0xfb, 0x90, 0x00]).buffer;
const ok = () => new Response(sprite.slice(0), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('CDN sound loader', () => {
  it('loads from jsDelivr first', async () => {
    const fetch = vi.fn(async (_url: string) => ok());
    vi.stubGlobal('fetch', fetch);
    const data = await loadSprite('brown');
    expect(data.byteLength).toBe(4);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]![0])).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/npm\/clacky@[^/]+\/sounds\/brown\.mp3$/,
    );
  });

  it('falls back to unpkg when jsDelivr returns an error status', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetch);
    const data = await loadSprite('cream');
    expect(data.byteLength).toBe(4);
    expect(String(fetch.mock.calls[1]![0])).toMatch(
      /^https:\/\/unpkg\.com\/clacky@[^/]+\/sounds\/cream\.mp3$/,
    );
  });

  it('falls back to unpkg when jsDelivr is unreachable', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetch);
    await expect(loadSprite('red')).resolves.toBeInstanceOf(ArrayBuffer);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up on a stalled request and tries unpkg', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn((_url: string, init?: RequestInit) =>
      fetch.mock.calls.length === 1
        ? new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
          )
        : Promise.resolve(ok()),
    );
    vi.stubGlobal('fetch', fetch);
    const pending = loadSprite('blue');
    await vi.advanceTimersByTimeAsync(6_000);
    await expect(pending).resolves.toBeInstanceOf(ArrayBuffer);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects when every CDN fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    await expect(loadSprite('brown')).rejects.toThrow(/unpkg\.com.*503/);
  });
});
