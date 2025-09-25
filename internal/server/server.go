package server

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"

	"github.com/cldmnky/summit-connect-stockholm-2025/internal/data"
	"github.com/cldmnky/summit-connect-stockholm-2025/internal/models"
	"github.com/cldmnky/summit-connect-stockholm-2025/internal/watcher"
)

var dataStore *data.DataStore
var vmWatcher *watcher.VMWatcher

// InitDataStore initializes the package-level datastore. Call this before StartBackendServer.
func InitDataStore(dbPath string, seedPath string) error {
	if dbPath == "" {
		dbPath = "/tmp/summit-connect.db"
	}
	ds, err := data.NewDataStore(dbPath, seedPath)
	if err != nil {
		return err
	}
	dataStore = ds
	return nil
}

// InitDataStoreForVMWatcher initializes the datastore with empty datacenter structure from VM watcher config
func InitDataStoreForVMWatcher(dbPath string, watcherConfigPath string) error {
	if dbPath == "" {
		dbPath = "/tmp/summit-connect.db"
	}

	// Create datastore (may initialize with sample data, but we'll override it)
	ds, err := data.NewDataStore(dbPath, "")
	if err != nil {
		return err
	}

	// Override with proper datacenter structure from VM watcher config
	if err := ds.InitializeFromVMWatcherConfig(watcherConfigPath); err != nil {
		return fmt.Errorf("failed to initialize from VM watcher config: %w", err)
	}

	dataStore = ds
	return nil
}

// InitVMWatcher initializes and starts the VM watcher
func InitVMWatcher(configPath string) error {
	if dataStore == nil {
		return fmt.Errorf("datastore must be initialized before starting VM watcher")
	}

	watcher, err := watcher.NewVMWatcher(dataStore, configPath)
	if err != nil {
		return fmt.Errorf("failed to create VM watcher: %w", err)
	}

	vmWatcher = watcher

	// Start the watcher in background
	go func() {
		if err := vmWatcher.Start(); err != nil {
			log.Printf("Failed to start VM watcher: %v", err)
		}
	}()

	log.Printf("VM watcher initialized and started")
	return nil
}

// StartBackendServer starts the Fiber backend API server
func StartBackendServer(port int) {
	app := fiber.New(fiber.Config{
		AppName: "Summit Connect Stockholm 2025 API",
	})

	// Middleware
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// Get current working directory
	wd, err := os.Getwd()
	if err != nil {
		log.Fatal("Could not get working directory:", err)
	}

	// Frontend path (static files will be served after API routes are defined)
	frontendPath := filepath.Join(wd, "frontend")

	// API routes
	api := app.Group("/api/v1")

	// Get all datacenters
	api.Get("/datacenters", getDatacenters)

	// Admin routes for runtime updates
	admin := api.Group("/admin")
	admin.Get("/datacenters", func(c *fiber.Ctx) error {
		return c.JSON(dataStore.GetDatacenters())
	})

	// PATCH /api/v1/admin/datacenters/:id  -> update name/location/coordinates
	admin.Patch("/datacenters/:id", func(c *fiber.Ctx) error {
		id := c.Params("id")
		var payload struct {
			Name        *string    `json:"name,omitempty"`
			Location    *string    `json:"location,omitempty"`
			Coordinates *[]float64 `json:"coordinates,omitempty"`
		}
		log.Printf("ADMIN: PATCH datacenter %s - raw body: %s", id, string(c.Body()))
		if err := c.BodyParser(&payload); err != nil {
			log.Printf("ADMIN: PATCH datacenter %s - body parse error: %v", id, err)
			return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
		}
		log.Printf("ADMIN: PATCH datacenter %s - parsed payload: %+v", id, payload)

		dc, err := dataStore.UpdateDatacenter(id, payload.Name, payload.Location, payload.Coordinates)
		if err != nil {
			log.Printf("ADMIN: PATCH datacenter %s - update error: %v", id, err)
			return c.Status(404).JSON(fiber.Map{"error": err.Error()})
		}

		log.Printf("ADMIN: PATCH datacenter %s - success", id)
		return c.JSON(dc)
	})

	// PATCH /api/v1/admin/datacenters/:dcId/vms/:vmId -> update VM fields
	admin.Patch("/datacenters/:dcId/vms/:vmId", func(c *fiber.Ctx) error {
		dcId := c.Params("dcId")
		vmId := c.Params("vmId")
		var payload struct {
			Name    *string `json:"name,omitempty"`
			Status  *string `json:"status,omitempty"`
			CPU     *int    `json:"cpu,omitempty"`
			Memory  *int    `json:"memory,omitempty"`
			Disk    *int    `json:"disk,omitempty"`
			Cluster *string `json:"cluster,omitempty"`
		}
		log.Printf("ADMIN: PATCH vm %s in dc %s - raw body: %s", vmId, dcId, string(c.Body()))
		if err := c.BodyParser(&payload); err != nil {
			log.Printf("ADMIN: PATCH vm %s in dc %s - body parse error: %v", vmId, dcId, err)
			return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
		}
		log.Printf("ADMIN: PATCH vm %s in dc %s - parsed payload: %+v", vmId, dcId, payload)

		vm, err := dataStore.UpdateVM(dcId, vmId, payload.Name, payload.Status, payload.CPU, payload.Memory, payload.Disk, payload.Cluster)
		if err != nil {
			log.Printf("ADMIN: PATCH vm %s in dc %s - update error: %v", vmId, dcId, err)
			return c.Status(404).JSON(fiber.Map{"error": err.Error()})
		}

		log.Printf("ADMIN: PATCH vm %s in dc %s - success", vmId, dcId)
		return c.JSON(vm)
	})

	// POST /api/v1/admin/datacenters/:dcId/vms -> add VM
	admin.Post("/datacenters/:dcId/vms", func(c *fiber.Ctx) error {
		dcId := c.Params("dcId")
		var vm models.VM
		log.Printf("ADMIN: POST add vm to dc %s - raw body: %s", dcId, string(c.Body()))
		if err := c.BodyParser(&vm); err != nil {
			log.Printf("ADMIN: POST add vm to dc %s - body parse error: %v", dcId, err)
			return c.Status(400).JSON(fiber.Map{"error": "invalid payload"})
		}
		log.Printf("ADMIN: POST add vm to dc %s - parsed vm: %+v", dcId, vm)
		added, err := dataStore.AddVM(dcId, vm)
		if err != nil {
			log.Printf("ADMIN: POST add vm to dc %s - add error: %v", dcId, err)
			return c.Status(404).JSON(fiber.Map{"error": err.Error()})
		}
		log.Printf("ADMIN: POST add vm to dc %s - success vm id: %s", dcId, added.ID)
		return c.JSON(added)
	})

	// DELETE /api/v1/admin/datacenters/:dcId/vms/:vmId -> remove VM
	admin.Delete("/datacenters/:dcId/vms/:vmId", func(c *fiber.Ctx) error {
		dcId := c.Params("dcId")
		vmId := c.Params("vmId")
		log.Printf("ADMIN: DELETE vm %s from dc %s - entry", vmId, dcId)
		if err := dataStore.RemoveVM(dcId, vmId); err != nil {
			log.Printf("ADMIN: DELETE vm %s from dc %s - error: %v", vmId, dcId, err)
			return c.Status(404).JSON(fiber.Map{"error": err.Error()})
		}
		log.Printf("ADMIN: DELETE vm %s from dc %s - success", vmId, dcId)
		return c.SendStatus(204)
	})

	// Migrate VM
	api.Post("/migrate", migrateVM)

	// Auto migrate (picks a random VM and migrates it)
	api.Get("/migrate", autoMigrateVM)

	// Migration tracking endpoints
	api.Get("/migrations", getAllMigrations)
	api.Get("/migrations/:id", getMigration)
	api.Get("/migrations/datacenter/:dcId", getMigrationsByDatacenter)
	api.Get("/migrations/vm/:vmName", getMigrationsByVM)
	api.Get("/migrations/active", getActiveMigrations)

	// Status endpoint
	api.Get("/status", getStatus)

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "healthy",
			"service": "backend-api",
		})
	})

	// Serve frontend static files after API routes to avoid route conflicts
	app.Static("/", frontendPath)

	log.Printf("Backend API server starting on port %d", port)
	log.Printf("Also serving frontend static files from %s", frontendPath)
	log.Fatal(app.Listen(fmt.Sprintf(":%d", port)))
}

// API Handlers

func getDatacenters(c *fiber.Ctx) error {
	datacenters := dataStore.GetDatacenters()
	return c.JSON(datacenters)
}

func migrateVM(c *fiber.Ctx) error {
	var req models.MigrateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(models.MigrateResponse{
			Success: false,
			Message: "Invalid request body",
		})
	}

	// Validate request
	if req.VMID == "" || req.FromDC == "" || req.ToDC == "" {
		return c.Status(400).JSON(models.MigrateResponse{
			Success: false,
			Message: "vmId, fromDC, and toDC are required",
		})
	}

	if req.FromDC == req.ToDC {
		return c.Status(400).JSON(models.MigrateResponse{
			Success: false,
			Message: "Source and target datacenters cannot be the same",
		})
	}

	// Perform migration
	vm, err := dataStore.MigrateVM(req.VMID, req.FromDC, req.ToDC)
	if err != nil {
		return c.Status(404).JSON(models.MigrateResponse{
			Success: false,
			Message: err.Error(),
		})
	}

	// Data store persists to BoltDB automatically

	return c.JSON(models.MigrateResponse{
		Success: true,
		Message: fmt.Sprintf("Successfully migrated VM %s (%s) from %s to %s", vm.ID, vm.Name, req.FromDC, req.ToDC),
		VM:      vm,
	})
}

func autoMigrateVM(c *fiber.Ctx) error {
	datacenters := dataStore.GetDatacenters()

	// Find a VM to migrate (prefer running VMs)
	var sourceVM *models.VM
	var sourceDC *models.Datacenter
	var targetDC *models.Datacenter

	// Look for running VMs first
	for i := range datacenters.Datacenters {
		dc := &datacenters.Datacenters[i]
		for j := range dc.VMs {
			vm := &dc.VMs[j]
			if vm.Status == "running" {
				sourceVM = vm
				sourceDC = dc
				break
			}
		}
		if sourceVM != nil {
			break
		}
	}

	// If no running VMs, pick any VM
	if sourceVM == nil {
		for i := range datacenters.Datacenters {
			dc := &datacenters.Datacenters[i]
			if len(dc.VMs) > 0 {
				sourceVM = &dc.VMs[0]
				sourceDC = dc
				break
			}
		}
	}

	if sourceVM == nil {
		return c.JSON(fiber.Map{
			"ok":       true,
			"migrated": false,
			"reason":   "No VMs available for migration",
		})
	}

	// Find a target datacenter (different from source)
	for i := range datacenters.Datacenters {
		dc := &datacenters.Datacenters[i]
		if dc.ID != sourceDC.ID {
			targetDC = dc
			break
		}
	}

	if targetDC == nil {
		return c.JSON(fiber.Map{
			"ok":       true,
			"migrated": false,
			"reason":   "No target datacenter available",
		})
	}

	// Check if dry-run is requested
	dryRun := c.Query("dry-run") == "1"

	if dryRun {
		// Return migration info without actually performing it
		return c.JSON(fiber.Map{
			"ok":       true,
			"migrated": true,
			"vmId":     sourceVM.ID,
			"from":     sourceDC.ID,
			"to":       targetDC.ID,
			"reason":   "Dry run - migration simulated",
		})
	}

	// Perform actual migration
	vm, err := dataStore.MigrateVM(sourceVM.ID, sourceDC.ID, targetDC.ID)
	if err != nil {
		return c.JSON(fiber.Map{
			"ok":       false,
			"migrated": false,
			"reason":   err.Error(),
		})
	}

	// Data store persists to BoltDB automatically

	return c.JSON(fiber.Map{
		"ok":       true,
		"migrated": true,
		"vmId":     vm.ID,
		"from":     sourceDC.ID,
		"to":       targetDC.ID,
		"reason":   fmt.Sprintf("Successfully migrated VM %s from %s to %s", vm.Name, sourceDC.Name, targetDC.Name),
	})
}

func getStatus(c *fiber.Ctx) error {
	datacenters := dataStore.GetDatacenters()

	totalVMs := 0
	runningVMs := 0
	for _, dc := range datacenters.Datacenters {
		totalVMs += len(dc.VMs)
		for _, vm := range dc.VMs {
			if vm.Status == "running" {
				runningVMs++
			}
		}
	}

	return c.JSON(fiber.Map{
		"datacenters": len(datacenters.Datacenters),
		"total_vms":   totalVMs,
		"running_vms": runningVMs,
		"stopped_vms": totalVMs - runningVMs,
	})
}

// Migration API handlers

func getAllMigrations(c *fiber.Ctx) error {
	migrations, err := dataStore.GetAllMigrations()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(migrations)
}

func getMigration(c *fiber.Ctx) error {
	id := c.Params("id")
	migration, err := dataStore.GetMigration(id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return c.Status(404).JSON(fiber.Map{"error": "migration not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(migration)
}

func getMigrationsByDatacenter(c *fiber.Ctx) error {
	dcId := c.Params("dcId")
	migrations, err := dataStore.GetMigrationsByDatacenter(dcId)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(migrations)
}

func getMigrationsByVM(c *fiber.Ctx) error {
	vmName := c.Params("vmName")
	migrations, err := dataStore.GetMigrationsByVM(vmName)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(migrations)
}

func getActiveMigrations(c *fiber.Ctx) error {
	migrations, err := dataStore.GetActiveMigrations()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(migrations)
}
