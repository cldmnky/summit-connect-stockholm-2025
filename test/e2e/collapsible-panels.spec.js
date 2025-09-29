const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Collapsible panels functionality', () => {

    test('collapsible headers are present and functional', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for page to load
        await page.waitForSelector('.collapsible-header', { timeout: 5000 });

        // Check that all three collapsible headers are present
        const headers = await page.locator('.collapsible-header').count();
        expect(headers).toBe(3); // datacenter-overview, active-vms, active-migrations

        // Check that datacenter overview is visible by default
        await expect(page.locator('#datacenter-view')).toBeVisible();

        // Check that VM list content is visible by default
        await expect(page.locator('[data-section="active-vms"]')).toBeVisible();

        // Check that migration content is visible by default
        await expect(page.locator('[data-section="active-migrations"]')).toBeVisible();
    });

    test('can collapse and expand VM list panel', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for page to load
        await page.waitForSelector('[data-target="active-vms"]', { timeout: 5000 });

        const vmHeader = page.locator('[data-target="active-vms"]');
        const vmContent = page.locator('[data-section="active-vms"]');

        // Initially should be visible
        await expect(vmContent).toBeVisible();

        // Click to collapse
        await vmHeader.click();
        
        // Should be collapsed now
        await expect(vmContent).not.toBeVisible();

        // Click to expand again
        await vmHeader.click();
        
        // Should be visible again
        await expect(vmContent).toBeVisible();
    });

    test('can collapse and expand migration panel', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for page to load
        await page.waitForSelector('[data-target="active-migrations"]', { timeout: 5000 });

        const migrationHeader = page.locator('[data-target="active-migrations"]');
        const migrationContent = page.locator('[data-section="active-migrations"]');

        // Initially should be visible
        await expect(migrationContent).toBeVisible();

        // Click to collapse
        await migrationHeader.click();
        
        // Should be collapsed now
        await expect(migrationContent).not.toBeVisible();

        // Click to expand again
        await migrationHeader.click();
        
        // Should be visible again
        await expect(migrationContent).toBeVisible();
    });

    test('can collapse and expand datacenter overview panel', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for page to load
        await page.waitForSelector('[data-target="datacenter-overview"]', { timeout: 5000 });

        const dcHeader = page.locator('[data-target="datacenter-overview"]');
        const dcContent = page.locator('[data-section="datacenter-overview"]');

        // Initially should be visible
        await expect(dcContent).toBeVisible();

        // Click to collapse
        await dcHeader.click();
        
        // Should be collapsed now
        await expect(dcContent).not.toBeVisible();

        // Click to expand again
        await dcHeader.click();
        
        // Should be visible again
        await expect(dcContent).toBeVisible();
    });

    test('collapse states persist after page reload', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for page to load
        await page.waitForSelector('[data-target="active-vms"]', { timeout: 5000 });

        const vmHeader = page.locator('[data-target="active-vms"]');
        const vmContent = page.locator('[data-section="active-vms"]');

        // Collapse VM panel
        await vmHeader.click();
        await expect(vmContent).not.toBeVisible();

        // Reload page
        await page.reload();
        await page.waitForSelector('[data-target="active-vms"]', { timeout: 5000 });

        // VM panel should still be collapsed
        await expect(vmContent).not.toBeVisible();

        // Expand it back for cleanup
        await vmHeader.click();
        await expect(vmContent).toBeVisible();
    });

    test('toggle buttons change state correctly', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for page to load
        await page.waitForSelector('[data-target="active-vms"]', { timeout: 5000 });

        const vmHeader = page.locator('[data-target="active-vms"]');
        const toggleIcon = vmHeader.locator('.collapse-toggle i');

        // Initially should not be rotated
        await expect(vmHeader).not.toHaveClass(/collapsed/);

        // Click to collapse
        await vmHeader.click();
        
        // Header should have collapsed class
        await expect(vmHeader).toHaveClass(/collapsed/);

        // Click to expand again
        await vmHeader.click();
        
        // Header should not have collapsed class
        await expect(vmHeader).not.toHaveClass(/collapsed/);
    });

});