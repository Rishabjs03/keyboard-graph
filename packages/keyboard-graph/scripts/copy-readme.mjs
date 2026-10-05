// npm shows the package folder's README: copy the root README and LICENSE in at pack time.
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');
copyFileSync(join(pkg, '../../README.md'), join(pkg, 'README.md'));
copyFileSync(join(pkg, '../../LICENSE'), join(pkg, 'LICENSE'));
