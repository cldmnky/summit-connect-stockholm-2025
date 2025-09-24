package watcher

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// DatacenterConfig represents the datacenter configuration from datacenters.yaml
type DatacenterConfig struct {
	Datacenters []DatacenterDefinition `yaml:"datacenters"`
}

// DatacenterDefinition represents a single datacenter configuration
type DatacenterDefinition struct {
	ID          string        `yaml:"id"`
	Name        string        `yaml:"name"`
	Location    string        `yaml:"location"`
	Coordinates []float64     `yaml:"coordinates"`
	Clusters    []ClusterInfo `yaml:"clusters"`
}

// ClusterInfo represents cluster information in YAML
type ClusterInfo struct {
	Name       string `yaml:"name"`
	Kubeconfig string `yaml:"kubeconfig"`
}

// ClusterConfig represents a cluster configuration
type ClusterConfig struct {
	Name         string
	Kubeconfig   string
	DatacenterID string
}

// LoadDatacenterConfig loads the datacenter configuration from the YAML file
func LoadDatacenterConfig(configPath string) (*DatacenterConfig, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file %s: %w", configPath, err)
	}

	var config DatacenterConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &config, nil
}

// GetClusters extracts all cluster configurations from the datacenter config
func (dc *DatacenterConfig) GetClusters() []ClusterConfig {
	var clusters []ClusterConfig

	for _, datacenter := range dc.Datacenters {
		for _, clusterInfo := range datacenter.Clusters {
			clusters = append(clusters, ClusterConfig{
				Name:         clusterInfo.Name,
				Kubeconfig:   clusterInfo.Kubeconfig,
				DatacenterID: datacenter.ID,
			})
		}
	}

	return clusters
}
