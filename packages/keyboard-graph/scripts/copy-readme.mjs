// npm shows the package folder's README: copy the root README and LICENSE in at pack time.
// Relative links/images work on GitHub but not on npmjs.com, so they are rewritten to
// absolute URLs on the default branch.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'https://github.com/Rishabjs03/3d-git';
const RAW = 'https://raw.githubusercontent.com/Rishabjs03/3d-git/main';

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(join(pkg, '../../README.md'), 'utf8')
  .replace(/(src=")\.\/(?!\/)/g, `$1${RAW}/`)
  .replace(/(\]\()\.\/(?!\/)/g, `$1${REPO}/blob/main/`)
  .replace(/(href=")\.\/(?!\/)/g, `$1${REPO}/tree/main/`);
writeFileSync(join(pkg, 'README.md'), readme);
copyFileSync(join(pkg, '../../LICENSE'), join(pkg, 'LICENSE'));
