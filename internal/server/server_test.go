package server_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/cldmnky/summit-connect-stockholm-2025/internal/mocks"
	"github.com/cldmnky/summit-connect-stockholm-2025/internal/models"
	"github.com/cldmnky/summit-connect-stockholm-2025/internal/server"
)

var _ = Describe("Server API Handlers", func() {
	var (
		app       *fiber.App
		mockStore *mocks.MockStore
	)

	BeforeEach(func() {
		// Create a new Fiber app for each test
		app = fiber.New(fiber.Config{
			ErrorHandler: func(ctx *fiber.Ctx, err error) error {
				return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": err.Error(),
				})
			},
		})

		// Create and initialize mock store
		mockStore = mocks.NewMockStore()
		mockStore.InitializeWithSampleData()

		// Setup test server with mock store
		setupTestServer(app, mockStore)
	})

	Describe("Health Check", func() {
		It("should return healthy status", func() {
			req := httptest.NewRequest(http.MethodGet, "/health", nil)
			resp, err := app.Test(req)
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.StatusCode).To(Equal(http.StatusOK))

			var result map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&result)
			Expect(err).NotTo(HaveOccurred())
			Expect(result["status"]).To(Equal("healthy"))
			Expect(result["service"]).To(Equal("backend-api"))
		})
	})

	Describe("GET /api/v1/datacenters", func() {
		It("should return all datacenters", func() {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/datacenters", nil)
			resp, err := app.Test(req)
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.StatusCode).To(Equal(http.StatusOK))

			var result models.DatacenterCollection
			err = json.NewDecoder(resp.Body).Decode(&result)
			Expect(err).NotTo(HaveOccurred())
			Expect(len(result.Datacenters)).To(Equal(2))
			Expect(result.Datacenters[0].ID).To(Equal("dc-test-1"))
			Expect(result.Datacenters[1].ID).To(Equal("dc-test-2"))
		})

		It("should handle store errors gracefully", func() {
			mockStore.SetShouldError(true, "database connection failed")

			req := httptest.NewRequest(http.MethodGet, "/api/v1/datacenters", nil)
			resp, err := app.Test(req)
			Expect(err).NotTo(HaveOccurred())
			// Even with store errors, GetDatacenters shouldn't fail in our mock
			// but would return empty data
			Expect(resp.StatusCode).To(Equal(http.StatusOK))
		})
	})

	Describe("GET /api/v1/status", func() {
		It("should return correct status information", func() {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/status", nil)
			resp, err := app.Test(req)
			Expect(err).NotTo(HaveOccurred())
			Expect(resp.StatusCode).To(Equal(http.StatusOK))

			var result map[string]interface{}
			err = json.NewDecoder(resp.Body).Decode(&result)
			Expect(err).NotTo(HaveOccurred())
			Expect(result["datacenters"]).To(Equal(float64(2)))
			Expect(result["total_vms"]).To(Equal(float64(2)))
			Expect(result["running_vms"]).To(Equal(float64(1)))
			Expect(result["stopped_vms"]).To(Equal(float64(1)))
		})
	})

	Describe("POST /api/v1/migrate", func() {
		Context("with valid migration request", func() {
			It("should migrate VM successfully", func() {
				migrateReq := models.MigrateRequest{
					VMID:   "vm-001",
					FromDC: "dc-test-1",
					ToDC:   "dc-test-2",
				}
				body, _ := json.Marshal(migrateReq)

				req := httptest.NewRequest(http.MethodPost, "/api/v1/migrate", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusOK))

				var result models.MigrateResponse
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(result.Success).To(BeTrue())
				Expect(result.VM.ID).To(Equal("vm-001"))
			})
		})

		Context("with invalid migration request", func() {
			It("should return error for missing fields", func() {
				migrateReq := models.MigrateRequest{
					VMID: "vm-001",
					// Missing FromDC and ToDC
				}
				body, _ := json.Marshal(migrateReq)

				req := httptest.NewRequest(http.MethodPost, "/api/v1/migrate", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusBadRequest))

				var result models.MigrateResponse
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(result.Success).To(BeFalse())
				Expect(result.Message).To(ContainSubstring("required"))
			})

			It("should return error for same source and target", func() {
				migrateReq := models.MigrateRequest{
					VMID:   "vm-001",
					FromDC: "dc-test-1",
					ToDC:   "dc-test-1", // Same as fromDC
				}
				body, _ := json.Marshal(migrateReq)

				req := httptest.NewRequest(http.MethodPost, "/api/v1/migrate", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusBadRequest))

				var result models.MigrateResponse
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(result.Success).To(BeFalse())
				Expect(result.Message).To(ContainSubstring("cannot be the same"))
			})

			It("should return error for invalid JSON", func() {
				req := httptest.NewRequest(http.MethodPost, "/api/v1/migrate", strings.NewReader("invalid json"))
				req.Header.Set("Content-Type", "application/json")
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusBadRequest))

				var result models.MigrateResponse
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(result.Success).To(BeFalse())
				Expect(result.Message).To(Equal("Invalid request body"))
			})
		})
	})

	Describe("GET /api/v1/migrate", func() {
		Context("auto migration", func() {
			It("should auto migrate a VM", func() {
				req := httptest.NewRequest(http.MethodGet, "/api/v1/migrate", nil)
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusOK))

				var result map[string]interface{}
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(result["ok"]).To(BeTrue())
				Expect(result["migrated"]).To(BeTrue())
				Expect(result["vmId"]).To(Not(BeEmpty()))
			})

			It("should support dry-run mode", func() {
				req := httptest.NewRequest(http.MethodGet, "/api/v1/migrate?dry-run=1", nil)
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusOK))

				var result map[string]interface{}
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(result["ok"]).To(BeTrue())
				Expect(result["migrated"]).To(BeTrue())
				Expect(result["reason"]).To(ContainSubstring("Dry run"))
			})
		})
	})

	Describe("Admin API", func() {
		Describe("PATCH /api/v1/admin/datacenters/:id", func() {
			It("should update datacenter successfully", func() {
				updateReq := map[string]interface{}{
					"name":        "Updated Test DC 1",
					"location":    "Updated Location",
					"coordinates": []float64{60.0, 18.0},
				}
				body, _ := json.Marshal(updateReq)

				req := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/datacenters/dc-test-1", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusOK))

				var result models.Datacenter
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(result.Name).To(Equal("Updated Test DC 1"))
				Expect(result.Location).To(Equal("Updated Location"))
				Expect(result.Coordinates).To(Equal([]float64{60.0, 18.0}))
			})

			It("should return error for non-existent datacenter", func() {
				updateReq := map[string]interface{}{
					"name": "Updated Name",
				}
				body, _ := json.Marshal(updateReq)

				req := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/datacenters/non-existent", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusNotFound))
			})
		})

		Describe("POST /api/v1/admin/datacenters/:dcId/vms", func() {
			It("should add VM successfully", func() {
				newVM := models.VM{
					ID:     "vm-new",
					Name:   "new-test-vm",
					Status: "running",
					CPU:    4,
					Memory: 8192,
					Disk:   100,
				}
				body, _ := json.Marshal(newVM)

				req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/datacenters/dc-test-1/vms", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusOK))

				var result models.VM
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(result.ID).To(Equal("vm-new"))
				Expect(result.Name).To(Equal("new-test-vm"))
			})
		})

		Describe("PATCH /api/v1/admin/datacenters/:dcId/vms/:vmId", func() {
			It("should update VM successfully", func() {
				updateReq := map[string]interface{}{
					"name":   "updated-vm",
					"status": "stopped",
					"cpu":    8,
				}
				body, _ := json.Marshal(updateReq)

				req := httptest.NewRequest(http.MethodPatch, "/api/v1/admin/datacenters/dc-test-1/vms/vm-001", bytes.NewReader(body))
				req.Header.Set("Content-Type", "application/json")
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusOK))

				var result models.VM
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(result.Name).To(Equal("updated-vm"))
				Expect(result.Status).To(Equal("stopped"))
				Expect(result.CPU).To(Equal(8))
			})
		})

		Describe("DELETE /api/v1/admin/datacenters/:dcId/vms/:vmId", func() {
			It("should delete VM successfully", func() {
				req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/datacenters/dc-test-1/vms/vm-001", nil)
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusNoContent))
			})
		})
	})

	Describe("Migration API", func() {
		BeforeEach(func() {
			// Add some test migrations
			migration1 := models.Migration{
				ID:           "migration-1",
				VMID:         "vm-001",
				VMName:       "test-vm-1",
				DatacenterID: "dc-test-1",
				Phase:        "Running",
				Direction:    "outgoing",
				CreatedAt:    time.Now(),
				UpdatedAt:    time.Now(),
				Completed:    false,
			}
			migration2 := models.Migration{
				ID:           "migration-2",
				VMID:         "vm-002",
				VMName:       "test-vm-2",
				DatacenterID: "dc-test-2",
				Phase:        "Succeeded",
				Direction:    "incoming",
				CreatedAt:    time.Now().Add(-1 * time.Hour),
				UpdatedAt:    time.Now(),
				Completed:    true,
			}
			mockStore.AddMigration(migration1)
			mockStore.AddMigration(migration2)
		})

		Describe("GET /api/v1/migrations", func() {
			It("should return all migrations", func() {
				req := httptest.NewRequest(http.MethodGet, "/api/v1/migrations", nil)
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusOK))

				var result []models.Migration
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(len(result)).To(Equal(2))
			})

			It("should filter by direction", func() {
				req := httptest.NewRequest(http.MethodGet, "/api/v1/migrations?direction=outgoing", nil)
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusOK))

				var result []models.Migration
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(len(result)).To(Equal(1))
				Expect(result[0].Direction).To(Equal("outgoing"))
			})

			It("should return error for invalid direction", func() {
				req := httptest.NewRequest(http.MethodGet, "/api/v1/migrations?direction=invalid", nil)
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusBadRequest))
			})
		})

		Describe("GET /api/v1/migrations/:id", func() {
			It("should return specific migration", func() {
				req := httptest.NewRequest(http.MethodGet, "/api/v1/migrations/migration-1", nil)
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusOK))

				var result models.Migration
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(result.ID).To(Equal("migration-1"))
			})

			It("should return error for non-existent migration", func() {
				req := httptest.NewRequest(http.MethodGet, "/api/v1/migrations/non-existent", nil)
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusNotFound))
			})
		})

		Describe("GET /api/v1/migrations/active", func() {
			It("should return only active migrations", func() {
				req := httptest.NewRequest(http.MethodGet, "/api/v1/migrations/active", nil)
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusOK))

				var result []models.Migration
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(len(result)).To(Equal(1))
				Expect(result[0].Completed).To(BeFalse())
			})
		})

		Describe("GET /api/v1/migrations/datacenter/:dcId", func() {
			It("should return migrations for specific datacenter", func() {
				req := httptest.NewRequest(http.MethodGet, "/api/v1/migrations/datacenter/dc-test-1", nil)
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusOK))

				var result []models.Migration
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(len(result)).To(Equal(1))
				Expect(result[0].DatacenterID).To(Equal("dc-test-1"))
			})
		})

		Describe("GET /api/v1/migrations/vm/:vmName", func() {
			It("should return migrations for specific VM", func() {
				req := httptest.NewRequest(http.MethodGet, "/api/v1/migrations/vm/test-vm-1", nil)
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusOK))

				var result []models.Migration
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(len(result)).To(Equal(1))
				Expect(result[0].VMName).To(Equal("test-vm-1"))
			})
		})

		Describe("GET /api/v1/migrations/direction/:direction", func() {
			It("should return migrations for specific direction", func() {
				req := httptest.NewRequest(http.MethodGet, "/api/v1/migrations/direction/incoming", nil)
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusOK))

				var result []models.Migration
				err = json.NewDecoder(resp.Body).Decode(&result)
				Expect(err).NotTo(HaveOccurred())
				Expect(len(result)).To(Equal(1))
				Expect(result[0].Direction).To(Equal("incoming"))
			})

			It("should return error for invalid direction", func() {
				req := httptest.NewRequest(http.MethodGet, "/api/v1/migrations/direction/invalid", nil)
				resp, err := app.Test(req)
				Expect(err).NotTo(HaveOccurred())
				Expect(resp.StatusCode).To(Equal(http.StatusBadRequest))
			})
		})
	})
})

// setupTestServer configures a test server with the mock store
func setupTestServer(app *fiber.App, mockStore *mocks.MockStore) {
	// We need to inject the mock store into the server package
	// Since the server package uses a global variable, we need to set it
	server.SetDataStoreForTesting(mockStore)

	// Setup the same routes as in the real server
	setupRoutes(app)
}

func setupRoutes(app *fiber.App) {
	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "healthy",
			"service": "backend-api",
		})
	})

	// API routes
	api := app.Group("/api/v1")

	// Use the server package handlers (we'll need to expose them for testing)
	api.Get("/datacenters", server.GetDatacentersHandler)
	api.Get("/status", server.GetStatusHandler)
	api.Post("/migrate", server.MigrateVMHandler)
	api.Get("/migrate", server.AutoMigrateVMHandler)

	// Admin routes
	admin := api.Group("/admin")
	admin.Get("/datacenters", server.GetDatacentersHandler)
	admin.Patch("/datacenters/:id", server.UpdateDatacenterHandler)
	admin.Patch("/datacenters/:dcId/vms/:vmId", server.UpdateVMHandler)
	admin.Post("/datacenters/:dcId/vms", server.AddVMHandler)
	admin.Delete("/datacenters/:dcId/vms/:vmId", server.RemoveVMHandler)

	// Migration tracking endpoints
	api.Get("/migrations", server.GetAllMigrationsHandler)
	api.Get("/migrations/active", server.GetActiveMigrationsHandler)
	api.Get("/migrations/datacenter/:dcId", server.GetMigrationsByDatacenterHandler)
	api.Get("/migrations/vm/:vmName", server.GetMigrationsByVMHandler)
	api.Get("/migrations/direction/:direction", server.GetMigrationsByDirectionHandler)
	api.Get("/migrations/:id", server.GetMigrationHandler)
}
