import React, { useState } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Button,
} from '@mui/material'
import {
  Computer,
  Storage,
  Refresh,
} from '@mui/icons-material'
import { useDatacenter } from '../contexts/DatacenterContext'
import { VM } from '../types'

const DatacenterPanel: React.FC = () => {
  const { datacenters, migrations, selectedDatacenter, refreshData } = useDatacenter()
  const [vmFilterMode, setVmFilterMode] = useState<'all' | 'migrating'>('all')
  const [hideInactive, setHideInactive] = useState(true)
  const [migrationFilterMode, setMigrationFilterMode] = useState<'active' | 'all' | 'completed'>('active')

  const getStatusColor = (status: VM['status']) => {
    switch (status) {
      case 'running':
        return 'success'
      case 'migrating':
        return 'secondary'
      case 'stopped':
        return 'error'
      case 'starting':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getMigrationStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'warning'
      case 'succeeded':
        return 'success'
      case 'failed':
        return 'error'
      default:
        return 'default'
    }
  }

  const filteredMigrations = migrations.filter(migration => {
    switch (migrationFilterMode) {
      case 'active':
        return migration.status === 'running' || migration.status === 'pending'
      case 'completed':
        return migration.status === 'succeeded' || migration.status === 'failed'
      default:
        return true
    }
  })

  const allVMs = datacenters.flatMap(dc => dc.vms || [])
  const filteredVMs = allVMs.filter(vm => {
    if (vmFilterMode === 'migrating' && vm.status !== 'migrating') return false
    if (hideInactive && vm.status === 'stopped') return false
    return true
  })

  return (
    <Card sx={{ height: '100%', overflow: 'auto' }}>
      <CardContent>
        <Typography variant="h5" component="h3" gutterBottom>
          Datacenter Overview
        </Typography>

        {/* Datacenter View */}
        <Box sx={{ mb: 3 }}>
          {selectedDatacenter ? (
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                {selectedDatacenter.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {selectedDatacenter.location}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Chip
                  label={`${selectedDatacenter.vms?.length || 0} VMs`}
                  size="small"
                  color="primary"
                />
                <Chip
                  label={selectedDatacenter.status || 'active'}
                  size="small"
                  color="success"
                />
              </Box>
            </Card>
          ) : (
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Click on a datacenter marker to view details
              </Typography>
            </Card>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* VM Section */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" component="h4">
              Active VMs
            </Typography>
            <Chip label={filteredVMs.length} size="small" color="primary" />
          </Box>
          
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Show</InputLabel>
              <Select
                value={vmFilterMode}
                label="Show"
                onChange={(e) => setVmFilterMode(e.target.value as 'all' | 'migrating')}
              >
                <MenuItem value="all">All VMs</MenuItem>
                <MenuItem value="migrating">Only Migrating</MenuItem>
              </Select>
            </FormControl>
            
            <FormControlLabel
              control={
                <Switch
                  checked={hideInactive}
                  onChange={(e) => setHideInactive(e.target.checked)}
                  size="small"
                />
              }
              label="Hide inactive"
              sx={{ fontSize: '0.875rem' }}
            />
          </Box>

          <List sx={{ maxHeight: 320, overflow: 'auto' }}>
            {filteredVMs.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="No VMs found"
                  secondary="Try adjusting your filters"
                />
              </ListItem>
            ) : (
              filteredVMs.map((vm) => (
                <ListItem key={vm.id} divider>
                  <ListItemIcon>
                    <Computer />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {vm.name}
                        </Typography>
                        <Chip
                          label={vm.status}
                          size="small"
                          color={getStatusColor(vm.status)}
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" display="block">
                          CPU: {vm.cpu} cores | RAM: {vm.memory} MB | Disk: {vm.disk} GB
                        </Typography>
                        {vm.cluster && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            Cluster: {vm.cluster}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))
            )}
          </List>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Migration Panel */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" component="h4">
              Active Migrations
            </Typography>
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={refreshData}
            >
              Refresh
            </Button>
          </Box>
          
          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Show</InputLabel>
              <Select
                value={migrationFilterMode}
                label="Show"
                onChange={(e) => setMigrationFilterMode(e.target.value as 'active' | 'all' | 'completed')}
              >
                <MenuItem value="active">Active Only</MenuItem>
                <MenuItem value="all">All Migrations</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <List sx={{ maxHeight: 300, overflow: 'auto' }}>
            {filteredMigrations.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="No migrations found"
                  secondary="Check the filter settings"
                />
              </ListItem>
            ) : (
              filteredMigrations.map((migration) => (
                <ListItem key={migration.id} divider>
                  <ListItemIcon>
                    <Storage />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" fontWeight="bold" color="secondary">
                          {migration.vmName}
                        </Typography>
                        <Chip
                          label={migration.status}
                          size="small"
                          color={getMigrationStatusColor(migration.status)}
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" display="block">
                          {migration.sourceDatacenter} → {migration.targetDatacenter}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          Phase: {migration.phase}
                        </Typography>
                        {migration.duration && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            Duration: {Math.round(migration.duration / 1000)}s
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))
            )}
          </List>
        </Box>
      </CardContent>
    </Card>
  )
}

export default DatacenterPanel