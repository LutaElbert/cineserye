import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const runtime = process.env.CINESERYE_E2E_RUNTIME ?? (externalBaseUrl ? undefined : 'node-fixture');
if (runtime !== 'node-fixture' && runtime !== 'worker') {
  throw new Error('Set CINESERYE_E2E_RUNTIME=node-fixture or worker for an isolated external test server. Ports do not identify runtime safety.');
}
process.env.CINESERYE_E2E_RUNTIME = runtime;
const baseURL = externalBaseUrl ?? 'http://localhost:3000';

export default defineConfig({
  testDir: runtime === 'worker' ? '.' : './e2e',
  testMatch: runtime === 'worker' ? ['e2e-worker/*.spec.ts', 'e2e/editor.spec.ts', 'e2e/layer-behavior.spec.ts', 'e2e/layer-editor.spec.ts'] : undefined,
  globalSetup: './scripts/e2e-setup.ts',
  outputDir: `test-results/${runtime}`,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [[process.env.CI ? 'github' : 'list'], ['json', { outputFile: `artifacts/simplified-flow/${runtime}.json` }]],
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'CINESERYE_E2E_FIXTURE=true CINESERYE_LIVE_ENABLED=false npm run dev',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
