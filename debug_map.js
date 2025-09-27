const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true,
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 }
  });
  
  const page = await context.newPage();
  
  // Navigate to the app
  await page.goto('http://localhost:8080');
  
  // Wait a moment for the page to load
  await page.waitForTimeout(2000);
  
  console.log('=== PAGE TITLE ===');
  console.log(await page.title());
  
  console.log('\n=== MAP ELEMENT INSPECTION ===');
  
  // Check if map element exists
  const mapExists = await page.locator('#map').count();
  console.log(`Map element exists: ${mapExists > 0}`);
  
  if (mapExists > 0) {
    // Get map element properties
    const mapProps = await page.locator('#map').evaluate(el => ({
      display: getComputedStyle(el).display,
      visibility: getComputedStyle(el).visibility,
      opacity: getComputedStyle(el).opacity,
      width: getComputedStyle(el).width,
      height: getComputedStyle(el).height,
      position: getComputedStyle(el).position,
      zIndex: getComputedStyle(el).zIndex,
      innerHTML: el.innerHTML.substring(0, 200) + '...',
      classList: Array.from(el.classList),
      offsetWidth: el.offsetWidth,
      offsetHeight: el.offsetHeight,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight
    }));
    
    console.log('Map element properties:', mapProps);
  }
  
  console.log('\n=== MAP CONTAINER INSPECTION ===');
  
  // Check map container
  const mapContainer = await page.locator('.map-container').count();
  console.log(`Map container exists: ${mapContainer > 0}`);
  
  if (mapContainer > 0) {
    const containerProps = await page.locator('.map-container').evaluate(el => ({
      display: getComputedStyle(el).display,
      width: getComputedStyle(el).width,
      height: getComputedStyle(el).height,
      classList: Array.from(el.classList),
      offsetWidth: el.offsetWidth,
      offsetHeight: el.offsetHeight
    }));
    
    console.log('Map container properties:', containerProps);
  }
  
  console.log('\n=== CARD BODY INSPECTION ===');
  
  // Check card body
  const cardBody = await page.locator('.map-container .pf-v6-c-card__body').count();
  console.log(`Card body exists: ${cardBody > 0}`);
  
  if (cardBody > 0) {
    const cardBodyProps = await page.locator('.map-container .pf-v6-c-card__body').evaluate(el => ({
      display: getComputedStyle(el).display,
      width: getComputedStyle(el).width,
      height: getComputedStyle(el).height,
      position: getComputedStyle(el).position,
      offsetWidth: el.offsetWidth,
      offsetHeight: el.offsetHeight
    }));
    
    console.log('Card body properties:', cardBodyProps);
  }
  
  console.log('\n=== LEAFLET INSPECTION ===');
  
  // Check if Leaflet loaded
  const leafletLoaded = await page.evaluate(() => {
    return typeof window.L !== 'undefined';
  });
  console.log(`Leaflet loaded: ${leafletLoaded}`);
  
  // Check for any JavaScript errors
  console.log('\n=== CONSOLE ERRORS ===');
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  await page.waitForTimeout(3000);
  
  if (errors.length > 0) {
    console.log('JavaScript errors found:');
    errors.forEach(error => console.log(' -', error));
  } else {
    console.log('No JavaScript errors detected');
  }
  
  console.log('\n=== NETWORK REQUESTS ===');
  
  // Check for failed network requests
  const responses = [];
  page.on('response', response => {
    if (!response.ok()) {
      responses.push(`${response.status()} - ${response.url()}`);
    }
  });
  
  await page.reload();
  await page.waitForTimeout(2000);
  
  if (responses.length > 0) {
    console.log('Failed network requests:');
    responses.forEach(resp => console.log(' -', resp));
  } else {
    console.log('No failed network requests');
  }
  
  console.log('\n=== FINISHED - Browser will stay open for manual inspection ===');
  console.log('Press Ctrl+C to close');
  
  // Keep the browser open for manual inspection
  await page.waitForTimeout(300000); // 5 minutes
  
  await browser.close();
})();