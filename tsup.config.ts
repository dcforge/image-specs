import { defineConfig } from 'tsup';

export default defineConfig([
  // Main library build
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: false,
    target: 'node18',
    outDir: 'dist',
  },
  // CLI build
  {
    entry: ['src/cli.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    minify: false,
    target: 'node18',
    outDir: 'dist',
    onSuccess: 'chmod +x dist/cli.js',
  },
]);
