import { defineConfig, devices } from '@playwright/test';

/**
 * Config e2e (RED-2). Verifica los flujos reales de SPEC-001 en navegador contra
 * la app corriendo (next start) sobre un Postgres real efímero (ver
 * tests/e2e/server.mjs). Un solo worker y sin paralelismo: los tests comparten la
 * misma DB durante la ejecución.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3200',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node tests/e2e/server.mjs',
    url: 'http://localhost:3200/login',
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
