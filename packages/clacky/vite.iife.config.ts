import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

/** Single-file, minified CDN build of the web component (no React, no Motion). */
export default defineConfig({
  // One file for <script> users: sounds are fetched from jsDelivr (pinned to this
  // version) instead of being inlined.
  define: { __CLACKY_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: [
      {
        find: /^\.\/loader\.js$/,
        replacement: fileURLToPath(new URL('./src/audio/loader.cdn.ts', import.meta.url)),
      },
    ],
  },
  build: {
    target: 'es2022',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: 'src/iife.ts',
      name: 'Clacky',
      formats: ['iife'],
      fileName: () => 'clacky.iife.js',
    },
  },
});
