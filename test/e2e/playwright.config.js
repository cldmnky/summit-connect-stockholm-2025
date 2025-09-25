// Minimal Playwright config for local static testing
const { devices } = require('@playwright/test');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './',
  timeout: 30 * 1000,
  use: {
    headless: true,
    viewport: { width: 1200, height: 800 },
    ignoreHTTPSErrors: true,
    actionTimeout: 10 * 1000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
};
