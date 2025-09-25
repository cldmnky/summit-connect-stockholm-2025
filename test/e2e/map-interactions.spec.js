const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PW_BASE_URL || 'http://127.0.0.1:3001';

test.describe('Map interactions', () => {
  test('map loads and is interactive', async ({ page }) => {
    await page.goto(BASE_URL);

    // Wait for map to load
    await page.waitForSelector('#map', { timeout: 5000 });
    await page.waitForSelector('.leaflet-container', { timeout: 5000 });

    // Map container should be visible
    await expect(page.locator('#map')).toBeVisible();
    
    // Map should have leaflet controls
    await expect(page.locator('.leaflet-control-zoom')).toBeVisible();
    
    // Legend should be visible
    await expect(page.locator('.legend')).toBeVisible();
    await expect(page.locator('.legend-item')).toHaveCount(2);
  });

  test('map controls work', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.waitForSelector('.map-controls', { timeout: 5000 });

    // Toggle satellite view button should be visible and clickable
    const toggleBtn = page.locator('#toggle-satellite');
    await expect(toggleBtn).toBeVisible();
    
    // Button should start as "Street View"
    await expect(toggleBtn).toHaveText('Street View');
    
    await toggleBtn.click();
    
    // Button text should change after click
    await expect(toggleBtn).toHaveText('Satellite View');

    // Center map button should be visible and clickable  
    const centerBtn = page.locator('#center-map');
    await expect(centerBtn).toBeVisible();
    await centerBtn.click();
  });

  test('datacenter markers are visible on map', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.waitForSelector('.leaflet-container', { timeout: 5000 });
    
    // Wait a bit for markers to load
    await page.waitForTimeout(2000);
    
    // Should have datacenter markers (custom divicons or leaflet markers)
    const markers = page.locator('.leaflet-marker-icon, .datacenter-marker');
    await expect(markers.first()).toBeVisible();
  });

  test('stats panel shows correct information', async ({ page }) => {
    await page.goto(BASE_URL);
    
    await page.waitForSelector('#stats-panel', { timeout: 5000 });
    
    // Stats panel should be visible
    await expect(page.locator('#stats-panel')).toBeVisible();
    
    // Should show total VMs and active datacenters
    const totalVms = page.locator('#total-vms');
    const activeDatacenters = page.locator('#active-datacenters');
    
    await expect(totalVms).toBeVisible();
    await expect(activeDatacenters).toBeVisible();
    
    // Values should be numbers
    const totalVmsText = await totalVms.textContent();
    const activeDatacentersText = await activeDatacenters.textContent();
    
    expect(totalVmsText).toMatch(/^\d+$/);
    expect(activeDatacentersText).toMatch(/^\d+$/);
  });
});