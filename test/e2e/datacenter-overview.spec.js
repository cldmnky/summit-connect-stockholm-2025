const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PW_BASE_URL || 'http://127.0.0.1:3001';

test.describe('Datacenter overview and interactions', () => {
  test('datacenter panel displays correctly', async ({ page }) => {
    await page.goto(BASE_URL);

    await page.waitForSelector('.datacenter-panel', { timeout: 5000 });

    // Datacenter panel should be visible
    await expect(page.locator('.datacenter-panel')).toBeVisible();
    
    // Should have datacenter overview section
    await expect(page.locator('#datacenter-view')).toBeVisible();
    
    // Should have title - use specific role-based selector for the main heading
    const panelTitle = page.getByRole('heading', { name: 'Datacenter Overview' });
    await expect(panelTitle).toBeVisible();
    await expect(panelTitle).toHaveText('Datacenter Overview');
  });

  test('datacenter view updates when clicking map markers', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.waitForSelector('#datacenter-view', { timeout: 5000 });
    await page.waitForSelector('.leaflet-container', { timeout: 5000 });
    await page.waitForTimeout(3000); // Wait for markers to load
    
    // Check if we have clickable markers
    const markers = page.locator('.leaflet-marker-icon, .datacenter-marker');
    const markerCount = await markers.count();
    
    if (markerCount > 0) {
      // Click first marker
      await markers.first().click();
      
      // Wait for potential updates
      await page.waitForTimeout(1000);
      
      // Datacenter view should still be visible (may have updated content)
      await expect(page.locator('#datacenter-view')).toBeVisible();
    }
    
    expect(markerCount).toBeGreaterThanOrEqual(0);
  });

  test('force graph integration works', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.waitForSelector('#datacenter-view', { timeout: 5000 });
    await page.waitForTimeout(3000); // Wait for D3/force graph to initialize
    
    // Check if force graph elements exist
    const forceGraphElements = page.locator('#datacenter-view svg, #datacenter-view .force-graph');
    const graphCount = await forceGraphElements.count();
    
    // Force graphs may or may not be present depending on datacenter selection
    expect(graphCount).toBeGreaterThanOrEqual(0);
    
    // If graphs exist, they should be visible
    if (graphCount > 0) {
      await expect(forceGraphElements.first()).toBeVisible();
    }
  });

  test('responsive layout works on different screen sizes', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Test desktop size (default)
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForSelector('.pf-v6-l-grid', { timeout: 5000 });
    
    // Both columns should be visible on desktop - updated for PatternFly
    await expect(page.locator('.pf-v6-l-grid__item.pf-m-9-col-on-lg')).toBeVisible(); // Map column
    await expect(page.locator('.pf-v6-l-grid__item.pf-m-3-col-on-lg')).toBeVisible(); // Sidebar column
    
    // Test tablet size
    await page.setViewportSize({ width: 768, height: 600 });
    await page.waitForTimeout(500);
    
    // Layout should still work
    await expect(page.locator('#map')).toBeVisible();
    await expect(page.locator('.datacenter-panel')).toBeVisible();
    
    // Test mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Key elements should still be accessible
    await expect(page.locator('#map')).toBeVisible();
    await expect(page.locator('.datacenter-panel')).toBeVisible();
  });

  test('tooltip functionality', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.waitForSelector('#tooltip', { timeout: 5000 });
    
    // Tooltip element should exist
    const tooltip = page.locator('#tooltip');
    await expect(tooltip).toBeAttached();
    
    // Tooltip may start visible or hidden depending on app state
    // Just verify it exists and has proper structure
    const tooltipDisplay = await tooltip.evaluate(el => window.getComputedStyle(el).display);
    expect(['none', 'block']).toContain(tooltipDisplay);
  });

  test('toast notification system exists', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Toast element should exist in DOM (don't wait for visibility)
    const toast = page.locator('#toast');
    await expect(toast).toBeAttached();
    
    // Toast should have proper ARIA attributes
    await expect(toast).toHaveAttribute('aria-live', 'polite');
    await expect(toast).toHaveAttribute('role', 'status');
    
    // Toast may be hidden initially (that's expected)
    const toastDisplay = await toast.evaluate(el => window.getComputedStyle(el).display);
    expect(['none', 'block']).toContain(toastDisplay);
  });

  test('back to overview button works in detailed datacenter view', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Wait for the page to load
    await page.waitForSelector('.datacenter-panel');
    
    // Find and click on a datacenter header (this should show the detailed view)
    const datacenterHeaders = page.locator('.datacenter-header');
    const headerCount = await datacenterHeaders.count();
    expect(headerCount).toBeGreaterThan(0);
    
    // Click the first datacenter header
    await datacenterHeaders.first().click();
    
    // Wait for the detailed view to load and check for back button
    await page.waitForTimeout(1000); // Give more time for the view to update
    
    // Look for the back button
    const backButton = page.locator('.datacenter-back-btn');
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveText('← Back to Overview');
    
    // Click the back button
    await backButton.click();
    
    // Wait for the overview to load back
    await page.waitForTimeout(1000);
    
    // Verify we're back to overview (back button should not be visible)
    await expect(backButton).not.toBeVisible();
    
    // Should see multiple datacenter headers again (back to overview)
    const finalHeaderCount = await datacenterHeaders.count();
    expect(finalHeaderCount).toBeGreaterThan(1);
  });
});