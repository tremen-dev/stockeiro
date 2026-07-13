import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // bcrypt hashing + WASM Postgres boot are not instant.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
