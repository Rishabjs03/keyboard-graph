// Packaging smoke test: every published entry must load via both `import` and
// `require` in plain Node (no DOM), and the React component must server-render.
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
const entries = [
  'keyboard-graph',
  'keyboard-graph/react',
  'keyboard-graph/element',
  'keyboard-graph/server',
];

for (const entry of entries) {
  const cjs = require(entry);
  const esm = await import(entry);
  if (Object.keys(cjs).length === 0 || Object.keys(esm).length === 0)
    throw new Error(`${entry} has no exports`);
}

const { sampleContributions } = await import('keyboard-graph');
const { KeyboardGraph } = await import('keyboard-graph/react');
const html = renderToString(
  createElement(KeyboardGraph, { data: sampleContributions('2026-10-05') }),
);
const keys = (html.match(/class="kg-key"/g) ?? []).length;
if (keys < 371) throw new Error(`SSR rendered ${keys} keys`);

console.log(
  `smoke: ${entries.length} entries load via import + require; SSR rendered ${keys} keys`,
);
