// Playwright config for Stockholm Datacenters app testing
const { devices } = require('@playwright/test');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './',
  timeout: 30 * 1000,
  expect: {
    // Increase timeout for assertions that wait for API data
    timeout: 10 * 1000,
  },
  use: {
    headless: true,
    viewport: { width: 1200, height: 800 },
    ignoreHTTPSErrors: true,
    actionTimeout: 10 * 1000,
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    // Record video on failure
    video: 'retain-on-failure',
    // Useful for debugging API calls
    trace: 'retain-on-failure',
  },
  projects: [
    { 
      name: 'chromium', 
      use: { 
        ...devices['Desktop Chrome'],
        // Enable network events for API testing
        launchOptions: {
          args: ['--disable-web-security', '--disable-features=VizDisplayCompositor'],
        }
      } 
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  // Retry failed tests
  retries: 1,
  // Run tests in parallel
  workers: process.env.CI ? 2 : undefined,
};
