# E2E Testing for Stockholm Datacenters App

This directory contains Playwright end-to-end tests for the Stockholm Datacenters application.

## Test Coverage

### Core Functionality Tests

1. **`vm-list.spec.js`** - Original VM list rendering and basic functionality
2. **`map-interactions.spec.js`** - Map loading, controls, markers, and stats panel
3. **`migration-functionality.spec.js`** - Migration panel, filters, overlays, and refresh
4. **`vm-management.spec.js`** - VM filtering, hide inactive toggle, and center functionality
5. **`datacenter-overview.spec.js`** - Datacenter panel, force graphs, responsive layout
6. **`api-integration.spec.js`** - API error handling, timeouts, malformed responses, retries

### Key Features Tested

- ✅ **Migration Overlays**: Active-only filtering, VM node styling, left column positioning
- ✅ **Interactive Map**: Leaflet integration, markers, controls, satellite toggle
- ✅ **VM Management**: Filtering, center-on-map, hide inactive VMs
- ✅ **Migration Tracking**: Filter by status, refresh functionality, list display
- ✅ **Responsive Design**: Layout works on desktop, tablet, and mobile
- ✅ **Error Handling**: API failures, timeouts, malformed responses
- ✅ **User Experience**: Tooltips, toasts, accessibility attributes

## Setup and Installation

1. **Install Dependencies**:

   ```bash
   npm install
   npm run test:install  # Install browser binaries
   ```

2. **Start the Application Server**:

   ```bash
   # In the project root
   ./tmp/summit-connect serve backend --config config/datacenters.yaml --watch-vms --port 3001
   ```

## Running Tests

### Basic Commands

```bash
# Run all tests (headless)
npm run test:e2e

# Run tests with visible browser
npm run test:e2e:headed

# Run tests with interactive UI
npm run test:e2e:ui

# Debug tests step by step
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

### Advanced Options

```bash
# Run specific test file
npx playwright test vm-list.spec.js

# Run tests matching a pattern
npx playwright test --grep "migration"

# Run tests in specific browser
npx playwright test --project=firefox

# Run tests with custom base URL
PW_BASE_URL=http://localhost:8080 npx playwright test
```

## Test Environment

- **Default Server**: `http://127.0.0.1:3001`
- **Custom Server**: Set `PW_BASE_URL` environment variable
- **Browser Support**: Chrome, Firefox, Safari/WebKit
- **Viewport**: 1200x800 (desktop), with responsive testing
- **Screenshots**: Captured on test failures
- **Videos**: Recorded for failed tests
- **Traces**: Available for debugging failures

## Test Structure

Each test file focuses on a specific area of functionality:

- **Arrange**: Load the page and wait for key elements
- **Act**: Perform user interactions (clicks, form inputs, etc.)
- **Assert**: Verify expected behavior and UI state

Tests are designed to be:

- **Resilient**: Work with or without real backend data
- **Independent**: Each test can run in isolation
- **Fast**: Use appropriate waits and timeouts
- **Readable**: Clear test names and good documentation

## Debugging Failed Tests

1. **View Screenshots**: Check `test-results/` directory for failure screenshots
2. **Watch Videos**: Failed test videos show exactly what happened
3. **Use Traces**: Interactive timeline of test execution
4. **Debug Mode**: Step through tests line by line with `--debug`
5. **Headed Mode**: Watch tests run in real browser with `--headed`

## Contributing

When adding new features to the application:

1. Add corresponding test coverage in the appropriate spec file
2. Update this README if new test categories are added
3. Ensure tests work both with and without live backend data
4. Follow existing test patterns for consistency

## Troubleshooting

### Common Issues

- **Server not running**: Ensure backend server is started on port 3001
- **API timeouts**: Check network connectivity and server response times
- **Browser installation**: Run `npm run test:install` to install browsers
- **Port conflicts**: Use `PW_BASE_URL` to specify different port

### Test Data Dependencies

Tests are designed to work with minimal dependencies on specific data:

- Migration overlays may not always be present (depends on active migrations)
- VM counts vary based on backend data
- Tests verify functionality works regardless of data volume
