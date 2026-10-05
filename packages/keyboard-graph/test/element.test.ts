import { beforeAll, describe, expect, it } from 'vitest';
import { sampleContributions } from '../src/core/data';
import type { KeyboardGraphElement } from '../src/element/element';

beforeAll(async () => {
  await import('../src/element/index');
});

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('<keyboard-graph>', () => {
  it('registers and renders keys from data', async () => {
    const el = document.createElement('keyboard-graph') as KeyboardGraphElement;
    el.setAttribute('entrance', 'false');
    el.data = sampleContributions('2026-10-05');
    document.body.appendChild(el);
    await tick();
    const keys = el.shadowRoot!.querySelectorAll('.kg-key[data-i]');
    expect(keys.length).toBe(371);
    expect(keys[0]!.getAttribute('aria-label')).toMatch(/contributions? on /);
    expect(el.shadowRoot!.querySelector('.kg-root')!.getAttribute('data-state')).toBe('ready');
    expect(el.shadowRoot!.querySelectorAll('[tabindex="0"]').length).toBe(1);
    el.remove();
  });

  it('applies theme and scheme attributes', async () => {
    const el = document.createElement('keyboard-graph') as KeyboardGraphElement;
    el.setAttribute('theme', 'ocean');
    el.setAttribute('color-scheme', 'dark');
    el.setAttribute('key-size', '20');
    el.data = sampleContributions('2026-10-05');
    document.body.appendChild(el);
    await tick();
    const root = el.shadowRoot!.querySelector<HTMLElement>('.kg-root')!;
    expect(root.dataset.scheme).toBe('dark');
    expect(root.style.getPropertyValue('--kg-dark-level-4')).toBe('#8ee3ef');
    expect(root.style.getPropertyValue('--_max')).toBe('20px');
    el.remove();
  });

  it('shows the empty state without a data source', async () => {
    const el = document.createElement('keyboard-graph');
    document.body.appendChild(el);
    await tick();
    expect(el.shadowRoot!.querySelector('.kg-message')?.textContent).toContain('username');
    el.remove();
  });

  it('dispatches kg-keypress for programmatic presses', async () => {
    const el = document.createElement('keyboard-graph') as KeyboardGraphElement;
    el.setAttribute('entrance', 'false');
    el.setAttribute('sound', 'off');
    el.data = sampleContributions('2026-10-05');
    document.body.appendChild(el);
    await tick();
    const detail = await new Promise<{ date: string; source: string }>((resolve) => {
      el.addEventListener('kg-keypress', (e) => resolve(e.detail), { once: true });
      el.press('2026-10-01');
    });
    expect(detail).toMatchObject({ date: '2026-10-01', source: 'program' });
    el.remove();
  });
});
