const { test, expect } = require('@playwright/test');

test('Debug map visibility issue', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:3001');
  
  console.log('\n=== PAGE LOADED ===');
  
  // Wait for the page to load
  await page.waitForTimeout(2000);
  
  // Take a screenshot
  await page.screenshot({ path: 'debug-page.png', fullPage: true });
  
  console.log('\n=== ELEMENT INSPECTION ===');
  
  // Check main grid container (the one with style="margin: 0;")
  const mainGrid = page.locator('main .pf-v6-l-grid.pf-m-gutter').first();
  const gridExists = await mainGrid.count();
  console.log(`Main grid container exists: ${gridExists > 0}`);
  
  if (gridExists > 0) {
    const gridProps = await mainGrid.evaluate(el => ({
      display: getComputedStyle(el).display,
      height: getComputedStyle(el).height,
      width: getComputedStyle(el).width,
      offsetHeight: el.offsetHeight,
      offsetWidth: el.offsetWidth,
      classList: Array.from(el.classList),
      styles: el.getAttribute('style')
    }));
    console.log('Main grid properties:', gridProps);
  }
  
  // Check grid item (left column)
  const gridItem = await page.locator('.pf-v6-l-grid__item.pf-m-9-col-on-lg').count();
  console.log(`Left grid item exists: ${gridItem > 0}`);
  
  if (gridItem > 0) {
    const itemProps = await page.locator('.pf-v6-l-grid__item.pf-m-9-col-on-lg').evaluate(el => ({
      display: getComputedStyle(el).display,
      height: getComputedStyle(el).height,
      width: getComputedStyle(el).width,
      offsetHeight: el.offsetHeight,
      offsetWidth: el.offsetWidth,
      flex: getComputedStyle(el).flex
    }));
    console.log('Left grid item properties:', itemProps);
  }
  
  // Check map container card
  const mapContainer = await page.locator('.map-container').count();
  console.log(`Map container exists: ${mapContainer > 0}`);
  
  if (mapContainer > 0) {
    const containerProps = await page.locator('.map-container').evaluate(el => ({
      display: getComputedStyle(el).display,
      height: getComputedStyle(el).height,
      width: getComputedStyle(el).width,
      offsetHeight: el.offsetHeight,
      offsetWidth: el.offsetWidth,
      classList: Array.from(el.classList)
    }));
    console.log('Map container properties:', containerProps);
  }
  
  // Check card body
  const cardBody = await page.locator('.map-container .pf-v6-c-card__body').count();
  console.log(`Card body exists: ${cardBody > 0}`);
  
  if (cardBody > 0) {
    const bodyProps = await page.locator('.map-container .pf-v6-c-card__body').evaluate(el => ({
      display: getComputedStyle(el).display,
      height: getComputedStyle(el).height,
      width: getComputedStyle(el).width,
      offsetHeight: el.offsetHeight,
      offsetWidth: el.offsetWidth,
      position: getComputedStyle(el).position
    }));
    console.log('Card body properties:', bodyProps);
  }
  
  // Check map element
  const mapElement = await page.locator('#map').count();
  console.log(`Map element exists: ${mapElement > 0}`);
  
  if (mapElement > 0) {
    const mapProps = await page.locator('#map').evaluate(el => ({
      display: getComputedStyle(el).display,
      visibility: getComputedStyle(el).visibility,
      opacity: getComputedStyle(el).opacity,
      height: getComputedStyle(el).height,
      width: getComputedStyle(el).width,
      offsetHeight: el.offsetHeight,
      offsetWidth: el.offsetWidth,
      clientHeight: el.clientHeight,
      clientWidth: el.clientWidth,
      classList: Array.from(el.classList),
      innerHTML: el.innerHTML.length > 0 ? `Has content (${el.innerHTML.length} chars)` : 'Empty'
    }));
    console.log('Map element properties:', mapProps);
  }
  
  // Check if Leaflet is loaded and map is initialized
  const leafletCheck = await page.evaluate(() => {
    return {
      leafletExists: typeof window.L !== 'undefined',
      mapInstance: window.map ? 'Map instance exists' : 'No map instance',
      leafletVersion: window.L ? window.L.version : 'N/A'
    };
  });
  console.log('Leaflet status:', leafletCheck);
  
  // Check for JavaScript errors
  console.log('\n=== JAVASCRIPT ERRORS ===');
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('JS Error:', msg.text());
    }
  });
  
  // Wait a bit more and recheck
  await page.waitForTimeout(3000);
  
  console.log('\n=== FINAL CHECK AFTER 3s ===');
  
  const finalMapCheck = await page.locator('#map').evaluate(el => ({
    offsetHeight: el.offsetHeight,
    offsetWidth: el.offsetWidth,
    hasLeafletClasses: Array.from(el.classList).some(c => c.includes('leaflet'))
  }));
  console.log('Final map check:', finalMapCheck);
  
  console.log('\n=== DEBUG COMPLETE ===');
});