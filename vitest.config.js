import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    // The server suite runs under its own node-environment config
    // (server/vitest.config.ts); sweeping it into jsdom breaks jose.
    // Session worktrees under .claude/worktrees/ carry their own copies of
    // the suite but not their own node_modules — never collect from them.
    exclude: [...configDefaults.exclude, 'server/**', '.claude/worktrees/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
