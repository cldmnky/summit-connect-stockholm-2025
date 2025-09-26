package mocks

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/cldmnky/summit-connect-stockholm-2025/internal/models"
)

// MockStore implements the models.Store interface for testing
type MockStore struct {
	mu          sync.RWMutex
	data        *models.DatacenterCollection
	migrations  map[string]models.Migration
	initialized bool
	shouldError bool
	errorMsg    string
}

// NewMockStore creates a new mock store
func NewMockStore() *MockStore {
	return &MockStore{
		data:       &models.DatacenterCollection{Datacenters: []models.Datacenter{}},
		migrations: make(map[string]models.Migration),
	}
}

// SetShouldError configures the mock to return errors
func (m *MockStore) SetShouldError(shouldError bool, errorMsg string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.shouldError = shouldError
	m.errorMsg = errorMsg
}

// Close implements Store.Close
func (m *MockStore) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.shouldError {
		return errors.New(m.errorMsg)
	}
	return nil
}

// InitializeFromVMWatcherConfig implements Store.InitializeFromVMWatcherConfig
func (m *MockStore) InitializeFromVMWatcherConfig(configPath string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.shouldError {
		return errors.New(m.errorMsg)
	}
	m.initialized = true
	return nil
}

// InitializeWithSampleData implements Store.InitializeWithSampleData
func (m *MockStore) InitializeWithSampleData() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.data = &models.DatacenterCollection{
		Datacenters: []models.Datacenter{
			{
				ID:          "dc-test-1",
				Name:        "Test DC 1",
				Location:    "Test Location 1",
				Coordinates: []float64{59.4196, 17.9466},
				VMs: []models.VM{
					{
						ID:     "vm-001",
						Name:   "test-vm-1",
						Status: "running",
						CPU:    4,
						Memory: 8192,
						Disk:   100,
					},
				},
			},
			{
				ID:          "dc-test-2",
				Name:        "Test DC 2",
				Location:    "Test Location 2",
				Coordinates: []float64{59.3816, 17.9803},
				VMs: []models.VM{
					{
						ID:     "vm-002",
						Name:   "test-vm-2",
						Status: "stopped",
						CPU:    2,
						Memory: 4096,
						Disk:   50,
					},
				},
			},
		},
	}

	// Initialize empty migrations map - tests will add their own migrations
	m.migrations = make(map[string]models.Migration)
}

// GetDatacenters implements Store.GetDatacenters
func (m *MockStore) GetDatacenters() *models.DatacenterCollection {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Return a deep copy
	result := &models.DatacenterCollection{}
	for _, dc := range m.data.Datacenters {
		newDC := models.Datacenter{
			ID:          dc.ID,
			Name:        dc.Name,
			Location:    dc.Location,
			Coordinates: make([]float64, len(dc.Coordinates)),
			Clusters:    make([]string, len(dc.Clusters)),
			VMs:         make([]models.VM, len(dc.VMs)),
		}
		copy(newDC.Coordinates, dc.Coordinates)
		copy(newDC.Clusters, dc.Clusters)
		copy(newDC.VMs, dc.VMs)
		result.Datacenters = append(result.Datacenters, newDC)
	}
	return result
}

// UpdateDatacenter implements Store.UpdateDatacenter
func (m *MockStore) UpdateDatacenter(id string, name *string, location *string, coordinates *[]float64) (*models.Datacenter, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.shouldError {
		return nil, errors.New(m.errorMsg)
	}

	for i := range m.data.Datacenters {
		if m.data.Datacenters[i].ID == id {
			if name != nil {
				m.data.Datacenters[i].Name = *name
			}
			if location != nil {
				m.data.Datacenters[i].Location = *location
			}
			if coordinates != nil {
				m.data.Datacenters[i].Coordinates = *coordinates
			}
			return &m.data.Datacenters[i], nil
		}
	}

	return nil, fmt.Errorf("datacenter %s not found", id)
}

// UpdateVM implements Store.UpdateVM
func (m *MockStore) UpdateVM(dcID, vmID string, name *string, status *string, cpu *int, memory *int, disk *int, cluster *string) (*models.VM, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.shouldError {
		return nil, errors.New(m.errorMsg)
	}

	for i := range m.data.Datacenters {
		if m.data.Datacenters[i].ID == dcID {
			for j := range m.data.Datacenters[i].VMs {
				if m.data.Datacenters[i].VMs[j].ID == vmID {
					vm := &m.data.Datacenters[i].VMs[j]
					if name != nil {
						vm.Name = *name
					}
					if status != nil {
						vm.Status = *status
					}
					if cpu != nil {
						vm.CPU = *cpu
					}
					if memory != nil {
						vm.Memory = *memory
					}
					if disk != nil {
						vm.Disk = *disk
					}
					if cluster != nil {
						vm.Cluster = *cluster
					}
					return vm, nil
				}
			}
			return nil, fmt.Errorf("vm %s not found in datacenter %s", vmID, dcID)
		}
	}
	return nil, fmt.Errorf("datacenter %s not found", dcID)
}

// UpdateVMComplete implements Store.UpdateVMComplete
func (m *MockStore) UpdateVMComplete(dcID, vmID string, updatedVM *models.VM) (*models.VM, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.shouldError {
		return nil, errors.New(m.errorMsg)
	}

	for i := range m.data.Datacenters {
		if m.data.Datacenters[i].ID == dcID {
			for j := range m.data.Datacenters[i].VMs {
				if m.data.Datacenters[i].VMs[j].ID == vmID {
					m.data.Datacenters[i].VMs[j] = *updatedVM
					return &m.data.Datacenters[i].VMs[j], nil
				}
			}
			return nil, fmt.Errorf("vm %s not found in datacenter %s", vmID, dcID)
		}
	}
	return nil, fmt.Errorf("datacenter %s not found", dcID)
}

// AddVM implements Store.AddVM
func (m *MockStore) AddVM(dcID string, vm models.VM) (*models.VM, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.shouldError {
		return nil, errors.New(m.errorMsg)
	}

	for i := range m.data.Datacenters {
		if m.data.Datacenters[i].ID == dcID {
			m.data.Datacenters[i].VMs = append(m.data.Datacenters[i].VMs, vm)
			return &vm, nil
		}
	}
	return nil, fmt.Errorf("datacenter %s not found", dcID)
}

// RemoveVM implements Store.RemoveVM
func (m *MockStore) RemoveVM(dcID, vmID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.shouldError {
		return errors.New(m.errorMsg)
	}

	for i := range m.data.Datacenters {
		if m.data.Datacenters[i].ID == dcID {
			for j := range m.data.Datacenters[i].VMs {
				if m.data.Datacenters[i].VMs[j].ID == vmID {
					m.data.Datacenters[i].VMs = append(m.data.Datacenters[i].VMs[:j], m.data.Datacenters[i].VMs[j+1:]...)
					return nil
				}
			}
			return fmt.Errorf("vm %s not found in datacenter %s", vmID, dcID)
		}
	}
	return fmt.Errorf("datacenter %s not found", dcID)
}

// MigrateVM implements Store.MigrateVM
func (m *MockStore) MigrateVM(vmID, fromDC, toDC string) (*models.VM, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.shouldError {
		return nil, errors.New(m.errorMsg)
	}

	var sourceVM *models.VM
	var targetDCIndex int = -1

	for i, dc := range m.data.Datacenters {
		if dc.ID == fromDC {
			for j, vm := range dc.VMs {
				if vm.ID == vmID {
					sourceVM = &vm
					m.data.Datacenters[i].VMs = append(dc.VMs[:j], dc.VMs[j+1:]...)
					break
				}
			}
		}
		if dc.ID == toDC {
			targetDCIndex = i
		}
	}

	if sourceVM == nil {
		return nil, fmt.Errorf("VM %s not found in datacenter %s", vmID, fromDC)
	}

	if targetDCIndex == -1 {
		return nil, fmt.Errorf("target datacenter %s not found", toDC)
	}

	now := time.Now()
	sourceVM.LastMigratedAt = &now

	m.data.Datacenters[targetDCIndex].VMs = append(m.data.Datacenters[targetDCIndex].VMs, *sourceVM)

	return sourceVM, nil
}

// AddMigration implements Store.AddMigration
func (m *MockStore) AddMigration(migration models.Migration) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.shouldError {
		return errors.New(m.errorMsg)
	}

	m.migrations[migration.ID] = migration
	return nil
}

// UpdateMigration implements Store.UpdateMigration
func (m *MockStore) UpdateMigration(migration models.Migration) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.shouldError {
		return errors.New(m.errorMsg)
	}

	migration.UpdatedAt = time.Now()
	m.migrations[migration.ID] = migration
	return nil
}

// GetMigration implements Store.GetMigration
func (m *MockStore) GetMigration(migrationID string) (*models.Migration, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.shouldError {
		return nil, errors.New(m.errorMsg)
	}

	migration, exists := m.migrations[migrationID]
	if !exists {
		return nil, fmt.Errorf("migration %s not found", migrationID)
	}

	return &migration, nil
}

// GetAllMigrations implements Store.GetAllMigrations
func (m *MockStore) GetAllMigrations() ([]models.Migration, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.shouldError {
		return nil, errors.New(m.errorMsg)
	}

	var migrations []models.Migration
	for _, migration := range m.migrations {
		migrations = append(migrations, migration)
	}

	return migrations, nil
}

// GetMigrationsByDatacenter implements Store.GetMigrationsByDatacenter
func (m *MockStore) GetMigrationsByDatacenter(datacenterID string) ([]models.Migration, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.shouldError {
		return nil, errors.New(m.errorMsg)
	}

	var migrations []models.Migration
	for _, migration := range m.migrations {
		if migration.DatacenterID == datacenterID {
			migrations = append(migrations, migration)
		}
	}

	return migrations, nil
}

// GetMigrationsByVM implements Store.GetMigrationsByVM
func (m *MockStore) GetMigrationsByVM(vmName string) ([]models.Migration, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.shouldError {
		return nil, errors.New(m.errorMsg)
	}

	var migrations []models.Migration
	for _, migration := range m.migrations {
		if migration.VMName == vmName {
			migrations = append(migrations, migration)
		}
	}

	return migrations, nil
}

// GetActiveMigrations implements Store.GetActiveMigrations
func (m *MockStore) GetActiveMigrations() ([]models.Migration, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.shouldError {
		return nil, errors.New(m.errorMsg)
	}

	var migrations []models.Migration
	for _, migration := range m.migrations {
		if !migration.Completed {
			migrations = append(migrations, migration)
		}
	}

	return migrations, nil
}

// GetMigrationsByDirection implements Store.GetMigrationsByDirection
func (m *MockStore) GetMigrationsByDirection(direction string) ([]models.Migration, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.shouldError {
		return nil, errors.New(m.errorMsg)
	}

	var migrations []models.Migration
	for _, migration := range m.migrations {
		if migration.Direction == direction {
			migrations = append(migrations, migration)
		}
	}

	return migrations, nil
}

// RemoveMigration implements Store.RemoveMigration
func (m *MockStore) RemoveMigration(migrationID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.shouldError {
		return errors.New(m.errorMsg)
	}

	if _, exists := m.migrations[migrationID]; !exists {
		return fmt.Errorf("migration %s not found", migrationID)
	}

	delete(m.migrations, migrationID)
	return nil
}
