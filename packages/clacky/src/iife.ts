/**
 * CDN build: `<script src="https://unpkg.com/clacky/dist/clacky.iife.js"></script>`
 * registers `<clacky-graph>` and exposes the core API as `window.Clacky`.
 */
import { defineClacky } from './element/element.js';

defineClacky();

export { ClackyElement, defineClacky } from './element/element.js';
export { themes, themeNames, resolveTheme } from './core/theme.js';
export { sampleContributions, loadContributions, normalizeContributions } from './core/data.js';
export { SwitchAudio } from './audio/engine.js';
