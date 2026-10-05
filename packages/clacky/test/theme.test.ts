import { describe, expect, it } from 'vitest';
import { clackyCSS } from '../src/core/styles';
import {
  parseThemeAttribute,
  resolveTheme,
  themeNames,
  themeToCssVars,
  themes,
} from '../src/core/theme';

describe('themes', () => {
  it('ships the eight presets with light and dark palettes', () => {
    expect(themeNames).toEqual([
      'github',
      'halloween',
      'ocean',
      'sunset',
      'mono',
      'sakura',
      'retro',
      'night',
    ]);
    for (const name of themeNames) {
      expect(themes[name].light.levels).toHaveLength(5);
      expect(themes[name].dark.levels).toHaveLength(5);
    }
  });

  it('merges custom themes over a preset', () => {
    const resolved = resolveTheme({
      extends: 'ocean',
      levels: [undefined, '#111111'],
      plate: '#ffffff',
      dark: { plate: '#000000' },
    });
    expect(resolved.light.levels[0]).toBe(themes.ocean.light.levels[0]);
    expect(resolved.light.levels[1]).toBe('#111111');
    expect(resolved.dark.levels[1]).toBe('#111111');
    expect(resolved.light.plate).toBe('#ffffff');
    expect(resolved.dark.plate).toBe('#000000');
    expect(resolved.light.tooltip.background).toBe(themes.ocean.light.tooltip.background);
  });

  it('falls back to github for unknown input', () => {
    expect(resolveTheme(undefined)).toBe(themes.github);
    expect(resolveTheme('nope' as never)).toBe(themes.github);
  });

  it('emits scheme-scoped CSS variables', () => {
    const vars = themeToCssVars(resolveTheme('sakura'));
    expect(vars['--clacky-light-level-4']).toBe(themes.sakura.light.levels[4]);
    expect(vars['--clacky-dark-plate']).toBe(themes.sakura.dark.plate);
    expect(Object.keys(vars)).toHaveLength(28);
  });

  it('parses the theme attribute', () => {
    expect(parseThemeAttribute('ocean')).toBe('ocean');
    expect(parseThemeAttribute('{"levels":["#fff"]}')).toEqual({ levels: ['#fff'] });
    expect(parseThemeAttribute('{broken')).toBeUndefined();
    expect(parseThemeAttribute('unknown')).toBeUndefined();
  });

  it('exposes public custom properties in the stylesheet', () => {
    expect(clackyCSS).toContain('var(--clacky-level-3,var(--clacky-light-level-3,');
    expect(clackyCSS).toContain('prefers-reduced-motion');
    expect(clackyCSS).not.toContain('\n');
  });
});
