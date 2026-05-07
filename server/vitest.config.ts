import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/src/__tests__/**/*.test.ts'],
    testTimeout: 10000,
  },
});
