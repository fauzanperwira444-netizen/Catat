import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['./tests/vitest.global-setup.ts'],
    env: { CATAT_TIMEZONE: 'Asia/Jakarta' },
    fileParallelism: false,
    testTimeout: 20000,
  },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
});
