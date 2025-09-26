package boltdb

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	bbolt "github.com/etcd-io/bbolt"
	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"

	"github.com/cldmnky/summit-connect-stockholm-2025/internal/models"
)

const (
	defaultBucket    = "datacenters"
	migrationsBucket = "migrations"
	defaultKey       = "collection"
)

// Store implements the data.Store interface using BoltDB
type Store struct {
	mu   sync.RWMutex
	data *models.DatacenterCollection
	db   *bbolt.DB
}

// NewStore opens/creates the BoltDB file at dbPath and loads data
// If the DB is empty and a jsonSeedPath is provided and exists it will be used to seed data.
func NewStore(dbPath string, jsonSeedPath string) (models.Store, error) {
	// ensure parent dir exists
	if dbPath == "" {
		dbPath = "/tmp/summit-connect.db"
	}
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create db dir: %v", err)
	}

	db, err := bbolt.Open(dbPath, 0600, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to open bolt db %s: %v", dbPath, err)
	}

	ds := &Store{data: &models.DatacenterCollection{}, db: db}

	// Create bucket if not exists and try to load existing collection
	err = ds.db.Update(func(tx *bbolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists([]byte(defaultBucket))
		if err != nil {
			return err
		}
		_, err = tx.CreateBucketIfNotExists([]byte(migrationsBucket))
		return err
	})
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to create bucket: %v", err)
	}

	// Try to load from DB
	if err := ds.loadFromDB(); err != nil {
		// DB empty. Prefer Viper-based seeding.
		// If a config path was provided, attempt to use it. Otherwise try default config name "datacenters"
		if jsonSeedPath != "" {
			// treat provided path as a config file for viper
			v := viper.New()
			v.SetConfigFile(jsonSeedPath)
			v.AutomaticEnv()
			if err := v.ReadInConfig(); err == nil {
				var col models.DatacenterCollection
				if err := v.Unmarshal(&col); err == nil {
					ds.data = &col
					fmt.Printf("[BoltStore] seeded DB via viper config file %s\n", jsonSeedPath)
					if perr := ds.writeSeedAndLog(); perr != nil {
						return nil, perr
					}
					return ds, nil
				}
			} else {
				fmt.Printf("[BoltStore] viper failed to read config %s: %v\n", jsonSeedPath, err)
			}
		}

		// No explicit seed path or previous attempt failed — try viper default config name in common locations
		v := viper.New()
		v.SetConfigName("datacenters")
		v.AddConfigPath(filepath.Join(".", "frontend"))
		// also look in ./config for project-level config files
		v.AddConfigPath(filepath.Join(".", "config"))
		v.AddConfigPath(".")
		v.AutomaticEnv()
		if err := v.ReadInConfig(); err == nil {
			var col models.DatacenterCollection
			if err := v.Unmarshal(&col); err == nil {
				ds.data = &col
				fmt.Printf("[BoltStore] seeded DB via viper default config (datacenters)\n")
				if perr := ds.writeSeedAndLog(); perr != nil {
					return nil, perr
				}
				return ds, nil
			}
		} else {
			fmt.Printf("[BoltStore] viper default config not found: %v\n", err)
		}

		// If no config found, initialize with embedded sample data and persist
		fmt.Printf("[BoltStore] no config found, initializing with sample data\n")
		ds.InitializeWithSampleData()
	}

	return ds, nil
}

// Close closes the BoltDB
func (s *Store) Close() error {
	return s.db.Close()
}

// InitializeFromVMWatcherConfig creates datacenter structure from VM watcher config (without VMs)
func (s *Store) InitializeFromVMWatcherConfig(configPath string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Define a temporary structure to read the VM watcher config
	type WatcherDatacenter struct {
		ID          string    `yaml:"id"`
		Name        string    `yaml:"name"`
		Location    string    `yaml:"location"`
		Coordinates []float64 `yaml:"coordinates"`
		Clusters    []struct {
			Name       string `yaml:"name"`
			Kubeconfig string `yaml:"kubeconfig"`
		} `yaml:"clusters"`
	}

	type WatcherConfig struct {
		Datacenters []WatcherDatacenter `yaml:"datacenters"`
	}

	// Read the VM watcher config file
	file, err := os.Open(configPath)
	if err != nil {
		return fmt.Errorf("failed to open config file %s: %w", configPath, err)
	}
	defer file.Close()

	var watcherConfig WatcherConfig
	decoder := yaml.NewDecoder(file)
	if err := decoder.Decode(&watcherConfig); err != nil {
		return fmt.Errorf("failed to decode config file %s: %w", configPath, err)
	}

	// Convert to DatacenterCollection (without VMs - they'll be populated by the watcher)
	var datacenters []models.Datacenter
	for _, wdc := range watcherConfig.Datacenters {
		var clusterNames []string
		for _, cluster := range wdc.Clusters {
			clusterNames = append(clusterNames, cluster.Name)
		}

		datacenter := models.Datacenter{
			ID:          wdc.ID,
			Name:        wdc.Name,
			Location:    wdc.Location,
			Coordinates: wdc.Coordinates,
			Clusters:    clusterNames,
			VMs:         []models.VM{}, // Empty - will be populated by VM watcher
		}
		datacenters = append(datacenters, datacenter)
	}

	s.data = &models.DatacenterCollection{
		Datacenters: datacenters,
	}

	// Persist the empty datacenter structure
	buf, err := json.Marshal(s.data)
	if err != nil {
		return fmt.Errorf("failed to marshal datacenter structure: %w", err)
	}

	if err := s.writeToDB(buf); err != nil {
		return fmt.Errorf("failed to persist datacenter structure: %w", err)
	}

	fmt.Printf("[BoltStore] initialized from VM watcher config: %s with %d datacenters\n", configPath, len(datacenters))
	return nil
}

// loadFromJSONFile reads a JSON file and sets s.data (used for seeding)
func (s *Store) loadFromJSONFile(filename string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, err := os.ReadFile(filename)
	if err != nil {
		return err
	}
	var col models.DatacenterCollection
	if err := json.Unmarshal(b, &col); err != nil {
		return err
	}
	s.data = &col
	return nil
}

// loadFromDB loads the collection from BoltDB into memory
func (s *Store) loadFromDB() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(defaultBucket))
		if b == nil {
			return fmt.Errorf("bucket %s not found", defaultBucket)
		}
		v := b.Get([]byte(defaultKey))
		if v == nil {
			// no data yet
			s.data = &models.DatacenterCollection{}
			return fmt.Errorf("no data in db")
		}
		var col models.DatacenterCollection
		if err := json.Unmarshal(v, &col); err != nil {
			return err
		}
		s.data = &col
		return nil
	})
}

// saveToDB persists the in-memory collection to BoltDB
func (s *Store) saveToDB() error {
	// Marshal under a read-lock to capture a consistent snapshot.
	s.mu.RLock()
	buf, err := json.Marshal(s.data)
	s.mu.RUnlock()
	if err != nil {
		return err
	}
	return s.writeToDB(buf)
}

// writeToDB writes the provided marshaled buffer into the BoltDB
// This method does NOT attempt to acquire s.mu; callers must ensure
// they are not holding locks that would deadlock with callers that
// call this function. It's safe to call from goroutines without
// holding the Store mutex.
func (s *Store) writeToDB(buf []byte) error {
	start := time.Now()
	fmt.Printf("[BoltStore] writeToDB start size=%d\n", len(buf))
	err := s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(defaultBucket))
		if b == nil {
			var err error
			b, err = tx.CreateBucket([]byte(defaultBucket))
			if err != nil {
				return err
			}
		}
		return b.Put([]byte(defaultKey), buf)
	})
	dur := time.Since(start)
	if err != nil {
		fmt.Printf("[BoltStore] writeToDB error: %v duration=%s\n", err, dur)
	} else {
		fmt.Printf("[BoltStore] writeToDB ok duration=%s\n", dur)
	}
	return err
}

// writeSeedAndLog marshals current in-memory s.data and persists it to DB (used for seeding)
func (s *Store) writeSeedAndLog() error {
	s.mu.RLock()
	buf, err := json.Marshal(s.data)
	s.mu.RUnlock()
	if err != nil {
		return err
	}
	fmt.Printf("[BoltStore] seeding DB: size=%d\n", len(buf))
	return s.writeToDB(buf)
}

// GetDatacenters returns all datacenters (deep copy)
func (s *Store) GetDatacenters() *models.DatacenterCollection {
	s.mu.RLock()
	defer s.mu.RUnlock()

	jsonData, _ := json.Marshal(s.data)
	var copy models.DatacenterCollection
	json.Unmarshal(jsonData, &copy)
	return &copy
}

// UpdateDatacenter updates fields of a datacenter (coordinates, name, location)
func (s *Store) UpdateDatacenter(id string, name *string, location *string, coordinates *[]float64) (*models.Datacenter, error) {
	start := time.Now()
	fmt.Printf("[BoltStore] UpdateDatacenter entry id=%s\n", id)
	s.mu.Lock()
	// perform modification under lock, marshal snapshot, then unlock and write to DB
	for i := range s.data.Datacenters {
		if s.data.Datacenters[i].ID == id {
			if name != nil {
				s.data.Datacenters[i].Name = *name
			}
			if location != nil {
				s.data.Datacenters[i].Location = *location
			}
			if coordinates != nil {
				s.data.Datacenters[i].Coordinates = *coordinates
			}
			// make a copy for return
			dc := s.data.Datacenters[i]
			// marshal snapshot while still holding lock
			buf, err := json.Marshal(s.data)
			s.mu.Unlock()
			if err != nil {
				fmt.Printf("[BoltStore] UpdateDatacenter marshal error: %v\n", err)
			} else {
				if err := s.writeToDB(buf); err != nil {
					fmt.Printf("[BoltStore] UpdateDatacenter writeToDB error: %v\n", err)
				}
			}
			fmt.Printf("[BoltStore] UpdateDatacenter exit id=%s duration=%s\n", id, time.Since(start))
			return &dc, nil
		}
	}
	s.mu.Unlock()
	fmt.Printf("[BoltStore] UpdateDatacenter exit id=%s duration=%s\n", id, time.Since(start))
	return nil, fmt.Errorf("datacenter %s not found", id)
}

// UpdateVM updates fields of a VM in a datacenter (legacy method for backward compatibility)
func (s *Store) UpdateVM(dcID, vmID string, name *string, status *string, cpu *int, memory *int, disk *int, cluster *string) (*models.VM, error) {
	start := time.Now()
	fmt.Printf("[BoltStore] UpdateVM entry dc=%s vm=%s\n", dcID, vmID)
	s.mu.Lock()
	for i := range s.data.Datacenters {
		if s.data.Datacenters[i].ID == dcID {
			for j := range s.data.Datacenters[i].VMs {
				if s.data.Datacenters[i].VMs[j].ID == vmID {
					vm := &s.data.Datacenters[i].VMs[j]
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
					copy := *vm
					// marshal and write
					buf, err := json.Marshal(s.data)
					s.mu.Unlock()
					if err != nil {
						fmt.Printf("[BoltStore] UpdateVM marshal error: %v\n", err)
					} else {
						if err := s.writeToDB(buf); err != nil {
							fmt.Printf("[BoltStore] UpdateVM writeToDB error: %v\n", err)
						}
					}
					fmt.Printf("[BoltStore] UpdateVM exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
					return &copy, nil
				}
			}
			s.mu.Unlock()
			fmt.Printf("[BoltStore] UpdateVM exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
			return nil, fmt.Errorf("vm %s not found in datacenter %s", vmID, dcID)
		}
	}
	s.mu.Unlock()
	fmt.Printf("[BoltStore] UpdateVM exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
	return nil, fmt.Errorf("datacenter %s not found", dcID)
}

// UpdateVMComplete updates all fields of a VM in a datacenter with the complete VM model
func (s *Store) UpdateVMComplete(dcID, vmID string, updatedVM *models.VM) (*models.VM, error) {
	start := time.Now()
	fmt.Printf("[BoltStore] UpdateVMComplete entry dc=%s vm=%s\n", dcID, vmID)
	s.mu.Lock()
	for i := range s.data.Datacenters {
		if s.data.Datacenters[i].ID == dcID {
			for j := range s.data.Datacenters[i].VMs {
				if s.data.Datacenters[i].VMs[j].ID == vmID {
					// Update all fields from the provided VM model
					vm := &s.data.Datacenters[i].VMs[j]
					vm.Name = updatedVM.Name
					vm.Status = updatedVM.Status
					vm.CPU = updatedVM.CPU
					vm.Memory = updatedVM.Memory
					vm.Disk = updatedVM.Disk
					vm.Cluster = updatedVM.Cluster
					vm.Namespace = updatedVM.Namespace
					vm.Phase = updatedVM.Phase
					vm.IP = updatedVM.IP
					vm.NodeName = updatedVM.NodeName
					vm.Ready = updatedVM.Ready
					vm.Age = updatedVM.Age

					copy := *vm
					// marshal and write
					buf, err := json.Marshal(s.data)
					s.mu.Unlock()
					if err != nil {
						fmt.Printf("[BoltStore] UpdateVMComplete marshal error: %v\n", err)
					} else {
						if err := s.writeToDB(buf); err != nil {
							fmt.Printf("[BoltStore] UpdateVMComplete writeToDB error: %v\n", err)
						}
					}
					fmt.Printf("[BoltStore] UpdateVMComplete exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
					return &copy, nil
				}
			}
			s.mu.Unlock()
			fmt.Printf("[BoltStore] UpdateVMComplete exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
			return nil, fmt.Errorf("vm %s not found in datacenter %s", vmID, dcID)
		}
	}
	s.mu.Unlock()
	fmt.Printf("[BoltStore] UpdateVMComplete exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
	return nil, fmt.Errorf("datacenter %s not found", dcID)
}

// AddVM adds a VM to a datacenter
func (s *Store) AddVM(dcID string, vm models.VM) (*models.VM, error) {
	start := time.Now()
	fmt.Printf("[BoltStore] AddVM entry dc=%s vm=%s\n", dcID, vm.ID)
	s.mu.Lock()
	for i := range s.data.Datacenters {
		if s.data.Datacenters[i].ID == dcID {
			s.data.Datacenters[i].VMs = append(s.data.Datacenters[i].VMs, vm)
			copy := vm
			buf, err := json.Marshal(s.data)
			s.mu.Unlock()
			if err != nil {
				fmt.Printf("[BoltStore] AddVM marshal error: %v\n", err)
			} else {
				if err := s.writeToDB(buf); err != nil {
					fmt.Printf("[BoltStore] AddVM writeToDB error: %v\n", err)
				}
			}
			fmt.Printf("[BoltStore] AddVM exit dc=%s vm=%s duration=%s\n", dcID, vm.ID, time.Since(start))
			return &copy, nil
		}
	}
	s.mu.Unlock()
	fmt.Printf("[BoltStore] AddVM exit dc=%s vm=%s duration=%s\n", dcID, vm.ID, time.Since(start))
	return nil, fmt.Errorf("datacenter %s not found", dcID)
}

// RemoveVM removes a VM from a datacenter
func (s *Store) RemoveVM(dcID, vmID string) error {
	start := time.Now()
	fmt.Printf("[BoltStore] RemoveVM entry dc=%s vm=%s\n", dcID, vmID)
	s.mu.Lock()
	for i := range s.data.Datacenters {
		if s.data.Datacenters[i].ID == dcID {
			for j := range s.data.Datacenters[i].VMs {
				if s.data.Datacenters[i].VMs[j].ID == vmID {
					s.data.Datacenters[i].VMs = append(s.data.Datacenters[i].VMs[:j], s.data.Datacenters[i].VMs[j+1:]...)
					buf, err := json.Marshal(s.data)
					s.mu.Unlock()
					if err != nil {
						fmt.Printf("[BoltStore] RemoveVM marshal error: %v\n", err)
					} else {
						if err := s.writeToDB(buf); err != nil {
							fmt.Printf("[BoltStore] RemoveVM writeToDB error: %v\n", err)
						}
					}
					fmt.Printf("[BoltStore] RemoveVM exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
					return nil
				}
			}
			s.mu.Unlock()
			fmt.Printf("[BoltStore] RemoveVM exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
			return fmt.Errorf("vm %s not found in datacenter %s", vmID, dcID)
		}
	}
	s.mu.Unlock()
	fmt.Printf("[BoltStore] RemoveVM exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
	return fmt.Errorf("datacenter %s not found", dcID)
}

// MigrateVM migrates a VM from one datacenter to another
func (s *Store) MigrateVM(vmID, fromDC, toDC string) (*models.VM, error) {
	start := time.Now()
	fmt.Printf("[BoltStore] MigrateVM entry vm=%s from=%s to=%s\n", vmID, fromDC, toDC)
	s.mu.Lock()
	var sourceVM *models.VM
	var targetDCIndex int = -1

	for i, dc := range s.data.Datacenters {
		if dc.ID == fromDC {
			for j, vm := range dc.VMs {
				if vm.ID == vmID {
					// copy of vm
					tmp := vm
					sourceVM = &tmp
					s.data.Datacenters[i].VMs = append(dc.VMs[:j], dc.VMs[j+1:]...)
					break
				}
			}
		}
		if dc.ID == toDC {
			targetDCIndex = i
		}
	}

	if sourceVM == nil {
		s.mu.Unlock()
		fmt.Printf("[BoltStore] MigrateVM exit vm=%s duration=%s\n", vmID, time.Since(start))
		return nil, fmt.Errorf("VM %s not found in datacenter %s", vmID, fromDC)
	}

	if targetDCIndex == -1 {
		s.mu.Unlock()
		fmt.Printf("[BoltStore] MigrateVM exit vm=%s duration=%s\n", vmID, time.Since(start))
		return nil, fmt.Errorf("target datacenter %s not found", toDC)
	}

	now := time.Now()
	sourceVM.LastMigratedAt = &now

	s.data.Datacenters[targetDCIndex].VMs = append(s.data.Datacenters[targetDCIndex].VMs, *sourceVM)

	buf, err := json.Marshal(s.data)
	s.mu.Unlock()
	if err != nil {
		fmt.Printf("[BoltStore] MigrateVM marshal error: %v\n", err)
	} else {
		if err := s.writeToDB(buf); err != nil {
			fmt.Printf("[BoltStore] MigrateVM writeToDB error: %v\n", err)
		}
	}
	fmt.Printf("[BoltStore] MigrateVM exit vm=%s duration=%s\n", vmID, time.Since(start))
	return sourceVM, nil
}

// InitializeWithSampleData creates sample data if no data exists (keeps previous sample)
func (s *Store) InitializeWithSampleData() {
	s.mu.Lock()
	s.data = &models.DatacenterCollection{
		Datacenters: []models.Datacenter{
			{
				ID:          "dc-stockholm-north",
				Name:        "Stockholm North DC",
				Location:    "Kista, Stockholm",
				Coordinates: []float64{59.41966666666667, 17.94661111111111},
				VMs: []models.VM{
					{
						ID:     "vm-001",
						Name:   "web-server-01",
						Status: "running",
						CPU:    4,
						Memory: 8192,
						Disk:   100,
					},
					{
						ID:     "vm-002",
						Name:   "database-01",
						Status: "running",
						CPU:    8,
						Memory: 16384,
						Disk:   500,
					},
					{
						ID:     "vm-003",
						Name:   "cache-01",
						Status: "running",
						CPU:    2,
						Memory: 4096,
						Disk:   50,
					},
				},
			},
			{
				ID:          "dc-solna",
				Name:        "Stockholm Solna DC",
				Location:    "Järvastaden, Solna",
				Coordinates: []float64{59.38162465568805, 17.98030981149373},
				VMs: []models.VM{
					{
						ID:     "vm-004",
						Name:   "web-server-02",
						Status: "running",
						CPU:    4,
						Memory: 8192,
						Disk:   100,
					},
					{
						ID:     "vm-005",
						Name:   "backup-01",
						Status: "stopped",
						CPU:    2,
						Memory: 4096,
						Disk:   1000,
					},
				},
			},
		},
	}
	// marshal and persist sample data
	buf, err := json.Marshal(s.data)
	s.mu.Unlock()
	if err == nil {
		_ = s.writeToDB(buf)
	} else {
		fmt.Printf("[BoltStore] InitializeWithSampleData marshal error: %v\n", err)
	}
}

// Migration tracking methods

// AddMigration adds a new migration to the data store
func (s *Store) AddMigration(migration models.Migration) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	buf, err := json.Marshal(migration)
	if err != nil {
		return fmt.Errorf("failed to marshal migration: %w", err)
	}

	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(migrationsBucket))
		if b == nil {
			return fmt.Errorf("migrations bucket not found")
		}
		return b.Put([]byte(migration.ID), buf)
	})
}

// UpdateMigration updates an existing migration in the data store
func (s *Store) UpdateMigration(migration models.Migration) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	migration.UpdatedAt = time.Now()

	buf, err := json.Marshal(migration)
	if err != nil {
		return fmt.Errorf("failed to marshal migration: %w", err)
	}

	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(migrationsBucket))
		if b == nil {
			return fmt.Errorf("migrations bucket not found")
		}
		return b.Put([]byte(migration.ID), buf)
	})
}

// GetMigration retrieves a migration by ID
func (s *Store) GetMigration(migrationID string) (*models.Migration, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var migration models.Migration
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(migrationsBucket))
		if b == nil {
			return fmt.Errorf("migrations bucket not found")
		}
		v := b.Get([]byte(migrationID))
		if v == nil {
			return fmt.Errorf("migration %s not found", migrationID)
		}
		return json.Unmarshal(v, &migration)
	})
	if err != nil {
		return nil, err
	}
	return &migration, nil
}

// GetAllMigrations retrieves all migrations
func (s *Store) GetAllMigrations() ([]models.Migration, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var migrations []models.Migration
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(migrationsBucket))
		if b == nil {
			return fmt.Errorf("migrations bucket not found")
		}
		return b.ForEach(func(k, v []byte) error {
			var migration models.Migration
			if err := json.Unmarshal(v, &migration); err != nil {
				log.Printf("Failed to unmarshal migration %s: %v", string(k), err)
				return nil // Continue to next migration
			}
			migrations = append(migrations, migration)
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	return migrations, nil
}

// GetMigrationsByDatacenter retrieves migrations for a specific datacenter
func (s *Store) GetMigrationsByDatacenter(datacenterID string) ([]models.Migration, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var migrations []models.Migration
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(migrationsBucket))
		if b == nil {
			return fmt.Errorf("migrations bucket not found")
		}
		return b.ForEach(func(k, v []byte) error {
			var migration models.Migration
			if err := json.Unmarshal(v, &migration); err != nil {
				log.Printf("Failed to unmarshal migration %s: %v", string(k), err)
				return nil // Continue to next migration
			}
			if migration.DatacenterID == datacenterID {
				migrations = append(migrations, migration)
			}
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	return migrations, nil
}

// GetMigrationsByVM retrieves migrations for a specific VM
func (s *Store) GetMigrationsByVM(vmName string) ([]models.Migration, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var migrations []models.Migration
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(migrationsBucket))
		if b == nil {
			return fmt.Errorf("migrations bucket not found")
		}
		return b.ForEach(func(k, v []byte) error {
			var migration models.Migration
			if err := json.Unmarshal(v, &migration); err != nil {
				log.Printf("Failed to unmarshal migration %s: %v", string(k), err)
				return nil // Continue to next migration
			}
			if migration.VMName == vmName {
				migrations = append(migrations, migration)
			}
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	return migrations, nil
}

// GetActiveMigrations retrieves all active (non-completed) migrations
func (s *Store) GetActiveMigrations() ([]models.Migration, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var migrations []models.Migration
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(migrationsBucket))
		if b == nil {
			return fmt.Errorf("migrations bucket not found")
		}
		return b.ForEach(func(k, v []byte) error {
			var migration models.Migration
			if err := json.Unmarshal(v, &migration); err != nil {
				log.Printf("Failed to unmarshal migration %s: %v", string(k), err)
				return nil // Continue to next migration
			}
			if !migration.Completed {
				migrations = append(migrations, migration)
			}
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	return migrations, nil
}

// GetMigrationsByDirection retrieves migrations filtered by direction (incoming/outgoing/unknown)
func (s *Store) GetMigrationsByDirection(direction string) ([]models.Migration, error) {
	var migrations []models.Migration

	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(migrationsBucket))
		if b == nil {
			return fmt.Errorf("migrations bucket not found")
		}

		return b.ForEach(func(k, v []byte) error {
			var migration models.Migration
			if err := json.Unmarshal(v, &migration); err != nil {
				log.Printf("Failed to unmarshal migration %s: %v", string(k), err)
				return nil // Continue to next migration
			}
			if migration.Direction == direction {
				migrations = append(migrations, migration)
			}
			return nil
		})
	})

	return migrations, err
}

// RemoveMigration removes a migration from the data store
func (s *Store) RemoveMigration(migrationID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(migrationsBucket))
		if b == nil {
			return fmt.Errorf("migrations bucket not found")
		}
		return b.Delete([]byte(migrationID))
	})
}
