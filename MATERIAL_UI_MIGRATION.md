# Migration to Material UI

This document explains the migration from Bulma CSS + Vanilla JavaScript to Material UI + React.

## What Changed

### 🎨 CSS Framework Migration
- **From:** Bulma CSS Framework
- **To:** Material UI (MUI) with React

### 🔧 Technology Stack Migration
- **From:** Vanilla JavaScript + Bulma + Leaflet
- **To:** React + TypeScript + Material UI + React-Leaflet

### 📁 Project Structure
```
frontend/
├── index.html           # Updated to load React app
├── vite.config.ts      # Vite configuration for development
├── tsconfig.json       # TypeScript configuration
├── src/
│   ├── main.tsx        # React app entry point
│   ├── App.tsx         # Main app component
│   ├── types/
│   │   └── index.ts    # TypeScript type definitions
│   ├── contexts/
│   │   └── DatacenterContext.tsx  # React context for state management
│   └── components/
│       ├── DatacenterMap.tsx      # Map component using React-Leaflet
│       ├── DatacenterPanel.tsx    # Datacenter info panel
│       └── StatsPanel.tsx         # Statistics panel
├── app.js.backup       # Original vanilla JS (backup)
└── styles.css.backup   # Original Bulma styles (backup)
```

## Key Features Migrated

### 🗺️ Interactive Map
- **Before:** Leaflet.js with vanilla JS
- **After:** React-Leaflet with Material UI components
- Features preserved:
  - Stockholm datacenter markers
  - Interactive popups with datacenter information
  - VM count display
  - Click-to-select functionality

### 📊 Statistics Panel
- **Before:** Custom CSS styling with Bulma classes
- **After:** Material UI Paper and Typography components
- Features preserved:
  - Total VMs count
  - Active datacenters count
  - Real-time updates

### 🏢 Datacenter Panel
- **Before:** Bulma cards and custom styling
- **After:** Material UI Card, List, and Chip components
- Features preserved:
  - Datacenter overview
  - VM filtering (all/migrating/hide inactive)
  - Migration status tracking
  - Refresh functionality

### 🎨 UI Components Migration

#### Typography
- **Before:** Bulma title/subtitle classes
- **After:** Material UI Typography component with variants

#### Buttons
- **Before:** Bulma button classes
- **After:** Material UI Button component with variants

#### Cards
- **Before:** Bulma box/card classes  
- **After:** Material UI Card/Paper components

#### Form Controls
- **Before:** HTML select/input elements
- **After:** Material UI Select, Switch, FormControl components

#### Icons
- **Before:** Emoji and text-based indicators
- **After:** Material UI Icons (@mui/icons-material)

## Development Commands

### Start Development Server
```bash
npm run dev
```
This starts Vite development server at `http://localhost:3000`

### Build for Production
```bash
npm run build
```
Builds the app for production to the `dist/` directory

### Preview Production Build
```bash
npm run preview
```
Preview the production build locally

## Material UI Theme Configuration

The app uses a custom Material UI theme with:
- **Primary Color:** `#0066cc` (blue)
- **Secondary Color:** `#0ea5a4` (teal)
- **Typography:** Roboto font family
- **Background:** Light mode with `#f5f5f5` default background

## API Integration

The React app maintains the same API endpoints:
- `/api/v1/datacenters` - Fetch datacenter information
- `/api/v1/migrations` - Fetch migration status

## Responsive Design

Material UI's Grid system provides responsive layouts:
- **Desktop:** 9/3 column split (map/panel)
- **Tablet/Mobile:** Stacked layout

## Component Architecture

### Context-Based State Management
- `DatacenterContext` provides centralized state management
- Handles API calls, data fetching, and state updates
- Auto-refresh functionality every 5 seconds

### Component Hierarchy
```
App.tsx
├── DatacenterMap.tsx
├── StatsPanel.tsx
└── DatacenterPanel.tsx
```

## Migration Benefits

1. **Modern Development Experience**
   - TypeScript for type safety
   - React for component-based architecture
   - Hot module replacement with Vite

2. **Enhanced UI/UX**
   - Material Design consistency
   - Built-in accessibility features
   - Responsive design patterns

3. **Maintainability**
   - Component reusability
   - Centralized state management
   - TypeScript type safety

4. **Performance**
   - React's virtual DOM optimization
   - Vite's fast build system
   - Code splitting and lazy loading support

## Backwards Compatibility

The migration maintains:
- ✅ All existing API endpoints
- ✅ Same visual layout and functionality  
- ✅ Interactive map features
- ✅ Real-time data updates
- ✅ Migration monitoring

## Next Steps

1. **Testing:** Run end-to-end tests to ensure functionality parity
2. **Performance:** Monitor and optimize bundle size if needed
3. **Features:** Add new Material UI components for enhanced UX
4. **Accessibility:** Leverage Material UI's built-in accessibility features

## Troubleshooting

### Common Issues

1. **Map not rendering:** Ensure Leaflet CSS is imported in main.tsx
2. **Icons not showing:** Verify Material Icons font is loaded
3. **API errors:** Check that the backend server is running on port 8080

### Development Issues
- Make sure to run `npm install` after pulling changes
- Clear browser cache if seeing stale content
- Check browser console for React/TypeScript errors