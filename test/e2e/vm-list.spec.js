const { test, expect } = require('@playwright/test');

// This test loads the frontend index.html via file:// and checks VM list rendering and controls.
// Note: Playwright served file:// requests may have cross-origin restrictions when loading remote resources (Leaflet CDN).
// For a robust test run, start the app server (e.g. `go run main.go` or `make serve`) and change the URL to http://127.0.0.1:3001

const localFile = `file://${process.cwd()}/frontend/index.html`;

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
