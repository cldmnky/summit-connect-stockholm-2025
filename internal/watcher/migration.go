package watcher

import (
	"log"
	"sync"
	"time"

	"github.com/cldmnky/summit-connect-stockholm-2025/internal/models"
)

// MigrationDetector tracks VM migrations across clusters
type MigrationDetector struct {
	mu                sync.RWMutex
	vmClusterMap      map[string]string    // VM ID -> Current Cluster
	vmLastSeen        map[string]time.Time // VM ID -> Last seen timestamp
	pendingMigrations map[string]*PendingMigration
	migrationTimeout  time.Duration
}

// PendingMigration represents a VM that disappeared from one cluster
type PendingMigration struct {
	VM           *models.VM
	FromCluster  string
	LastSeenAt   time.Time
	DatacenterID string
}

// NewMigrationDetector creates a new migration detector
func NewMigrationDetector() *MigrationDetector {
	return &MigrationDetector{
		vmClusterMap:      make(map[string]string),
		vmLastSeen:        make(map[string]time.Time),
		pendingMigrations: make(map[string]*PendingMigration),
		migrationTimeout:  5 * time.Minute, // VMs gone for more than 5 minutes are considered deleted, not migrated
	}
}

// OnVMAdded handles when a VM is discovered in a cluster
func (md *MigrationDetector) OnVMAdded(vm *models.VM, clusterName string, datacenterID string) *MigrationEvent {
	md.mu.Lock()
	defer md.mu.Unlock()

	vmID := vm.ID
	now := time.Now()

	// Update tracking maps
	previousCluster := md.vmClusterMap[vmID]
	md.vmClusterMap[vmID] = clusterName
	md.vmLastSeen[vmID] = now

	// Check if this VM was pending migration from another cluster
	if pending, exists := md.pendingMigrations[vmID]; exists {
		// This is a migration completion!
		delete(md.pendingMigrations, vmID)

		// Update VM with migration info
		migrationTime := now
		vm.LastMigratedAt = &migrationTime
		vm.PreviousCluster = pending.FromCluster
		vm.MigrationStatus = "completed"

		log.Printf("Migration detected: VM %s moved from cluster %s to cluster %s",
			vmID, pending.FromCluster, clusterName)

		return &MigrationEvent{
			VM:             vm,
			FromCluster:    pending.FromCluster,
			ToCluster:      clusterName,
			FromDatacenter: pending.DatacenterID,
			ToDatacenter:   datacenterID,
			MigratedAt:     now,
			EventType:      "cluster_migration",
		}
	}

	// Check if VM changed clusters without going through deleted state
	if previousCluster != "" && previousCluster != clusterName {
		migrationTime := now
		vm.LastMigratedAt = &migrationTime
		vm.PreviousCluster = previousCluster
		vm.MigrationStatus = "completed"

		log.Printf("Direct migration detected: VM %s moved from cluster %s to cluster %s",
			vmID, previousCluster, clusterName)

		return &MigrationEvent{
			VM:             vm,
			FromCluster:    previousCluster,
			ToCluster:      clusterName,
			FromDatacenter: datacenterID, // Assume same datacenter for direct migration
			ToDatacenter:   datacenterID,
			MigratedAt:     now,
			EventType:      "cluster_migration",
		}
	}

	return nil // No migration detected
}

// OnVMDeleted handles when a VM disappears from a cluster
func (md *MigrationDetector) OnVMDeleted(vm *models.VM, clusterName string, datacenterID string) {
	md.mu.Lock()
	defer md.mu.Unlock()

	vmID := vm.ID
	now := time.Now()

	// Mark VM as potentially migrating
	md.pendingMigrations[vmID] = &PendingMigration{
		VM:           vm,
		FromCluster:  clusterName,
		LastSeenAt:   now,
		DatacenterID: datacenterID,
	}

	log.Printf("VM %s disappeared from cluster %s - monitoring for potential migration", vmID, clusterName)
}

// OnVMModified handles when a VM is updated in a cluster
func (md *MigrationDetector) OnVMModified(vm *models.VM, clusterName string, datacenterID string) *MigrationEvent {
	md.mu.Lock()
	defer md.mu.Unlock()

	vmID := vm.ID
	now := time.Now()

	// Update last seen time
	md.vmLastSeen[vmID] = now

	// Check if cluster assignment changed
	previousCluster := md.vmClusterMap[vmID]
	if previousCluster != "" && previousCluster != clusterName {
		md.vmClusterMap[vmID] = clusterName

		migrationTime := now
		vm.LastMigratedAt = &migrationTime
		vm.PreviousCluster = previousCluster
		vm.MigrationStatus = "completed"

		log.Printf("Migration detected via modify: VM %s moved from cluster %s to cluster %s",
			vmID, previousCluster, clusterName)

		return &MigrationEvent{
			VM:             vm,
			FromCluster:    previousCluster,
			ToCluster:      clusterName,
			FromDatacenter: datacenterID,
			ToDatacenter:   datacenterID,
			MigratedAt:     now,
			EventType:      "cluster_migration",
		}
	}

	return nil
}

// CleanupStaleEntries removes old pending migrations that likely represent VM deletions, not migrations
func (md *MigrationDetector) CleanupStaleEntries() {
	md.mu.Lock()
	defer md.mu.Unlock()

	now := time.Now()
	for vmID, pending := range md.pendingMigrations {
		if now.Sub(pending.LastSeenAt) > md.migrationTimeout {
			log.Printf("VM %s deletion confirmed (not migrated) - removing from pending", vmID)
			delete(md.pendingMigrations, vmID)
			delete(md.vmClusterMap, vmID)
			delete(md.vmLastSeen, vmID)
		}
	}
}

// GetPendingMigrations returns current pending migrations (for debugging)
func (md *MigrationDetector) GetPendingMigrations() map[string]*PendingMigration {
	md.mu.RLock()
	defer md.mu.RUnlock()

	result := make(map[string]*PendingMigration)
	for k, v := range md.pendingMigrations {
		result[k] = v
	}
	return result
}

// MigrationEvent represents a detected migration
type MigrationEvent struct {
	VM             *models.VM
	FromCluster    string
	ToCluster      string
	FromDatacenter string
	ToDatacenter   string
	MigratedAt     time.Time
	EventType      string // "cluster_migration", "datacenter_migration"
}
