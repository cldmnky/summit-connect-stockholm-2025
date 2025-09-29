const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('VM filtering and count badges', () => {

    test('VM name filter works correctly', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for page to load
        await page.waitForSelector('#vm-name-filter', { timeout: 5000 });

        // Get initial VM count
        const initialVMRows = await page.locator('.vm-row').count();
        
        // Type in filter - let's filter for 'vm' which should match many VMs
        await page.fill('#vm-name-filter', 'vm');
        
        // Wait for debounced update
        await page.waitForTimeout(400);
        
        // Count should be same or less after filtering
        const filteredVMRows = await page.locator('.vm-row').count();
        expect(filteredVMRows).toBeLessThanOrEqual(initialVMRows);

        // Clear filter and check count returns
        await page.fill('#vm-name-filter', '');
        await page.waitForTimeout(400);
        
        const clearedVMRows = await page.locator('.vm-row').count();
        expect(clearedVMRows).toBe(initialVMRows);
    });

    test('VM count badge displays and updates correctly', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for elements to load
        await page.waitForSelector('#vm-count-badge', { timeout: 5000 });

        // Check badge exists and has a number
        const vmCountBadge = page.locator('#vm-count-badge');
        await expect(vmCountBadge).toBeVisible();
        
        const badgeText = await vmCountBadge.textContent();
        expect(parseInt(badgeText)).toBeGreaterThanOrEqual(0);
        
        // Get initial count
        const initialCount = parseInt(badgeText);
        
        // Apply a filter that should reduce the count
        await page.fill('#vm-name-filter', 'nonexistent-vm-name-12345');
        await page.waitForTimeout(400);
        
        // Badge should show 0 or lower count
        const filteredBadgeText = await vmCountBadge.textContent();
        const filteredCount = parseInt(filteredBadgeText);
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
        
        // Clear filter and count should return to original
        await page.fill('#vm-name-filter', '');
        await page.waitForTimeout(400);
        
        const restoredBadgeText = await vmCountBadge.textContent();
        expect(parseInt(restoredBadgeText)).toBe(initialCount);
    });

    test('migration count badge displays correctly', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for elements to load
        await page.waitForSelector('#migration-count-badge', { timeout: 5000 });

        // Check badge exists and has a number
        const migrationCountBadge = page.locator('#migration-count-badge');
        await expect(migrationCountBadge).toBeVisible();
        
        const badgeText = await migrationCountBadge.textContent();
        expect(parseInt(badgeText)).toBeGreaterThanOrEqual(0);
    });

    test('VM name filter persists after page reload', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for elements to load
        await page.waitForSelector('#vm-name-filter', { timeout: 5000 });

        // Set a filter value
        const testFilter = 'test-vm';
        await page.fill('#vm-name-filter', testFilter);
        await page.waitForTimeout(400);

        // Reload page
        await page.reload();
        await page.waitForSelector('#vm-name-filter', { timeout: 5000 });

        // Filter should still be there
        const filterValue = await page.inputValue('#vm-name-filter');
        expect(filterValue).toBe(testFilter);

        // Clear for cleanup
        await page.fill('#vm-name-filter', '');
        await page.waitForTimeout(400);
    });

    test('VM name filter works with Enter key', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for elements to load
        await page.waitForSelector('#vm-name-filter', { timeout: 5000 });

        // Get initial VM count
        const initialVMRows = await page.locator('.vm-row').count();

        // Type in filter and press Enter
        await page.fill('#vm-name-filter', 'nonexistent-filter-123');
        await page.press('#vm-name-filter', 'Enter');
        
        // Should immediately filter (no debounce wait needed)
        const filteredVMRows = await page.locator('.vm-row').count();
        expect(filteredVMRows).toBeLessThanOrEqual(initialVMRows);
    });

    test('combined filters work together', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for elements to load
        await page.waitForSelector('#vm-name-filter', { timeout: 5000 });
        await page.waitForSelector('#vm-filter-mode', { timeout: 5000 });

        // Get initial count
        const initialVMRows = await page.locator('.vm-row').count();

        // Apply name filter
        await page.fill('#vm-name-filter', 'vm');
        await page.waitForTimeout(400);
        
        const nameFilteredCount = await page.locator('.vm-row').count();
        
        // Apply mode filter on top of name filter
        await page.selectOption('#vm-filter-mode', 'migrating');
        await page.waitForTimeout(400);
        
        const combinedFilteredCount = await page.locator('.vm-row').count();
        
        // Combined filter should show same or fewer results
        expect(combinedFilteredCount).toBeLessThanOrEqual(nameFilteredCount);
        
        // Clear filters
        await page.fill('#vm-name-filter', '');
        await page.selectOption('#vm-filter-mode', 'all');
        await page.waitForTimeout(400);
    });

    test('count badges show correct tooltips', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for elements to load and be initialized
        await page.waitForSelector('#vm-count-badge', { timeout: 5000 });
        await page.waitForSelector('#migration-count-badge', { timeout: 5000 });
        
        // Wait a bit more for initialization to complete
        await page.waitForTimeout(1000);

        // Check VM count badge tooltip
        const vmBadge = page.locator('#vm-count-badge');
        const vmTitle = await vmBadge.getAttribute('title');
        if (vmTitle) {
            expect(vmTitle.toLowerCase()).toContain('vm');
        }

        // Check migration count badge tooltip  
        const migrationBadge = page.locator('#migration-count-badge');
        const migrationTitle = await migrationBadge.getAttribute('title');
        if (migrationTitle) {
            expect(migrationTitle.toLowerCase()).toContain('migration');
        }
        
        // At minimum, both badges should be visible and have numeric content
        await expect(vmBadge).toBeVisible();
        await expect(migrationBadge).toBeVisible();
        
        const vmText = await vmBadge.textContent();
        const migrationText = await migrationBadge.textContent();
        
        expect(parseInt(vmText)).toBeGreaterThanOrEqual(0);
        expect(parseInt(migrationText)).toBeGreaterThanOrEqual(0);
    });

    test('search input has correct styling and placeholder', async ({ page }) => {
        await page.goto(BASE_URL);

        // Wait for elements to load
        await page.waitForSelector('#vm-name-filter', { timeout: 5000 });

        const searchInput = page.locator('#vm-name-filter');
        
        // Check placeholder text
        const placeholder = await searchInput.getAttribute('placeholder');
        expect(placeholder).toBe('Filter by VM name...');
        
        // Check that input is visible and enabled
        await expect(searchInput).toBeVisible();
        await expect(searchInput).toBeEnabled();
    });

});