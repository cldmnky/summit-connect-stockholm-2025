package models

import "time"

// VM represents a virtual machine
type VM struct {
	ID             string     `json:"id"`
	Name           string     `json:"name"`
	Status         string     `json:"status"`
	CPU            int        `json:"cpu"`
	Memory         int        `json:"memory"`
	Disk           int        `json:"disk"`
	LastMigratedAt *time.Time `json:"_lastMigratedAt,omitempty"`
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
