import React from 'react'
import {
  Paper,
  Typography,
  Box,
  Grid,
  CircularProgress,
} from '@mui/material'
import { useDatacenter } from '../contexts/DatacenterContext'

const StatsPanel: React.FC = () => {
  const { stats, loading } = useDatacenter()

  if (loading) {
    return (
      <Paper elevation={3} sx={{ p: 2, minWidth: 200 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="80px">
          <CircularProgress size={24} />
        </Box>
      </Paper>
    )
  }

  return (
    <Paper elevation={3} sx={{ p: 2, minWidth: 200, backgroundColor: 'background.paper' }}>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Box textAlign="center">
            <Typography variant="h4" component="div" color="primary" fontWeight="bold">
              {stats.totalVMs}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontSize="0.75rem">
              Total VMs
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box textAlign="center">
            <Typography variant="h4" component="div" color="primary" fontWeight="bold">
              {stats.activeDatacenters}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontSize="0.75rem">
              Active Datacenters
            </Typography>
          </Box>
        </Grid>
        {stats.migratingVMs > 0 && (
          <>
            <Grid item xs={6}>
              <Box textAlign="center">
                <Typography variant="h5" component="div" color="secondary" fontWeight="bold">
                  {stats.migratingVMs}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontSize="0.75rem">
                  Migrating
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box textAlign="center">
                <Typography variant="h5" component="div" color="success.main" fontWeight="bold">
                  {stats.runningVMs}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontSize="0.75rem">
                  Running
                </Typography>
              </Box>
            </Grid>
          </>
        )}
      </Grid>
    </Paper>
  )
}

export default StatsPanel