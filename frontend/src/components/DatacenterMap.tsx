import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Box, Typography, Button, Chip } from '@mui/material'
import L from 'leaflet'
import { useDatacenter } from '../contexts/DatacenterContext'

// Fix for default markers in react-leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const DatacenterMap: React.FC = () => {
  const { datacenters, selectedDatacenter, setSelectedDatacenter } = useDatacenter()

  useEffect(() => {
    // Set default marker icon for react-leaflet
    L.Marker.prototype.options.icon = DefaultIcon
  }, [])

  const handleDatacenterClick = (datacenter: any) => {
    setSelectedDatacenter(datacenter)
  }

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <MapContainer
        center={[59.3293, 18.0686]} // Stockholm center
        zoom={10}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {datacenters.map((datacenter) => (
          <Marker
            key={datacenter.id}
            position={datacenter.coordinates}
            eventHandlers={{
              click: () => handleDatacenterClick(datacenter),
            }}
          >
            <Popup>
              <Box sx={{ p: 1, minWidth: 200 }}>
                <Typography variant="h6" gutterBottom>
                  {datacenter.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {datacenter.location}
                </Typography>
                
                <Box sx={{ mt: 2, mb: 2 }}>
                  <Chip 
                    label={`${datacenter.vms?.length || 0} VMs`}
                    color="primary"
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Chip 
                    label={datacenter.status || 'active'}
                    color={datacenter.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                <Button
                  variant="contained"
                  size="small"
                  fullWidth
                  onClick={() => handleDatacenterClick(datacenter)}
                  sx={{ mt: 1 }}
                >
                  View Details
                </Button>
              </Box>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </Box>
  )
}

export default DatacenterMap