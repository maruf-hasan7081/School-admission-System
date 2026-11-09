import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/live',
  testMatch: '**/*.live.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  expect: { timeout: 10000 },
  outputDir: 'test-results-live',
  reporter: [['list'], ['json', { outputFile: 'test-results-live/results.json' }], ['html', { outputFolder: 'playwright-report-live', open: 'never' }]],
  use: {
    baseURL: process.env.LIVE_FRONTEND_URL || 'http://127.0.0.1:5181',
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: (process.platform === 'win32' ? 'npm.cmd' : 'npm') + ' run dev -- --host 127.0.0.1 --port 5181 --strictPort',
    url: 'http://127.0.0.1:5181',
    reuseExistingServer: false,
    timeout: 30000,
    env: { VITE_API_URL: process.env.LIVE_API_URL || 'http://127.0.0.1:5099' },
  },
});
