import { defineConfig } from 'vitest/config';

// Used only by scripts/eval.mjs; `npm test` does not run this file.
export default defineConfig({
  test: {
    include: ['tests/holdout/run-eval.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
  },
});
