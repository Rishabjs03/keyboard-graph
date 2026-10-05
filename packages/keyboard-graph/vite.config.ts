/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

/**
 * Library build: four entry points, ESM + CJS, peer dependencies external.
 * Shared code between entries lands in hashed chunks, so importing only
 * `keyboard-graph/element` never pulls in React or Motion.
 */
export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    minify: false,
    emptyOutDir: true,
    lib: {
      entry: {
        index: 'src/index.ts',
        react: 'src/react/index.ts',
        element: 'src/element/index.ts',
        server: 'src/server/index.ts',
      },
      formats: ['es', 'cjs'],
      fileName: (format, name) => `${name}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rolldownOptions: {
      external: [/^react($|\/)/, /^react-dom($|\/)/, /^motion($|\/)/],
      output: {
        // Next.js / RSC: the React entry must start with the directive. Bundlers strip
        // module-level directives, so it is re-added to the emitted entry here.
        banner: (chunk) => (chunk.isEntry && chunk.name === 'react' ? "'use client';" : ''),
        chunkFileNames: (chunk) =>
          `chunks/[name]-[hash].${chunk.name.endsWith('.cjs') ? 'cjs' : 'js'}`,
      },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
});
