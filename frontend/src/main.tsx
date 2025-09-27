import React from 'react'
import ReactDOM from 'react-dom/client'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import 'leaflet/dist/leaflet.css'

import App from './App'

// Add Red Hat Display font for OpenShift-like appearance
const fontStyle = document.createElement('style')
fontStyle.innerHTML = `
  @import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@300;400;500;600;700&family=Red+Hat+Text:wght@300;400;500;600;700&display=swap');
`
document.head.appendChild(fontStyle)

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#0066cc',
      light: '#4dabf7',
      dark: '#004ba0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#73bcf7',
      light: '#a3d5f9',
      dark: '#4c9af1',
    },
    background: {
      default: '#1f1f1f',
      paper: '#2a2a2a',
    },
    text: {
      primary: '#ffffff',
      secondary: '#c1c7cd',
    },
    divider: '#404040',
    success: {
      main: '#3e8635',
      light: '#5ba352',
      dark: '#2d5f24',
    },
    warning: {
      main: '#f0ab00',
      light: '#f4c430',
      dark: '#c58c00',
    },
    error: {
      main: '#c9190b',
      light: '#d73527',
      dark: '#a30000',
    },
    info: {
      main: '#73bcf7',
      light: '#bee1f4',
      dark: '#2b9af3',
    },
  },
  typography: {
    fontFamily: '"Red Hat Text", "RedHatText", "Overpass", overpass, helvetica, arial, sans-serif',
    h4: {
      fontWeight: 600,
      fontSize: '1.75rem',
      color: '#ffffff',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      color: '#ffffff',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
      color: '#ffffff',
    },
    subtitle1: {
      color: '#c1c7cd',
      fontSize: '0.875rem',
    },
    subtitle2: {
      fontWeight: 500,
      fontSize: '0.875rem',
      color: '#ffffff',
    },
    body1: {
      fontSize: '0.875rem',
      color: '#ffffff',
    },
    body2: {
      fontSize: '0.75rem',
      color: '#c1c7cd',
    },
    caption: {
      fontSize: '0.75rem',
      color: '#c1c7cd',
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
          padding: 0,
          minHeight: '100vh',
          backgroundColor: '#1f1f1f',
        },
        '*': {
          scrollbarWidth: 'thin',
          scrollbarColor: '#404040 #2a2a2a',
        },
        '*::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '*::-webkit-scrollbar-track': {
          background: '#2a2a2a',
        },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: '#404040',
          borderRadius: '4px',
          '&:hover': {
            backgroundColor: '#525252',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#151515',
          borderBottom: '1px solid #404040',
          boxShadow: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
          border: '1px solid #404040',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#2a2a2a',
          border: '1px solid #404040',
          boxShadow: 'none',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#363636',
          '& .MuiTableCell-head': {
            color: '#c1c7cd',
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #404040',
          color: '#ffffff',
          fontSize: '0.875rem',
          padding: '12px 16px',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: '0.75rem',
          fontWeight: 500,
        },
        colorSuccess: {
          backgroundColor: '#3e8635',
          color: '#ffffff',
          '&.MuiChip-outlined': {
            borderColor: '#3e8635',
            backgroundColor: 'rgba(62, 134, 53, 0.1)',
          },
        },
        colorWarning: {
          backgroundColor: '#f0ab00',
          color: '#000000',
          '&.MuiChip-outlined': {
            borderColor: '#f0ab00',
            backgroundColor: 'rgba(240, 171, 0, 0.1)',
            color: '#f0ab00',
          },
        },
        colorError: {
          backgroundColor: '#c9190b',
          color: '#ffffff',
          '&.MuiChip-outlined': {
            borderColor: '#c9190b',
            backgroundColor: 'rgba(201, 25, 11, 0.1)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.875rem',
        },
        containedPrimary: {
          backgroundColor: '#0066cc',
          '&:hover': {
            backgroundColor: '#004ba0',
          },
        },
      },
    },
    MuiList: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #404040',
          '&:last-child': {
            borderBottom: 'none',
          },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: '#404040',
        },
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)