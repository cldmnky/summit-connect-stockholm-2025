package data

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

// DataStore handles data operations and persists to BoltDB
type DataStore struct {
	mu   sync.RWMutex
	data *models.DatacenterCollection
	db   *bbolt.DB
}

// NewDataStore opens/creates the BoltDB file at dbPath and loads data
// If the DB is empty and a jsonSeedPath is provided and exists it will be used to seed data.
func NewDataStore(dbPath string, jsonSeedPath string) (*DataStore, error) {
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

	ds := &DataStore{data: &models.DatacenterCollection{}, db: db}

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
					fmt.Printf("[DataStore] seeded DB via viper config file %s\n", jsonSeedPath)
					if perr := ds.writeSeedAndLog(); perr != nil {
						return nil, perr
					}
					return ds, nil
				}
			} else {
				fmt.Printf("[DataStore] viper failed to read config %s: %v\n", jsonSeedPath, err)
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
				fmt.Printf("[DataStore] seeded DB via viper default config (datacenters)\n")
				if perr := ds.writeSeedAndLog(); perr != nil {
					return nil, perr
				}
				return ds, nil
			}
		} else {
			fmt.Printf("[DataStore] viper default config not found: %v\n", err)
		}

		// If no config found, initialize with embedded sample data and persist
		fmt.Printf("[DataStore] no config found, initializing with sample data\n")
		ds.InitializeWithSampleData()
	}

	return ds, nil
}

// Close closes the BoltDB
func (ds *DataStore) Close() error {
	return ds.db.Close()
}

// InitializeFromVMWatcherConfig creates datacenter structure from VM watcher config (without VMs)
func (ds *DataStore) InitializeFromVMWatcherConfig(configPath string) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

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

	ds.data = &models.DatacenterCollection{
		Datacenters: datacenters,
	}

	// Persist the empty datacenter structure
	buf, err := json.Marshal(ds.data)
	if err != nil {
		return fmt.Errorf("failed to marshal datacenter structure: %w", err)
	}

	if err := ds.writeToDB(buf); err != nil {
		return fmt.Errorf("failed to persist datacenter structure: %w", err)
	}

	fmt.Printf("[DataStore] initialized from VM watcher config: %s with %d datacenters\n", configPath, len(datacenters))
	return nil
}

// loadFromJSONFile reads a JSON file and sets ds.data (used for seeding)
func (ds *DataStore) loadFromJSONFile(filename string) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	b, err := os.ReadFile(filename)
	if err != nil {
		return err
	}
	var col models.DatacenterCollection
	if err := json.Unmarshal(b, &col); err != nil {
		return err
	}
	ds.data = &col
	return nil
}

// loadFromDB loads the collection from BoltDB into memory
func (ds *DataStore) loadFromDB() error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	return ds.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(defaultBucket))
		if b == nil {
			return fmt.Errorf("bucket %s not found", defaultBucket)
		}
		v := b.Get([]byte(defaultKey))
		if v == nil {
			// no data yet
			ds.data = &models.DatacenterCollection{}
			return fmt.Errorf("no data in db")
		}
		var col models.DatacenterCollection
		if err := json.Unmarshal(v, &col); err != nil {
			return err
		}
		ds.data = &col
		return nil
	})
}

// saveToDB persists the in-memory collection to BoltDB
func (ds *DataStore) saveToDB() error {
	// Marshal under a read-lock to capture a consistent snapshot.
	ds.mu.RLock()
	buf, err := json.Marshal(ds.data)
	ds.mu.RUnlock()
	if err != nil {
		return err
	}
	return ds.writeToDB(buf)
}

// writeToDB writes the provided marshaled buffer into the BoltDB
// This method does NOT attempt to acquire ds.mu; callers must ensure
// they are not holding locks that would deadlock with callers that
// call this function. It's safe to call from goroutines without
// holding the DataStore mutex.
func (ds *DataStore) writeToDB(buf []byte) error {
	start := time.Now()
	fmt.Printf("[DataStore] writeToDB start size=%d\n", len(buf))
	err := ds.db.Update(func(tx *bbolt.Tx) error {
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
		fmt.Printf("[DataStore] writeToDB error: %v duration=%s\n", err, dur)
	} else {
		fmt.Printf("[DataStore] writeToDB ok duration=%s\n", dur)
	}
	return err
}

// writeSeedAndLog marshals current in-memory ds.data and persists it to DB (used for seeding)
func (ds *DataStore) writeSeedAndLog() error {
	ds.mu.RLock()
	buf, err := json.Marshal(ds.data)
	ds.mu.RUnlock()
	if err != nil {
		return err
	}
	fmt.Printf("[DataStore] seeding DB: size=%d\n", len(buf))
	return ds.writeToDB(buf)
}

// GetDatacenters returns all datacenters (deep copy)
func (ds *DataStore) GetDatacenters() *models.DatacenterCollection {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	jsonData, _ := json.Marshal(ds.data)
	var copy models.DatacenterCollection
	json.Unmarshal(jsonData, &copy)
	return &copy
}

// UpdateDatacenter updates fields of a datacenter (coordinates, name, location)
func (ds *DataStore) UpdateDatacenter(id string, name *string, location *string, coordinates *[]float64) (*models.Datacenter, error) {
	start := time.Now()
	fmt.Printf("[DataStore] UpdateDatacenter entry id=%s\n", id)
	ds.mu.Lock()
	// perform modification under lock, marshal snapshot, then unlock and write to DB
	for i := range ds.data.Datacenters {
		if ds.data.Datacenters[i].ID == id {
			if name != nil {
				ds.data.Datacenters[i].Name = *name
			}
			if location != nil {
				ds.data.Datacenters[i].Location = *location
			}
			if coordinates != nil {
				ds.data.Datacenters[i].Coordinates = *coordinates
			}
			// make a copy for return
			dc := ds.data.Datacenters[i]
			// marshal snapshot while still holding lock
			buf, err := json.Marshal(ds.data)
			ds.mu.Unlock()
			if err != nil {
				fmt.Printf("[DataStore] UpdateDatacenter marshal error: %v\n", err)
			} else {
				if err := ds.writeToDB(buf); err != nil {
					fmt.Printf("[DataStore] UpdateDatacenter writeToDB error: %v\n", err)
				}
			}
			fmt.Printf("[DataStore] UpdateDatacenter exit id=%s duration=%s\n", id, time.Since(start))
			return &dc, nil
		}
	}
	ds.mu.Unlock()
	fmt.Printf("[DataStore] UpdateDatacenter exit id=%s duration=%s\n", id, time.Since(start))
	return nil, fmt.Errorf("datacenter %s not found", id)
}

// UpdateVM updates fields of a VM in a datacenter (legacy method for backward compatibility)
func (ds *DataStore) UpdateVM(dcID, vmID string, name *string, status *string, cpu *int, memory *int, disk *int, cluster *string) (*models.VM, error) {
	start := time.Now()
	fmt.Printf("[DataStore] UpdateVM entry dc=%s vm=%s\n", dcID, vmID)
	ds.mu.Lock()
	for i := range ds.data.Datacenters {
		if ds.data.Datacenters[i].ID == dcID {
			for j := range ds.data.Datacenters[i].VMs {
				if ds.data.Datacenters[i].VMs[j].ID == vmID {
					vm := &ds.data.Datacenters[i].VMs[j]
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
					buf, err := json.Marshal(ds.data)
					ds.mu.Unlock()
					if err != nil {
						fmt.Printf("[DataStore] UpdateVM marshal error: %v\n", err)
					} else {
						if err := ds.writeToDB(buf); err != nil {
							fmt.Printf("[DataStore] UpdateVM writeToDB error: %v\n", err)
						}
					}
					fmt.Printf("[DataStore] UpdateVM exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
					return &copy, nil
				}
			}
			ds.mu.Unlock()
			fmt.Printf("[DataStore] UpdateVM exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
			return nil, fmt.Errorf("vm %s not found in datacenter %s", vmID, dcID)
		}
	}
	ds.mu.Unlock()
	fmt.Printf("[DataStore] UpdateVM exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
	return nil, fmt.Errorf("datacenter %s not found", dcID)
}

// UpdateVMComplete updates all fields of a VM in a datacenter with the complete VM model
func (ds *DataStore) UpdateVMComplete(dcID, vmID string, updatedVM *models.VM) (*models.VM, error) {
	start := time.Now()
	fmt.Printf("[DataStore] UpdateVMComplete entry dc=%s vm=%s\n", dcID, vmID)
	ds.mu.Lock()
	for i := range ds.data.Datacenters {
		if ds.data.Datacenters[i].ID == dcID {
			for j := range ds.data.Datacenters[i].VMs {
				if ds.data.Datacenters[i].VMs[j].ID == vmID {
					// Update all fields from the provided VM model
					vm := &ds.data.Datacenters[i].VMs[j]
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
					buf, err := json.Marshal(ds.data)
					ds.mu.Unlock()
					if err != nil {
						fmt.Printf("[DataStore] UpdateVMComplete marshal error: %v\n", err)
					} else {
						if err := ds.writeToDB(buf); err != nil {
							fmt.Printf("[DataStore] UpdateVMComplete writeToDB error: %v\n", err)
						}
					}
					fmt.Printf("[DataStore] UpdateVMComplete exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
					return &copy, nil
				}
			}
			ds.mu.Unlock()
			fmt.Printf("[DataStore] UpdateVMComplete exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
			return nil, fmt.Errorf("vm %s not found in datacenter %s", vmID, dcID)
		}
	}
	ds.mu.Unlock()
	fmt.Printf("[DataStore] UpdateVMComplete exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
	return nil, fmt.Errorf("datacenter %s not found", dcID)
}

// AddVM adds a VM to a datacenter
func (ds *DataStore) AddVM(dcID string, vm models.VM) (*models.VM, error) {
	start := time.Now()
	fmt.Printf("[DataStore] AddVM entry dc=%s vm=%s\n", dcID, vm.ID)
	ds.mu.Lock()
	for i := range ds.data.Datacenters {
		if ds.data.Datacenters[i].ID == dcID {
			ds.data.Datacenters[i].VMs = append(ds.data.Datacenters[i].VMs, vm)
			copy := vm
			buf, err := json.Marshal(ds.data)
			ds.mu.Unlock()
			if err != nil {
				fmt.Printf("[DataStore] AddVM marshal error: %v\n", err)
			} else {
				if err := ds.writeToDB(buf); err != nil {
					fmt.Printf("[DataStore] AddVM writeToDB error: %v\n", err)
				}
			}
			fmt.Printf("[DataStore] AddVM exit dc=%s vm=%s duration=%s\n", dcID, vm.ID, time.Since(start))
			return &copy, nil
		}
	}
	ds.mu.Unlock()
	fmt.Printf("[DataStore] AddVM exit dc=%s vm=%s duration=%s\n", dcID, vm.ID, time.Since(start))
	return nil, fmt.Errorf("datacenter %s not found", dcID)
}

// RemoveVM removes a VM from a datacenter
func (ds *DataStore) RemoveVM(dcID, vmID string) error {
	start := time.Now()
	fmt.Printf("[DataStore] RemoveVM entry dc=%s vm=%s\n", dcID, vmID)
	ds.mu.Lock()
	for i := range ds.data.Datacenters {
		if ds.data.Datacenters[i].ID == dcID {
			for j := range ds.data.Datacenters[i].VMs {
				if ds.data.Datacenters[i].VMs[j].ID == vmID {
					ds.data.Datacenters[i].VMs = append(ds.data.Datacenters[i].VMs[:j], ds.data.Datacenters[i].VMs[j+1:]...)
					buf, err := json.Marshal(ds.data)
					ds.mu.Unlock()
					if err != nil {
						fmt.Printf("[DataStore] RemoveVM marshal error: %v\n", err)
					} else {
						if err := ds.writeToDB(buf); err != nil {
							fmt.Printf("[DataStore] RemoveVM writeToDB error: %v\n", err)
						}
					}
					fmt.Printf("[DataStore] RemoveVM exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
					return nil
				}
			}
			ds.mu.Unlock()
			fmt.Printf("[DataStore] RemoveVM exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
			return fmt.Errorf("vm %s not found in datacenter %s", vmID, dcID)
		}
	}
	ds.mu.Unlock()
	fmt.Printf("[DataStore] RemoveVM exit dc=%s vm=%s duration=%s\n", dcID, vmID, time.Since(start))
	return fmt.Errorf("datacenter %s not found", dcID)
}

// MigrateVM migrates a VM from one datacenter to another
func (ds *DataStore) MigrateVM(vmID, fromDC, toDC string) (*models.VM, error) {
	start := time.Now()
	fmt.Printf("[DataStore] MigrateVM entry vm=%s from=%s to=%s\n", vmID, fromDC, toDC)
	ds.mu.Lock()
	var sourceVM *models.VM
	var targetDCIndex int = -1

	for i, dc := range ds.data.Datacenters {
		if dc.ID == fromDC {
			for j, vm := range dc.VMs {
				if vm.ID == vmID {
					// copy of vm
					tmp := vm
					sourceVM = &tmp
					ds.data.Datacenters[i].VMs = append(dc.VMs[:j], dc.VMs[j+1:]...)
					break
				}
			}
		}
		if dc.ID == toDC {
			targetDCIndex = i
		}
	}

	if sourceVM == nil {
		ds.mu.Unlock()
		fmt.Printf("[DataStore] MigrateVM exit vm=%s duration=%s\n", vmID, time.Since(start))
		return nil, fmt.Errorf("VM %s not found in datacenter %s", vmID, fromDC)
	}

	if targetDCIndex == -1 {
		ds.mu.Unlock()
		fmt.Printf("[DataStore] MigrateVM exit vm=%s duration=%s\n", vmID, time.Since(start))
		return nil, fmt.Errorf("target datacenter %s not found", toDC)
	}

	now := time.Now()
	sourceVM.LastMigratedAt = &now

	ds.data.Datacenters[targetDCIndex].VMs = append(ds.data.Datacenters[targetDCIndex].VMs, *sourceVM)

	buf, err := json.Marshal(ds.data)
	ds.mu.Unlock()
	if err != nil {
		fmt.Printf("[DataStore] MigrateVM marshal error: %v\n", err)
	} else {
		if err := ds.writeToDB(buf); err != nil {
			fmt.Printf("[DataStore] MigrateVM writeToDB error: %v\n", err)
		}
	}
	fmt.Printf("[DataStore] MigrateVM exit vm=%s duration=%s\n", vmID, time.Since(start))
	return sourceVM, nil
}

// InitializeWithSampleData creates sample data if no data exists (keeps previous sample)
func (ds *DataStore) InitializeWithSampleData() {
	ds.mu.Lock()
	ds.data = &models.DatacenterCollection{
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
	buf, err := json.Marshal(ds.data)
	ds.mu.Unlock()
	if err == nil {
		_ = ds.writeToDB(buf)
	} else {
		fmt.Printf("[DataStore] InitializeWithSampleData marshal error: %v\n", err)
	}
}

// Migration tracking methods

// AddMigration adds a new migration to the data store
func (ds *DataStore) AddMigration(migration models.Migration) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	buf, err := json.Marshal(migration)
	if err != nil {
		return fmt.Errorf("failed to marshal migration: %w", err)
	}

	return ds.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(migrationsBucket))
		if b == nil {
			return fmt.Errorf("migrations bucket not found")
		}
		return b.Put([]byte(migration.ID), buf)
	})
}

// UpdateMigration updates an existing migration in the data store
func (ds *DataStore) UpdateMigration(migration models.Migration) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	migration.UpdatedAt = time.Now()

	buf, err := json.Marshal(migration)
	if err != nil {
		return fmt.Errorf("failed to marshal migration: %w", err)
	}

	return ds.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(migrationsBucket))
		if b == nil {
			return fmt.Errorf("migrations bucket not found")
		}
		return b.Put([]byte(migration.ID), buf)
	})
}

// GetMigration retrieves a migration by ID
func (ds *DataStore) GetMigration(migrationID string) (*models.Migration, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	var migration models.Migration
	err := ds.db.View(func(tx *bbolt.Tx) error {
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
func (ds *DataStore) GetAllMigrations() ([]models.Migration, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	var migrations []models.Migration
	err := ds.db.View(func(tx *bbolt.Tx) error {
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
func (ds *DataStore) GetMigrationsByDatacenter(datacenterID string) ([]models.Migration, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	var migrations []models.Migration
	err := ds.db.View(func(tx *bbolt.Tx) error {
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
func (ds *DataStore) GetMigrationsByVM(vmName string) ([]models.Migration, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	var migrations []models.Migration
	err := ds.db.View(func(tx *bbolt.Tx) error {
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
func (ds *DataStore) GetActiveMigrations() ([]models.Migration, error) {
	ds.mu.RLock()
	defer ds.mu.RUnlock()

	var migrations []models.Migration
	err := ds.db.View(func(tx *bbolt.Tx) error {
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

// RemoveMigration removes a migration from the data store
func (ds *DataStore) RemoveMigration(migrationID string) error {
	ds.mu.Lock()
	defer ds.mu.Unlock()

	return ds.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket([]byte(migrationsBucket))
		if b == nil {
			return fmt.Errorf("migrations bucket not found")
		}
		return b.Delete([]byte(migrationID))
	})
}
