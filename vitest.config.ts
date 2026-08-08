import { defineConfig } from 'vitest/config';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  name: string;
  version: string;
};

export default defineConfig({
  // Mirrors the build-time constants injected by tsup
  define: {
    __PACKAGE_NAME__: JSON.stringify(packageJson.name),
    __PACKAGE_VERSION__: JSON.stringify(packageJson.version),
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/', '**/*.test.ts', '**/*.spec.ts', 'src/cli.ts'],
      thresholds: {
        statements: 80,
        branches: 67,
        functions: 95,
        lines: 81,
      },
    },
  },
});
