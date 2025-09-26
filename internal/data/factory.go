package data

import (
	"github.com/cldmnky/summit-connect-stockholm-2025/internal/data/boltdb"
	"github.com/cldmnky/summit-connect-stockholm-2025/internal/models"
)

// NewStore creates a new data store using the default BoltDB implementation
func NewStore(dbPath string, jsonSeedPath string) (models.Store, error) {
	return boltdb.NewStore(dbPath, jsonSeedPath)
}
