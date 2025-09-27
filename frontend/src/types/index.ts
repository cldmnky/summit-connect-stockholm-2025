export interface VM {
  id: string
  name: string
  status: 'running' | 'stopped' | 'migrating' | 'starting'
  cpu: number
  memory: number
  disk: number
  cluster?: string
  node?: string
}

export interface Cluster {
  id: string
  name: string
  vms: VM[]
  totalVMs: number
  runningVMs: number
  migratingVMs: number
}

export interface Datacenter {
  id: string
  name: string
  location: string
  coordinates: [number, number]
  vms: VM[]
  clusters?: Cluster[]
  status?: 'active' | 'inactive'
  totalVMs?: number
  runningVMs?: number
  migratingVMs?: number
}

export interface Migration {
  id: string
  vmId: string
  vmName: string
  sourceDatacenter: string
  targetDatacenter: string
  sourceNode?: string
  targetNode?: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  phase: string
  startTime: string
  endTime?: string
  duration?: number
  progress?: number
}

export interface StatsData {
  totalVMs: number
  activeDatacenters: number
  migratingVMs: number
  runningVMs: number
}