const { test, expect } = require('@playwright/test');

// This test prefers running against a local app server. Set PW_BASE_URL to point to your running
// backend/frontend server (for example: http://127.0.0.1:3001). If PW_BASE_URL is unset it will
// default to http://127.0.0.1:3001.
//
// If you don't run a server, the fallback file:// approach may work but can be flaky due to
// cross-origin restrictions when loading CDN resources (Leaflet, D3). Recommended: start the
// dev server and run tests against it.

const BASE_URL = process.env.PW_BASE_URL || 'http://127.0.0.1:3001';
const localFile = `${BASE_URL}/`;

test.describe('VM list rendering', () => {
  test('renders VM list and Center button works', async ({ page }) => {
    await page.goto(localFile);

    // Wait for the app to initialize and render some content
    await page.waitForSelector('#vm-list-rows', { timeout: 5000 });

    // There should be at least one vm-row (fallback data exists if API not available)
    const rows = await page.locator('#vm-list-rows .vm-row');
    await expect(rows.first()).toBeVisible();

    // Check Compact layout: vm-table exists inside a row
    await expect(rows.first().locator('.vm-table')).toHaveCount(1);

    // Center button exists and is clickable
    const centerBtn = rows.first().locator('.vm-actions button');
    await expect(centerBtn).toBeVisible();
    await centerBtn.click();

    // After clicking center, the map container should still exist
    await expect(page.locator('#map')).toBeVisible();

    // Ensure stats updated (total-vms element contains a number)
    const totalVmsText = await page.textContent('#total-vms');
    expect(totalVmsText).toMatch(/\d+/);
  });
});
