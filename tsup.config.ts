import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  name: string;
  version: string;
};

/**
 * Package metadata is inlined at build time. Reading package.json at runtime
 * breaks in the CJS bundle (no import.meta) and anywhere the bundle is shipped
 * without its manifest.
 */
const define = {
  __PACKAGE_NAME__: JSON.stringify(packageJson.name),
  __PACKAGE_VERSION__: JSON.stringify(packageJson.version),
};

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
    target: 'node22',
    outDir: 'dist',
    define,
  },
  // CLI build. ESM only: the bin entry points at dist/cli.js, and a CJS build
  // could never self-start anyway since its import.meta is stubbed out.
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    minify: false,
    target: 'node22',
    outDir: 'dist',
    onSuccess: 'chmod +x dist/cli.js',
    define,
  },
]);
