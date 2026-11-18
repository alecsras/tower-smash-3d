// Browser tests run against the built page (npm run build first).
// Locally you can point at an installed Chrome with CHROME_PATH=/usr/bin/google-chrome.
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests', timeout: 120_000, retries: process.env.CI ? 1 : 0, workers: 1, reporter: process.env.CI ? 'github' : 'list',
  use: {
    viewport: { width: 390, height: 844 }, hasTouch: true,
    launchOptions: { executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }
  }
});
