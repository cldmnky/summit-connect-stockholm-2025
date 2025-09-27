const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PW_BASE_URL || 'http://127.0.0.1:3001';

test.describe('Debug React UI', () => {
    test('check what elements are rendered', async ({ page }) => {
        // Capture console messages and errors BEFORE navigation
        const consoleMessages = [];
        const networkFailures = [];
        
        page.on('console', msg => {
            consoleMessages.push(`${msg.type()}: ${msg.text()}`);
            if (msg.type() === 'error') {
                console.log('🚨 Browser console error:', msg.text());
            }
        });
        
        page.on('requestfailed', request => {
            const failure = `${request.method()} ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`;
            networkFailures.push(failure);
            console.log('🌐 Network request failed:', failure);
        });
        
        page.on('pageerror', error => {
            console.log('💥 Page error:', error.message);
            console.log('Stack:', error.stack);
        });

        await page.goto(BASE_URL);
        
        // Wait a bit for React to render and capture any async errors
        await page.waitForTimeout(8000);
        
        // Take a screenshot
        await page.screenshot({ path: 'debug-ui.png', fullPage: true });
        
        // Get the page title
        const title = await page.title();
        console.log('📄 Page title:', title);
        
        // Check if React root has any content
        const rootContent = await page.locator('#root').innerHTML();
        console.log('🔍 React root content:', rootContent);
        
        // Check for Material UI elements
        const muiContainer = await page.locator('[class*="MuiContainer"]').count();
        console.log('📦 MUI Container elements found:', muiContainer);
        
        const muiAppBar = await page.locator('[class*="MuiAppBar"]').count();
        console.log('🎯 MUI AppBar elements found:', muiAppBar);
        
        const muiCard = await page.locator('[class*="MuiCard"]').count();
        console.log('🃏 MUI Card elements found:', muiCard);
        
        // Check for any React elements
        const reactApp = await page.locator('#root').count();
        console.log('⚛️ React app root found:', reactApp);
        
        // Check for loading indicators
        const loadingElements = await page.locator('text=loading').count();
        console.log('⏳ Loading elements found:', loadingElements);
        
        // Check for any error messages in the DOM
        const errorElements = await page.locator('text=/error|Error|ERROR/i').count();
        console.log('❌ Error text elements found:', errorElements);
        
        // Print all console messages
        console.log('📝 All console messages:');
        consoleMessages.forEach((msg, i) => console.log(`  ${i + 1}. ${msg}`));
        
        // Print all network failures
        if (networkFailures.length > 0) {
            console.log('🚫 Network failures:');
            networkFailures.forEach((failure, i) => console.log(`  ${i + 1}. ${failure}`));
        }
        
        // Check if JS bundle loaded
        const scriptTags = await page.locator('script[src]').count();
        console.log('📜 Script tags found:', scriptTags);
        
        // Get all script sources
        const scripts = await page.locator('script[src]').evaluateAll(scripts => 
            scripts.map(script => script.src)
        );
        console.log('📄 Script sources:', scripts);
        
        // Check if CSS loaded
        const cssTags = await page.locator('link[rel="stylesheet"]').count();
        console.log('🎨 CSS link tags found:', cssTags);
    });
});