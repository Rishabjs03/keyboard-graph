// Emit .d.ts with tsc, then mirror them as .d.cts so CommonJS consumers get
// correctly-typed `require` entry points (no "masquerading as ESM").
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const typesDir = join(dist, 'types');

rmSync(typesDir, { recursive: true, force: true });
execFileSync(
  process.execPath,
  [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(root, 'tsconfig.build.json')],
  {
    stdio: 'inherit',
  },
);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

for (const file of walk(typesDir)) {
  if (!file.endsWith('.d.ts')) continue;
  const source = readFileSync(file, 'utf8');
  const cjs = source
    .replace(/(from\s+['"]\.{1,2}\/[^'"]+)\.js(['"])/g, '$1.cjs$2')
    .replace(/(import\(['"]\.{1,2}\/[^'"]+)\.js(['"]\))/g, '$1.cjs$2');
  writeFileSync(file.replace(/\.d\.ts$/, '.d.cts'), cjs);
}

const entries = {
  index: 'index',
  react: 'react/index',
  element: 'element/index',
  server: 'server/index',
};
for (const [name, target] of Object.entries(entries)) {
  const rel = relative(dist, join(typesDir, target)).replaceAll('\\', '/');
  writeFileSync(join(dist, `${name}.d.ts`), `export * from './${rel}.js';\n`);
  writeFileSync(join(dist, `${name}.d.cts`), `export * from './${rel}.cjs';\n`);
}
mkdirSync(dist, { recursive: true });
console.log('types: ok');
