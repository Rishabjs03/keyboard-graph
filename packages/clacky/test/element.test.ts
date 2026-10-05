import { beforeAll, describe, expect, it } from 'vitest';
import { sampleContributions } from '../src/core/data';
import type { ClackyElement } from '../src/element/element';

beforeAll(async () => {
  await import('../src/element/index');
});

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('<clacky-graph>', () => {
  it('registers and renders keys from data', async () => {
    const el = document.createElement('clacky-graph') as ClackyElement;
    el.setAttribute('entrance', 'false');
    el.data = sampleContributions('2026-10-05');
    document.body.appendChild(el);
    await tick();
    const keys = el.shadowRoot!.querySelectorAll('.clacky-key[data-i]');
    expect(keys.length).toBe(371);
    expect(keys[0]!.getAttribute('aria-label')).toMatch(/contributions? on /);
    expect(el.shadowRoot!.querySelector('.clacky-root')!.getAttribute('data-state')).toBe('ready');
    expect(el.shadowRoot!.querySelectorAll('[tabindex="0"]').length).toBe(1);
    el.remove();
  });

  it('applies theme and scheme attributes', async () => {
    const el = document.createElement('clacky-graph') as ClackyElement;
    el.setAttribute('theme', 'ocean');
    el.setAttribute('color-scheme', 'dark');
    el.setAttribute('key-size', '20');
    el.data = sampleContributions('2026-10-05');
    document.body.appendChild(el);
    await tick();
    const root = el.shadowRoot!.querySelector<HTMLElement>('.clacky-root')!;
    expect(root.dataset.scheme).toBe('dark');
    expect(root.style.getPropertyValue('--clacky-dark-level-4')).toBe('#8ee3ef');
    expect(root.style.getPropertyValue('--_max')).toBe('20px');
    el.remove();
  });

  it('shows the empty state without a data source', async () => {
    const el = document.createElement('clacky-graph');
    document.body.appendChild(el);
    await tick();
    expect(el.shadowRoot!.querySelector('.clacky-message')?.textContent).toContain('username');
    el.remove();
  });

  it('dispatches clacky-keypress for programmatic presses', async () => {
    const el = document.createElement('clacky-graph') as ClackyElement;
    el.setAttribute('entrance', 'false');
    el.setAttribute('sound', 'off');
    el.data = sampleContributions('2026-10-05');
    document.body.appendChild(el);
    await tick();
    const detail = await new Promise<{ date: string; source: string }>((resolve) => {
      el.addEventListener('clacky-keypress', (e) => resolve(e.detail), { once: true });
      el.press('2026-10-01');
    });
    expect(detail).toMatchObject({ date: '2026-10-01', source: 'program' });
    el.remove();
  });
});

describe('<clacky-graph> regressions', () => {
  it('keeps properties assigned before the element was defined', async () => {
    const { defineClacky } = await import('../src/element/element');
    const el = document.createElement('clacky-graph-late') as ClackyElement;
    el.setAttribute('entrance', 'false');
    el.data = sampleContributions('2026-10-05');
    document.body.appendChild(el);
    defineClacky('clacky-graph-late');
    await tick();
    expect(el.shadowRoot!.querySelectorAll('.clacky-key[data-i]').length).toBe(371);
    // The accessor still works after the upgrade.
    el.data = sampleContributions('2026-10-05', 3, 10);
    await tick();
    expect(el.shadowRoot!.querySelectorAll('.clacky-key[data-i]').length).toBe(10);
    el.remove();
  });

  it('a year button click updates the year attribute when it controls the year', async () => {
    const el = document.createElement('clacky-graph') as ClackyElement;
    el.setAttribute('entrance', 'false');
    el.setAttribute('year-selector', '');
    el.setAttribute('year', '2026');
    el.data = sampleContributions('2026-10-05', 5, 800);
    document.body.appendChild(el);
    await tick();
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>(
      '.clacky-year[data-year="2025"]',
    )!;
    button.click();
    await tick();
    expect(el.getAttribute('year')).toBe('2025');
    expect(el.shadowRoot!.querySelector('.clacky-total')!.textContent).toContain('2025');
    // The same button element survives the re-render (keyboard focus is kept).
    expect(el.shadowRoot!.querySelector('.clacky-year[data-year="2025"]')).toBe(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    el.setAttribute('year', '2024');
    await tick();
    expect(el.shadowRoot!.querySelector('.clacky-total')!.textContent).toContain('2024');
    el.remove();
  });

  it('ignores theme names that only exist on Object.prototype', async () => {
    const el = document.createElement('clacky-graph') as ClackyElement;
    el.setAttribute('theme', 'constructor');
    el.data = sampleContributions('2026-10-05');
    document.body.appendChild(el);
    await tick();
    expect(el.shadowRoot!.querySelector('.clacky-root')!.getAttribute('data-state')).toBe('ready');
    el.remove();
  });
});
