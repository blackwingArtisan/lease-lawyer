import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Each Prolog session loads the rule base; a slow first run on a cold machine must not time out.
    testTimeout: 20_000,
  },
});
