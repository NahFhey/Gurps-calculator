import { defineConfig } from 'vitest/config';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Pin discovery to server/ so `npm test` works both from server/ and
    // via `vitest --config server/vitest.config.ts` from the repo root.
    root: dirname(fileURLToPath(import.meta.url)),
    include: ['src/__tests__/**/*.test.ts'],
    testTimeout: 10000,
  },
});
