export default {
  // TypeScript files: lint, format, and typecheck
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    () => 'tsc --noEmit'
  ],

  // Configuration and documentation: format only
  '*.{json,md,yml,yaml}': [
    'prettier --write'
  ],
};
