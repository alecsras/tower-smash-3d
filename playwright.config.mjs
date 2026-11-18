// Browser tests run against the built page (npm run build first).
// Locally you can point at an installed Chrome with CHROME_PATH=/usr/bin/google-chrome.
// The "iphone" project runs Safari's engine (WebKit) with iPhone 13 screen and touch; CI installs it.
import { defineConfig, devices } from '@playwright/test';
const chromeArgs = ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
export default defineConfig({
  testDir: 'tests', timeout: 120_000, retries: process.env.CI ? 1 : 0, workers: 1, reporter: process.env.CI ? 'github' : 'list',
  projects: [
    { name: 'chromium', testIgnore: /iphone/, use: { viewport: { width: 390, height: 844 }, hasTouch: true,
      launchOptions: { executablePath: process.env.CHROME_PATH || undefined, args: chromeArgs } } },
    ...(process.env.CI || process.env.WEBKIT ? [{ name: 'iphone', testMatch: /iphone/, use: { ...devices['iPhone 13'] } }] : [])
  ]
});
