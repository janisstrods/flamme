import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', 'docs/**', '**/*.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // The engine is pure and deterministic: no clock, no ambient randomness, no I/O.
    files: [
      'packages/engine/src/**/*.ts',
      'packages/content/src/**/*.ts',
      'packages/ai/src/**/*.ts',
    ],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'Date',
          message: 'Engine code must not read the clock. Pass time in through actions.',
        },
        { name: 'setTimeout', message: 'No timers in pure packages.' },
        { name: 'fetch', message: 'No I/O in pure packages.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG stored in game state.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*', 'fs', 'path', 'crypto'], message: 'No I/O in pure packages.' },
          ],
        },
      ],
    },
  },
);
