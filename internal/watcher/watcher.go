package watcher

import (
	"context"
	"fmt"
	"log"
	"path/filepath"
	"strings"
	"sync"
	"time"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	kubevirtv1 "kubevirt.io/api/core/v1"
	"kubevirt.io/client-go/kubecli"

	"github.com/cldmnky/summit-connect-stockholm-2025/internal/data"
	"github.com/cldmnky/summit-connect-stockholm-2025/internal/models"
)

// VMWatcher manages VM watching across all configured clusters
type VMWatcher struct {
	dataStore *data.DataStore
	clusters  []ClusterConfig
	watchers  map[string]*ClusterWatcher
	mu        sync.RWMutex
	ctx       context.Context
	cancel    context.CancelFunc
}

// ClusterWatcher watches VMs in a specific cluster
type ClusterWatcher struct {
	config         ClusterConfig
	k8sClient      kubernetes.Interface
	kubevirtClient kubecli.KubevirtClient
	dataStore      *data.DataStore
	vmWatcher      watch.Interface
	ctx            context.Context
	cancel         context.CancelFunc
}

// NewVMWatcher creates a new VM watcher
func NewVMWatcher(dataStore *data.DataStore, configPath string) (*VMWatcher, error) {
	// Load datacenter configuration
	dcConfig, err := LoadDatacenterConfig(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load datacenter config: %w", err)
	}

	clusters := dcConfig.GetClusters()
	if len(clusters) == 0 {
		return nil, fmt.Errorf("no clusters found in configuration")
	}

	ctx, cancel := context.WithCancel(context.Background())

	watcher := &VMWatcher{
		dataStore: dataStore,
		clusters:  clusters,
		watchers:  make(map[string]*ClusterWatcher),
		ctx:       ctx,
		cancel:    cancel,
	}

	return watcher, nil
}

// Start begins watching all clusters for VM changes
func (w *VMWatcher) Start() error {
	log.Printf("Starting VM watcher for %d clusters", len(w.clusters))

	w.mu.Lock()
	defer w.mu.Unlock()

	for _, cluster := range w.clusters {
		log.Printf("Starting watcher for cluster %s (datacenter: %s)", cluster.Name, cluster.DatacenterID)

		clusterWatcher, err := w.createClusterWatcher(cluster)
		if err != nil {
			log.Printf("Failed to create watcher for cluster %s: %v", cluster.Name, err)
			continue
		}

		w.watchers[cluster.Name] = clusterWatcher

		// Start watching in goroutine
		go func(cw *ClusterWatcher) {
			if err := cw.start(); err != nil {
				log.Printf("Failed to start watching cluster %s: %v", cw.config.Name, err)
			}
		}(clusterWatcher)
	}

	log.Printf("Started watching %d clusters", len(w.watchers))
	return nil
}

// Stop stops all cluster watchers
func (w *VMWatcher) Stop() {
	log.Printf("Stopping VM watcher")

	w.cancel()

	w.mu.Lock()
	defer w.mu.Unlock()

	for name, watcher := range w.watchers {
		log.Printf("Stopping watcher for cluster %s", name)
		watcher.stop()
	}

	w.watchers = make(map[string]*ClusterWatcher)
	log.Printf("VM watcher stopped")
}

// createClusterWatcher creates a watcher for a specific cluster
func (w *VMWatcher) createClusterWatcher(cluster ClusterConfig) (*ClusterWatcher, error) {
	// Build absolute path for kubeconfig
	var kubeconfigPath string
	if filepath.IsAbs(cluster.Kubeconfig) {
		kubeconfigPath = cluster.Kubeconfig
	} else {
		// Assume relative to config directory
		kubeconfigPath = filepath.Join("config", cluster.Kubeconfig)
	}

	// Create Kubernetes client
	config, err := clientcmd.BuildConfigFromFlags("", kubeconfigPath)
	if err != nil {
		return nil, fmt.Errorf("failed to build config from kubeconfig %s: %w", kubeconfigPath, err)
	}

	k8sClient, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubernetes client: %w", err)
	}

	// Create KubeVirt client
	kubevirtClient, err := kubecli.GetKubevirtClientFromRESTConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kubevirt client: %w", err)
	}

	ctx, cancel := context.WithCancel(w.ctx)

	return &ClusterWatcher{
		config:         cluster,
		k8sClient:      k8sClient,
		kubevirtClient: kubevirtClient,
		dataStore:      w.dataStore,
		ctx:            ctx,
		cancel:         cancel,
	}, nil
}

// start begins watching VMs in the cluster
func (cw *ClusterWatcher) start() error {
	log.Printf("Starting VM watcher for cluster %s", cw.config.Name)

	// Initial sync - get all existing VMs
	if err := cw.syncExistingVMs(); err != nil {
		log.Printf("Failed to sync existing VMs for cluster %s: %v", cw.config.Name, err)
	}

	// Start watching for changes
	return cw.watchVMs()
}

// stop stops the cluster watcher
func (cw *ClusterWatcher) stop() {
	cw.cancel()
	if cw.vmWatcher != nil {
		cw.vmWatcher.Stop()
	}
}

// syncExistingVMs fetches all existing VMs and updates the database
func (cw *ClusterWatcher) syncExistingVMs() error {
	log.Printf("Syncing existing VMs for cluster %s", cw.config.Name)

	vms, err := cw.kubevirtClient.VirtualMachine("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list VMs: %w", err)
	}

	log.Printf("Found %d VMs in cluster %s", len(vms.Items), cw.config.Name)

	for _, vm := range vms.Items {
		modelVM := cw.convertToModelVM(&vm)
		if err := cw.updateVMInDatabase(modelVM); err != nil {
			log.Printf("Failed to update VM %s in database: %v", vm.Name, err)
		}
	}

	return nil
}

// watchVMs sets up a watch for VM changes
func (cw *ClusterWatcher) watchVMs() error {
	log.Printf("Starting VM watch for cluster %s", cw.config.Name)

	for {
		select {
		case <-cw.ctx.Done():
			log.Printf("VM watcher for cluster %s stopped", cw.config.Name)
			return nil
		default:
		}

		// Create a watcher for VirtualMachine resources
		watcher, err := cw.kubevirtClient.VirtualMachine("").Watch(context.TODO(), metav1.ListOptions{})
		if err != nil {
			log.Printf("Failed to create VM watcher for cluster %s: %v", cw.config.Name, err)
			time.Sleep(30 * time.Second)
			continue
		}

		cw.vmWatcher = watcher

		// Process events in a loop
	eventLoop:
		for {
			select {
			case <-cw.ctx.Done():
				log.Printf("VM watcher for cluster %s stopped", cw.config.Name)
				watcher.Stop()
				return nil
			case event, ok := <-watcher.ResultChan():
				if !ok {
					log.Printf("VM watcher channel closed for cluster %s, restarting...", cw.config.Name)
					watcher.Stop()
					time.Sleep(5 * time.Second)
					break eventLoop
				}

				if err := cw.handleVMEvent(event); err != nil {
					log.Printf("Failed to handle VM event for cluster %s: %v", cw.config.Name, err)
				}
			}
		}
	}
}

// handleVMEvent processes a VM watch event
func (cw *ClusterWatcher) handleVMEvent(event watch.Event) error {
	vm, ok := event.Object.(*kubevirtv1.VirtualMachine)
	if !ok {
		return fmt.Errorf("unexpected object type: %T", event.Object)
	}

	log.Printf("VM event: %s for VM %s in cluster %s", event.Type, vm.Name, cw.config.Name)

	switch event.Type {
	case watch.Added, watch.Modified:
		modelVM := cw.convertToModelVM(vm)
		return cw.updateVMInDatabase(modelVM)
	case watch.Deleted:
		return cw.removeVMFromDatabase(vm.Name)
	default:
		log.Printf("Unknown event type: %s", event.Type)
	}

	return nil
}

// convertToModelVM converts a KubeVirt VM to our internal VM model
func (cw *ClusterWatcher) convertToModelVM(vm *kubevirtv1.VirtualMachine) *models.VM {
	modelVM := &models.VM{
		ID:        vm.Name,
		Name:      vm.Name,
		Cluster:   cw.config.Name, // Add cluster information
		Namespace: vm.Namespace,
		Age:       cw.formatAge(vm.CreationTimestamp.Time),
	}

	// Extract resource requirements
	if vm.Spec.Template != nil && vm.Spec.Template.Spec.Domain.Resources.Requests != nil {
		requests := vm.Spec.Template.Spec.Domain.Resources.Requests

		// CPU
		if cpu := requests[v1.ResourceCPU]; !cpu.IsZero() {
			if cpuVal, ok := cpu.AsInt64(); ok {
				modelVM.CPU = int(cpuVal)
			} else {
				// Handle CPU in millicores
				if cpuMilliVal := cpu.MilliValue(); cpuMilliVal > 0 {
					modelVM.CPU = int(cpuMilliVal / 1000)
					if modelVM.CPU == 0 {
						modelVM.CPU = 1 // Minimum 1 CPU
					}
				}
			}
		}

		// Memory (convert from bytes to MB)
		if memory := requests[v1.ResourceMemory]; !memory.IsZero() {
			if memoryVal, ok := memory.AsInt64(); ok {
				modelVM.Memory = int(memoryVal / (1024 * 1024))
			}
		}
	}

	// Get VM status
	modelVM.Status = "unknown"
	modelVM.Phase = "Unknown"
	modelVM.Ready = false

	// VirtualMachineStatus is not a pointer, so we can directly access it
	// Determine status based on VM conditions and print state
	if vm.Status.PrintableStatus != "" {
		switch vm.Status.PrintableStatus {
		case kubevirtv1.VirtualMachineStatusStopped:
			modelVM.Status = "stopped"
			modelVM.Phase = "Stopped"
		case kubevirtv1.VirtualMachineStatusStarting:
			modelVM.Status = "starting"
			modelVM.Phase = "Starting"
		case kubevirtv1.VirtualMachineStatusRunning:
			modelVM.Status = "running"
			modelVM.Phase = "Running"
			modelVM.Ready = true
		default:
			modelVM.Status = strings.ToLower(string(vm.Status.PrintableStatus))
			modelVM.Phase = string(vm.Status.PrintableStatus)
		}
	}

	// Try to get VM instance for more detailed info
	if modelVM.Status == "running" {
		cw.enrichVMWithInstanceInfo(modelVM)
	}

	// Extract disk size (simplified - just get first disk)
	if vm.Spec.Template != nil {
		for _, volume := range vm.Spec.Template.Spec.Volumes {
			if volume.DataVolume != nil {
				// Try to get disk size from storage request
				modelVM.Disk = 100 // Default, could be enhanced to actually read PVC size
				break
			} else if volume.PersistentVolumeClaim != nil {
				modelVM.Disk = 100 // Default for PVC
				break
			}
		}
	}

	// Default disk size if not set
	if modelVM.Disk == 0 {
		modelVM.Disk = 20
	}

	return modelVM
}

// enrichVMWithInstanceInfo adds additional information from the VMI
func (cw *ClusterWatcher) enrichVMWithInstanceInfo(modelVM *models.VM) {
	// Get VMI for additional info
	vmi, err := cw.kubevirtClient.VirtualMachineInstance(modelVM.Namespace).Get(context.TODO(), modelVM.Name, metav1.GetOptions{})
	if err != nil {
		log.Printf("Failed to get VMI for VM %s: %v", modelVM.Name, err)
		return
	}

	// Node name
	if vmi.Status.NodeName != "" {
		modelVM.NodeName = vmi.Status.NodeName
	}

	// IP addresses
	if len(vmi.Status.Interfaces) > 0 {
		for _, iface := range vmi.Status.Interfaces {
			if iface.IP != "" {
				modelVM.IP = iface.IP
				break
			}
		}
	}

	// Phase from VMI
	if vmi.Status.Phase != "" {
		modelVM.Phase = string(vmi.Status.Phase)
		modelVM.Ready = vmi.Status.Phase == kubevirtv1.Running
	}
}

// formatAge formats the age of the VM
func (cw *ClusterWatcher) formatAge(t time.Time) string {
	age := time.Since(t)
	if age < time.Hour {
		return fmt.Sprintf("%dm", int(age.Minutes()))
	} else if age < 24*time.Hour {
		return fmt.Sprintf("%dh", int(age.Hours()))
	} else {
		return fmt.Sprintf("%dd", int(age.Hours()/24))
	}
}

// updateVMInDatabase updates or creates a VM in the database
func (cw *ClusterWatcher) updateVMInDatabase(vm *models.VM) error {
	// First try to update existing VM
	_, err := cw.dataStore.UpdateVM(cw.config.DatacenterID, vm.ID, &vm.Name, &vm.Status, &vm.CPU, &vm.Memory, &vm.Disk, &vm.Cluster)
	if err != nil {
		// VM doesn't exist, try to add it
		_, err = cw.dataStore.AddVM(cw.config.DatacenterID, *vm)
		if err != nil {
			return fmt.Errorf("failed to add VM to database: %w", err)
		}
		log.Printf("Added new VM %s to datacenter %s", vm.Name, cw.config.DatacenterID)
	} else {
		log.Printf("Updated VM %s in datacenter %s", vm.Name, cw.config.DatacenterID)
	}

	return nil
}

// removeVMFromDatabase removes a VM from the database
func (cw *ClusterWatcher) removeVMFromDatabase(vmName string) error {
	err := cw.dataStore.RemoveVM(cw.config.DatacenterID, vmName)
	if err != nil {
		return fmt.Errorf("failed to remove VM from database: %w", err)
	}

	log.Printf("Removed VM %s from datacenter %s", vmName, cw.config.DatacenterID)
	return nil
}
