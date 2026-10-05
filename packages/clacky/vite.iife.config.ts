import { defineConfig } from 'vite';

/** Single-file, minified CDN build of the web component (no React, no Motion). */
export default defineConfig({
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
