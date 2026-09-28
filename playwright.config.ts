import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the production build (service worker included).
 * Locally on Windows it uses the installed Microsoft Edge, so no browser download is needed.
 * Set PW_CHANNEL=chromium (after `npx playwright install chromium`) in CI.
 */
const channel = process.env.PW_CHANNEL ?? 'msedge';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    channel: channel === 'chromium' ? undefined : channel,
    timezoneId: 'America/New_York',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
