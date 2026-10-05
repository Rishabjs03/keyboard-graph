// Report minified + gzipped sizes of each published entry (including shared chunks).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entries = ['index', 'element', 'react', 'server'];
for (const entry of entries) {
  const result = await build({
    logLevel: 'silent',
    configFile: false,
    build: {
      write: false,
      minify: true,
      lib: { entry: join(root, `dist/${entry}.js`), formats: ['cjs'], fileName: entry },
      rolldownOptions: { external: [/^react/, /^motion/] },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
  const code = outputs.filter((o) => o.type === 'chunk').map((o) => o.code).join('\n');
  console.log(`${entry.padEnd(8)} ${(code.length / 1024).toFixed(1).padStart(6)} kB min  ${(gzipSync(code).length / 1024).toFixed(1).padStart(5)} kB gzip`);
}
const iife = readFileSync(join(root, 'dist/keyboard-graph.iife.js'));
console.log(`iife     ${(iife.length / 1024).toFixed(1).padStart(6)} kB min  ${(gzipSync(iife).length / 1024).toFixed(1).padStart(5)} kB gzip`);
