// Report minified + gzipped sizes of each published entry. The switch sound chunks
// are loaded lazily (one per profile, on demand), so they are reported separately.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const soundChunk = /(?:^|\/)(blue|brown|red|cream)-[\w-]+\.js$/;
const kb = (n) => `${(n / 1024).toFixed(1).padStart(6)} kB`;

for (const entry of ['index', 'element', 'react', 'server']) {
  const result = await build({
    logLevel: 'silent',
    configFile: false,
    build: {
      write: false,
      minify: true,
      lib: { entry: join(root, `dist/${entry}.js`), formats: ['cjs'], fileName: entry },
      rolldownOptions: { external: (id) => /^react|^motion/.test(id) || soundChunk.test(id) },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
  const code = outputs
    .filter((o) => o.type === 'chunk')
    .map((o) => o.code)
    .join('\n');
  console.log(`${entry.padEnd(8)} ${kb(code.length)} min ${kb(gzipSync(code).length)} gzip`);
}

const iife = readFileSync(join(root, 'dist/clacky.iife.js'));
console.log(
  `iife     ${kb(iife.length)} min ${kb(gzipSync(iife).length)} gzip  (sounds fetched from jsDelivr)`,
);
for (const file of readdirSync(join(root, 'dist')).filter((f) => soundChunk.test(f))) {
  const code = readFileSync(join(root, 'dist', file));
  console.log(`sound    ${kb(code.length)}     ${kb(gzipSync(code).length)} gzip  ${file} (lazy)`);
}
