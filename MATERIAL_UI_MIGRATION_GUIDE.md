# Material UI Migration Guide

## 🎯 Migration Summary

This project has been successfully migrated from **Bulma CSS + Vanilla JavaScript** to **React + Material UI**.

### What Changed:

- ✅ **Frontend Framework**: Vanilla JS → React 18 + TypeScript
- ✅ **CSS Framework**: Bulma CSS → Material UI (MUI) v5
- ✅ **Build Tool**: None → Vite (modern, fast)
- ✅ **Map Library**: Leaflet.js → React-Leaflet
- ✅ **State Management**: DOM manipulation → React Context API
- ✅ **Component Architecture**: Modular React components with Material Design
- ✅ **Go Embedding**: Updated to serve both development and production builds

### Features Preserved:
- ✅ Interactive Stockholm datacenter map
- ✅ VM and migration data visualization
- ✅ Real-time updates and filtering
- ✅ All API endpoints remain unchanged
- ✅ Responsive design for mobile/desktop

## 🚀 Development Workflow

### Prerequisites
```bash
# Install Node.js dependencies
npm install
```

### Development Mode (React Dev Server)
For frontend development with hot reloading:

```bash
# Terminal 1: Start React dev server (http://localhost:3000)
npm run dev

# Terminal 2: Start Go backend server (http://localhost:8080)
./summit-connect serve backend --port 8080
```

The React dev server (port 3000) will proxy API calls to the Go backend (port 8080).

### Production Mode (Go Embedded)
For production or testing the full embedded setup:

```bash
# 1. Build React application
npm run build

# 2. Build Go application (embeds the React build)
go build -o summit-connect .

# 3. Run the Go server (serves both API and React)
./summit-connect serve backend --port 8080
```

Then visit: http://localhost:8080

## 📁 Project Structure

```
frontend/
├── dist/                 # Built React files (embedded by Go)
├── src/
│   ├── components/       # Material UI React components
│   │   ├── DatacenterMap.tsx
│   │   ├── DatacenterPanel.tsx
│   │   └── StatsPanel.tsx
│   ├── contexts/         # React Context for state management
│   │   └── DatacenterContext.tsx
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts
│   ├── App.tsx           # Main React application
│   └── main.tsx          # React entry point
├── index.html            # HTML template
├── app.js.backup         # Original vanilla JS (backup)
└── styles.css.backup     # Original CSS (backup)
```

## 🎨 Material UI Components Used

- **Layout**: `Container`, `Grid`, `Box`, `Paper`
- **Navigation**: `AppBar`, `Toolbar`
- **Typography**: `Typography` with Material Design hierarchy
- **Data Display**: `Card`, `CardContent`, `List`, `ListItem`, `Chip`
- **Inputs**: `Button`, `Select`, `Switch`, `FormControl`
- **Feedback**: `CircularProgress` for loading states
- **Icons**: Material Icons from `@mui/icons-material`

## 🛠️ Go Server Integration

The Go server automatically detects and serves the correct files:

1. **Production**: Serves built React files from `frontend/dist/` (embedded)
2. **Development Fallback**: Serves development files from `frontend/` if build not found

### Embedding Process:
```go
//go:embed frontend/*
var FrontendFS embed.FS
```

The server looks for:
1. `frontend/dist/` (production build) first
2. Falls back to `frontend/` (development files)

## 🔧 Configuration Files

- `package.json` - Node.js dependencies and scripts
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript configuration
- `tsconfig.node.json` - Node.js TypeScript configuration

## 🎯 Material UI Theme

Custom theme configured in `src/main.tsx`:
```typescript
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0066cc' },    // Blue (original brand color)
    secondary: { main: '#0ea5a4' },  // Teal (migration accent color)
  },
  typography: {
    fontFamily: 'Roboto, "Red Hat Text", ...', // Roboto with fallbacks
  },
})
```

## 📱 Responsive Design

Material UI's responsive grid system provides:
- Mobile-first responsive design
- Automatic breakpoint handling
- Touch-friendly interactions
- Accessible components with ARIA labels

## 🚦 API Compatibility

All existing API endpoints remain unchanged:
- `GET /api/v1/datacenters`
- `GET /api/v1/migrations`
- `POST /api/v1/migrate`
- `GET /api/v1/status`

The React frontend consumes the same API as the original vanilla JS version.

## 🔍 Troubleshooting

### Development Server Issues
```bash
# If API calls fail, ensure Go backend is running:
./summit-connect serve backend --port 8080
```

### Build Issues
```bash
# Clean and rebuild:
rm -rf frontend/dist node_modules
npm install
npm run build
```

### Go Embedding Issues
```bash
# Ensure build files exist before Go build:
ls -la frontend/dist/
go build -o summit-connect .
```

## 📈 Benefits of Migration

1. **Modern Development**: TypeScript, hot reloading, component architecture
2. **Material Design**: Consistent, accessible UI following Google's design system
3. **Better State Management**: React Context instead of DOM manipulation
4. **Type Safety**: TypeScript for better development experience
5. **Performance**: Optimized builds with tree-shaking and code splitting
6. **Maintainability**: Modular components and clear separation of concerns
7. **Mobile Ready**: Material UI's responsive design system

## 🎉 Next Steps

The application is now running with Material UI! You can:
- Customize the Material UI theme in `src/main.tsx`
- Add new Material UI components as needed
- Extend the React Context for more complex state management
- Add Material UI animations and transitions
- Implement dark/light theme switching

The migration preserves all existing functionality while providing a modern, maintainable foundation for future development.