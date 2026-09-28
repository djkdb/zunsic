import { defineConfig, devices } from '@playwright/test';

/**
 * E2E QA.
 *  - `prod`   : production build served by `vite preview` (debug tools must be hidden)
 *  - `dev`    : dev server, used for Debug Mode checks (?debug=true)
 *  - `mobile` : production build at phone widths
 */

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
  projects: [
    { name: 'prod', testMatch: /game\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, baseURL: 'http://localhost:4173' } },
    { name: 'mobile', testMatch: /mobile\.spec\.ts/, use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4173' } },
    { name: 'dev', testMatch: /debug\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: 'http://localhost:5174' } },
  ],
});
