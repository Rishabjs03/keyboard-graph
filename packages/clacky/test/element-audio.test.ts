import { describe, expect, it, vi } from 'vitest';
import { sampleContributions } from '../src/core/data';
import type { ClackyElement } from '../src/element/element';

const loadSprite = vi.hoisted(() => vi.fn(async (_profile: string) => new ArrayBuffer(8)));
vi.mock('../src/audio/loader', () => ({ loadSprite }));

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('<clacky-graph> sounds', () => {
  it('only downloads the configured switch', async () => {
    await import('../src/element/index');
    const el = document.createElement('clacky-graph') as ClackyElement;
    el.setAttribute('sound', 'cream');
    el.data = sampleContributions('2026-10-05');
    document.body.appendChild(el);
    await tick();
    expect(loadSprite.mock.calls.map(([profile]) => profile)).toEqual(['cream']);
    el.remove();
  });
});
