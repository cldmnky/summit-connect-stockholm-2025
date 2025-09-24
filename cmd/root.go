package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "summit-connect",
	Short: "Summit Connect Stockholm 2025 - Datacenter Management Application",
	Long: `A datacenter management application that shows Stockholm County with 
two fictive datacenters and running VMs. Supports VM migration simulation 
and provides both frontend and backend services.`,
}

func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error executing command: %v\n", err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}
