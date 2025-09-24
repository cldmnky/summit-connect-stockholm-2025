package cmd

import (
	"log"
	"os"

	"github.com/spf13/cobra"

	"github.com/cldmnky/summit-connect-stockholm-2025/internal/server"
)

var serveCmd = &cobra.Command{
	Use:   "serve [backend]",
	Short: "Start the backend server",
	Long: `Start the backend API server which serves both the REST API and static frontend files.

The backend server serves:
- REST API endpoints at /api/v1/*
- Static frontend files at /*
- Health check at /health

VM Watcher:
When enabled with --watch-vms, the server will monitor KubeVirt VMs across all clusters
defined in config/datacenters.yaml and automatically update the database when VMs change.

Examples:
  summit-connect serve backend                    # Start backend server on port 3001
  summit-connect serve backend -p 8080            # Start backend server on port 8080
  summit-connect serve backend --watch-vms        # Start with VM watcher enabled
  summit-connect serve backend -w -p 8080         # Start on port 8080 with VM watcher`,
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
			// config path (optional) for viper seeding
			configPath, _ := cmd.Flags().GetString("config")
			// VM watcher flag
			watchVMs, _ := cmd.Flags().GetBool("watch-vms")

			if dbPath != "" {
				os.Setenv("SUMMIT_DB", dbPath)
			}
			log.Printf("Starting backend API server on port %d", port)
			// initialize datastore explicitly with the provided dbPath and optional seed path
			// If a config path was provided use that (Viper will handle it). Otherwise leave seedPath empty
			// so the DataStore will try viper's default lookup locations (including ./config)
			seedPath := ""
			if configPath != "" {
				seedPath = configPath
			}
			if err := server.InitDataStore(dbPath, seedPath); err != nil {
				log.Fatalf("failed to init datastore: %v", err)
			}

			// Initialize VM watcher if enabled
			if watchVMs {
				datacenterConfigPath := "config/datacenters.yaml"
				if err := server.InitVMWatcher(datacenterConfigPath); err != nil {
					log.Fatalf("failed to init VM watcher: %v", err)
				}
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
	serveCmd.Flags().StringP("config", "c", "", "Optional config file (yaml/json/env) used to seed the DB via viper")
	serveCmd.Flags().BoolP("watch-vms", "w", false, "Enable VM watcher to monitor KubeVirt VMs across clusters")
}
