/**
 * CDN build: `<script src="https://unpkg.com/keyboard-graph/dist/keyboard-graph.iife.js"></script>`
 * registers `<keyboard-graph>` and exposes the core API as `window.KeyboardGraph`.
 */
import { defineKeyboardGraph } from './element/element.js';

defineKeyboardGraph();

export { KeyboardGraphElement, defineKeyboardGraph } from './element/element.js';
export { themes, themeNames, resolveTheme } from './core/theme.js';
export { sampleContributions, loadContributions, normalizeContributions } from './core/data.js';
export { SwitchAudio } from './audio/engine.js';
