package cmd

import (
	"log"
	"os"

	"github.com/cldmnky/summit-connect-stockholm-2025/internal/server"
	"github.com/spf13/cobra"
)

var serveCmd = &cobra.Command{
	Use:   "serve [backend]",
	Short: "Start the backend server",
	Long: `Start the backend API server which serves both the REST API and static frontend files.

The backend server serves:
- REST API endpoints at /api/v1/*
- Static frontend files at /*
- Health check at /health

Examples:
  summit-connect serve backend           # Start backend server on port 3001
  summit-connect serve backend -p 8080   # Start backend server on port 8080`,
	Args:      cobra.ExactArgs(1),
	ValidArgs: []string{"backend"},
	Run: func(cmd *cobra.Command, args []string) {
		serverType := args[0]

		port, _ := cmd.Flags().GetInt("port")

		switch serverType {
		case "backend":
			if port == 0 {
				port = 3001
			}
			// set DB path from flag
			dbPath, _ := cmd.Flags().GetString("db")
			if dbPath != "" {
				os.Setenv("SUMMIT_DB", dbPath)
			}
			log.Printf("Starting backend API server on port %d", port)
			// initialize datastore explicitly with the provided dbPath and optional seed path
			seedPath := "frontend/datacenters.json"
			if err := server.InitDataStore(dbPath, seedPath); err != nil {
				log.Fatalf("failed to init datastore: %v", err)
			}
			server.StartBackendServer(port)
		default:
			cmd.Help()
		}
	},
}

func init() {
	rootCmd.AddCommand(serveCmd)
	serveCmd.Flags().IntP("port", "p", 0, "Port to serve on (default: 3001)")
	serveCmd.Flags().StringP("db", "d", "/tmp/summit-connect.db", "Path to BoltDB file to use for persistence")
}
