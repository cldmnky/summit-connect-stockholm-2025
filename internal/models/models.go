package models

import "time"

// Store defines the interface for data storage operations
type Store interface {
	// Lifecycle
	Close() error

	// Configuration and initialization
	InitializeFromVMWatcherConfig(configPath string) error
	InitializeWithSampleData()

	// Datacenter operations
	GetDatacenters() *DatacenterCollection
	UpdateDatacenter(id string, name *string, location *string, coordinates *[]float64) (*Datacenter, error)

	// VM operations
	UpdateVM(dcID, vmID string, name *string, status *string, cpu *int, memory *int, disk *int, cluster *string) (*VM, error)
	UpdateVMComplete(dcID, vmID string, updatedVM *VM) (*VM, error)
	AddVM(dcID string, vm VM) (*VM, error)
	RemoveVM(dcID, vmID string) error
	MigrateVM(vmID, fromDC, toDC string) (*VM, error)

	// Migration operations
	AddMigration(migration Migration) error
	UpdateMigration(migration Migration) error
	GetMigration(migrationID string) (*Migration, error)
	GetAllMigrations() ([]Migration, error)
	GetMigrationsByDatacenter(datacenterID string) ([]Migration, error)
	GetMigrationsByVM(vmName string) ([]Migration, error)
	GetActiveMigrations() ([]Migration, error)
	GetMigrationsByDirection(direction string) ([]Migration, error)
	RemoveMigration(migrationID string) error
}

// VM represents a virtual machine
type VM struct {
	ID             string     `json:"id"`
	Name           string     `json:"name"`
	Status         string     `json:"status"`
	CPU            int        `json:"cpu"`
	Memory         int        `json:"memory"`
	Disk           int        `json:"disk"`
	LastMigratedAt *time.Time `json:"_lastMigratedAt,omitempty"`
	// Migration tracking
	MigrationStatus string `json:"migrationStatus,omitempty"` // "migrating", "completed", ""
	MigrationSource string `json:"migrationSource,omitempty"` // Source cluster for migration
	MigrationTarget string `json:"migrationTarget,omitempty"` // Target cluster for migration
	// Kubernetes / KubeVirt fields
	Cluster   string `json:"cluster,omitempty"`
	Namespace string `json:"namespace,omitempty"`
	Phase     string `json:"phase,omitempty"`
	IP        string `json:"ip,omitempty"`
	NodeName  string `json:"nodeName,omitempty"`
	Ready     bool   `json:"ready,omitempty"`
	Age       string `json:"age,omitempty"`
}

// Datacenter represents a datacenter with its VMs
type Datacenter struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Location    string    `json:"location"`
	Coordinates []float64 `json:"coordinates"`
	Clusters    []string  `json:"clusters,omitempty"`
	VMs         []VM      `json:"vms"`
}

// DatacenterCollection represents the root structure
type DatacenterCollection struct {
	Datacenters []Datacenter `json:"datacenters"`
}

// MigrateRequest represents a VM migration request
type MigrateRequest struct {
	VMID   string `json:"vmId"`
	FromDC string `json:"fromDC"`
	ToDC   string `json:"toDC"`
}

// MigrateResponse represents the response from a migration
type MigrateResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	VM      *VM    `json:"vm,omitempty"`
}

// Migration represents a VM migration in progress or completed
type Migration struct {
	ID               string                `json:"id"`               // Migration CR name
	VMID             string                `json:"vmId"`             // VM being migrated
	VMName           string                `json:"vmName"`           // VM name
	Namespace        string                `json:"namespace"`        // Kubernetes namespace
	Cluster          string                `json:"cluster"`          // Cluster where migration is happening
	DatacenterID     string                `json:"datacenterId"`     // Datacenter ID
	Phase            string                `json:"phase"`            // Current phase (Pending, Running, Succeeded, Failed)
	Direction        string                `json:"direction"`        // Migration direction: "outgoing" (source), "incoming" (target), "unknown"
	SourceCluster    string                `json:"sourceCluster"`    // Source cluster name (derived from migration direction)
	TargetCluster    string                `json:"targetCluster"`    // Target cluster name (derived from migration direction)
	SourceNode       string                `json:"sourceNode"`       // Source node name
	TargetNode       string                `json:"targetNode"`       // Target node name
	SourcePod        string                `json:"sourcePod"`        // Source pod name
	TargetPod        string                `json:"targetPod"`        // Target pod name
	StartTime        *time.Time            `json:"startTime"`        // Migration start time
	EndTime          *time.Time            `json:"endTime"`          // Migration end time
	PhaseTransitions []MigrationTransition `json:"phaseTransitions"` // Phase transition history
	CreatedAt        time.Time             `json:"createdAt"`        // When migration CR was created
	UpdatedAt        time.Time             `json:"updatedAt"`        // Last update time
	Completed        bool                  `json:"completed"`        // Whether migration is completed
	Labels           map[string]string     `json:"labels,omitempty"` // Migration labels (plan, migration ID, etc.)
	// Migration coordination fields
	SendToURL     string `json:"sendToUrl,omitempty"`     // spec.sendTo.connectURL (source cluster)
	ReceiveFromID string `json:"receiveFromId,omitempty"` // spec.receive.migrationID (target cluster)
	MigrationID   string `json:"migrationId,omitempty"`   // Forklift migration ID for correlation
}

// MigrationTransition represents a phase transition in a migration
type MigrationTransition struct {
	Phase     string    `json:"phase"`     // Phase name
	Timestamp time.Time `json:"timestamp"` // When transition happened
}
