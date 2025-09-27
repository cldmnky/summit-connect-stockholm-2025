import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Datacenter, Migration, StatsData } from '../types'

interface DatacenterContextType {
  datacenters: Datacenter[]
  migrations: Migration[]
  stats: StatsData
  selectedDatacenter: Datacenter | null
  loading: boolean
  error: string | null
  setSelectedDatacenter: (datacenter: Datacenter | null) => void
  refreshData: () => Promise<void>
}

const DatacenterContext = createContext<DatacenterContextType | undefined>(undefined)

export const useDatacenter = () => {
  const context = useContext(DatacenterContext)
  if (context === undefined) {
    throw new Error('useDatacenter must be used within a DatacenterProvider')
  }
  return context
}

interface DatacenterProviderProps {
  children: ReactNode
}

export const DatacenterProvider: React.FC<DatacenterProviderProps> = ({ children }) => {
  const [datacenters, setDatacenters] = useState<Datacenter[]>([])
  const [migrations, setMigrations] = useState<Migration[]>([])
  const [stats, setStats] = useState<StatsData>({
    totalVMs: 0,
    activeDatacenters: 0,
    migratingVMs: 0,
    runningVMs: 0,
  })
  const [selectedDatacenter, setSelectedDatacenter] = useState<Datacenter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const calculateStats = (datacenters: Datacenter[], migrations: Migration[]): StatsData => {
    const totalVMs = datacenters.reduce((total, dc) => total + (dc.vms?.length || 0), 0)
    const activeDatacenters = datacenters.filter(dc => dc.status === 'active' || dc.vms?.length > 0).length
    const migratingVMs = migrations.filter(m => m.status === 'running').length
    const runningVMs = datacenters.reduce((total, dc) => {
      return total + (dc.vms?.filter(vm => vm.status === 'running').length || 0)
    }, 0)

    return {
      totalVMs,
      activeDatacenters,
      migratingVMs,
      runningVMs,
    }
  }

  const loadDatacenters = async () => {
    try {
      const response = await fetch('/api/v1/datacenters')
      if (!response.ok) {
        throw new Error('Failed to fetch datacenters')
      }
      const data = await response.json()
      return data.datacenters || []
    } catch (error) {
      console.error('Error loading datacenters:', error)
      // Fallback data
      return [
        {
          id: "dc-stockholm-north",
          name: "Stockholm North DC",
          location: "Kista, Stockholm",
          coordinates: [59.4036, 17.9441] as [number, number],
          status: 'active',
          vms: [
            {
              id: "vm-001",
              name: "web-server-01",
              status: "running" as const,
              cpu: 4,
              memory: 8192,
              disk: 100
            }
          ]
        },
        {
          id: "dc-stockholm-south", 
          name: "Stockholm South DC",
          location: "Södermalm, Stockholm",
          coordinates: [59.3181, 18.0755] as [number, number],
          status: 'active',
          vms: [
            {
              id: "vm-002",
              name: "web-server-02", 
              status: "running" as const,
              cpu: 4,
              memory: 8192,
              disk: 100
            }
          ]
        }
      ]
    }
  }

  const loadMigrations = async () => {
    try {
      const response = await fetch('/api/v1/migrations')
      if (!response.ok) {
        return [] // Return empty array if migrations endpoint doesn't exist
      }
      const data = await response.json()
      return data.migrations || []
    } catch (error) {
      console.error('Error loading migrations:', error)
      return []
    }
  }

  const refreshData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [datacentersData, migrationsData] = await Promise.all([
        loadDatacenters(),
        loadMigrations(),
      ])
      
      setDatacenters(datacentersData)
      setMigrations(migrationsData)
      setStats(calculateStats(datacentersData, migrationsData))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshData()
    
    // Auto refresh every 5 seconds
    const interval = setInterval(refreshData, 5000)
    return () => clearInterval(interval)
  }, [])

  const value: DatacenterContextType = {
    datacenters,
    migrations,
    stats,
    selectedDatacenter,
    loading,
    error,
    setSelectedDatacenter,
    refreshData,
  }

  return (
    <DatacenterContext.Provider value={value}>
      {children}
    </DatacenterContext.Provider>
  )
}