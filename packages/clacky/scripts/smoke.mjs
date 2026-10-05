// Packaging smoke test: every published entry must load via both `import` and
// `require` in plain Node (no DOM), and the React component must server-render.
import { createRequire } from 'node:module';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const require = createRequire(import.meta.url);
const entries = ['clacky', 'clacky/react', 'clacky/element', 'clacky/server'];

for (const entry of entries) {
  const cjs = require(entry);
  const esm = await import(entry);
  if (Object.keys(cjs).length === 0 || Object.keys(esm).length === 0)
    throw new Error(`${entry} has no exports`);
}

const { sampleContributions } = await import('clacky');
const { Clacky } = await import('clacky/react');
const html = renderToString(createElement(Clacky, { data: sampleContributions('2026-10-05') }));
const keys = (html.match(/class="clacky-key"/g) ?? []).length;
if (keys < 371) throw new Error(`SSR rendered ${keys} keys`);

console.log(
  `smoke: ${entries.length} entries load via import + require; SSR rendered ${keys} keys`,
);
