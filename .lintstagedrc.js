export default {
  // TypeScript files: lint and format
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
  ],

  // Configuration and documentation: format only
  '*.{json,md,yml,yaml}': [
    'prettier --write'
  ],
};
