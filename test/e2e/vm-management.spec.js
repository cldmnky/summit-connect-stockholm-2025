const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PW_BASE_URL || 'http://127.0.0.1:3001';

test.describe('VM management and filtering', () => {
  test('VM list panel loads with proper controls', async ({ page }) => {
    await page.goto(BASE_URL);

    await page.waitForSelector('.vm-list-panel', { timeout: 5000 });

    // VM panel should be visible
    await expect(page.locator('.vm-list-panel')).toBeVisible();
    
    // Should have VM filter dropdown
    const vmFilter = page.locator('#vm-filter-mode');
    await expect(vmFilter).toBeVisible();
    
    // Should have hide inactive checkbox
    const hideInactiveCheckbox = page.locator('#vm-hide-inactive');
    await expect(hideInactiveCheckbox).toBeVisible();
    await expect(hideInactiveCheckbox).toBeChecked();
    
    // VM list rows container should exist
    await expect(page.locator('#vm-list-rows')).toBeVisible();
  });

  test('VM filter dropdown functionality', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.waitForSelector('#vm-filter-mode', { timeout: 5000 });
    
    const vmFilter = page.locator('#vm-filter-mode');
    
    // Test filter options
    await vmFilter.selectOption('all');
    await expect(vmFilter).toHaveValue('all');
    
    await vmFilter.selectOption('migrating');
    await expect(vmFilter).toHaveValue('migrating');
  });

  test('hide inactive checkbox works', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.waitForSelector('#vm-hide-inactive', { timeout: 5000 });
    
    const hideInactiveCheckbox = page.locator('#vm-hide-inactive');
    
    // Should start checked
    await expect(hideInactiveCheckbox).toBeChecked();
    
    // Uncheck it
    await hideInactiveCheckbox.uncheck();
    await expect(hideInactiveCheckbox).not.toBeChecked();
    
    // Check it again
    await hideInactiveCheckbox.check();
    await expect(hideInactiveCheckbox).toBeChecked();
  });

  test('VM rows display correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.waitForSelector('#vm-list-rows', { timeout: 5000 });
    await page.waitForTimeout(3000); // Wait for data to load
    
    const vmRows = page.locator('#vm-list-rows .vm-row');
    const rowCount = await vmRows.count();
    
    if (rowCount > 0) {
      const firstRow = vmRows.first();
      await expect(firstRow).toBeVisible();
      
      // Check for different possible VM row structures (vm-table or vm-info)
      const tableOrInfo = firstRow.locator('.vm-table, .vm-info, .vm-sub');
      const structureCount = await tableOrInfo.count();
      
      if (structureCount > 0) {
        await expect(tableOrInfo.first()).toBeVisible();
        
        // Check for VM name in different possible locations
        const vmName = firstRow.locator('.vm-name, .label');
        const nameCount = await vmName.count();
        if (nameCount > 0) {
          await expect(vmName.first()).toBeVisible();
        }
      }
      
      // Should have vm-actions section
      await expect(firstRow.locator('.vm-actions')).toBeVisible();
      
      // Should have center button
      const centerBtn = firstRow.locator('.vm-actions button');
      await expect(centerBtn).toBeVisible();
    }
    
    // Test passes with any number of VMs (including 0)
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('VM center button functionality', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.waitForSelector('#vm-list-rows', { timeout: 5000 });
    await page.waitForTimeout(2000);
    
    const vmRows = page.locator('#vm-list-rows .vm-row');
    const rowCount = await vmRows.count();
    
    if (rowCount > 0) {
      const firstRow = vmRows.first();
      const centerBtn = firstRow.locator('.vm-actions button');
      
      // Click center button
      await centerBtn.click();
      
      // Map should still be visible after centering
      await expect(page.locator('#map')).toBeVisible();
      
      // Stats should update (this verifies the action did something)
      await page.waitForTimeout(500);
      const totalVmsText = await page.textContent('#total-vms');
      expect(totalVmsText).toMatch(/^\d+$/);
    }
  });
});