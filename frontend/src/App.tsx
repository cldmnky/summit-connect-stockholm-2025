import React from 'react'
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  AppBar,
  Toolbar,
} from '@mui/material'
import DatacenterMap from './components/DatacenterMap'
import DatacenterPanel from './components/DatacenterPanel'
import StatsPanel from './components/StatsPanel'
import { DatacenterProvider } from './contexts/DatacenterContext'

function App() {
  return (
    <DatacenterProvider>
      <Box sx={{ flexGrow: 1, minHeight: '100vh', backgroundColor: '#1f1f1f' }}>
        <AppBar position="static" color="primary" elevation={0}>
          <Toolbar sx={{ borderBottom: '1px solid #404040' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box 
                sx={{ 
                  width: 24, 
                  height: 24, 
                  backgroundColor: '#0066cc', 
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'white'
                }}
              >
                SC
              </Box>
              <Typography variant="h6" component="div" sx={{ 
                flexGrow: 1,
                fontWeight: 600,
                color: '#ffffff'
              }}>
                Stockholm County Datacenters
              </Typography>
            </Box>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 3, mb: 3, px: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ 
              fontWeight: 600,
              color: '#ffffff',
              mb: 1
            }}>
              Datacenter Overview
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ 
              fontSize: '0.875rem',
              color: '#c1c7cd'
            }}>
              Interactive map showing datacenter locations and virtual machine distribution across Stockholm County
            </Typography>
          </Box>

          <Grid container spacing={3} sx={{ minHeight: 'calc(100vh - 240px)' }}>
            <Grid item xs={12} lg={9}>
              <Card sx={{ 
                height: '100%', 
                position: 'relative',
                backgroundColor: '#2a2a2a',
                border: '1px solid #404040'
              }}>
                <CardContent sx={{ 
                  p: 0, 
                  height: '100%', 
                  '&:last-child': { pb: 0 },
                  position: 'relative'
                }}>
                  <Box sx={{ position: 'relative', height: '100%', minHeight: '600px' }}>
                    <DatacenterMap />
                    <Box sx={{ 
                      position: 'absolute', 
                      top: 16, 
                      right: 16, 
                      zIndex: 1000,
                      '& .MuiPaper-root': {
                        backgroundColor: 'rgba(42, 42, 42, 0.95)',
                        backdropFilter: 'blur(8px)',
                      }
                    }}>
                      <StatsPanel />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} lg={3}>
              <Box sx={{ height: '100%' }}>
                <DatacenterPanel />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </DatacenterProvider>
  )
}

export default App