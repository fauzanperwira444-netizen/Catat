import { defineConfig } from '@playwright/test';
import path from 'node:path';

// Uji e2e memakai folder data terpisah, tidak pernah data asli.
const dataDir = path.join(import.meta.dirname, 'test-results', 'e2e-data');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://127.0.0.1:3299', locale: 'id-ID', timezoneId: 'Asia/Jakarta' },
  webServer: {
    command: `node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" "${dataDir}" && npx next dev -H 127.0.0.1 -p 3299`,
    url: 'http://127.0.0.1:3299/api/sehat',
    timeout: 180_000,
    reuseExistingServer: false,
    env: { CATAT_DATA_DIR: dataDir, CATAT_TIMEZONE: 'Asia/Jakarta' },
  },
});
