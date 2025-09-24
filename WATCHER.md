# VM Watcher

The VM Watcher monitors KubeVirt Virtual Machines across all clusters defined in `config/datacenters.yaml` and automatically updates the database when VMs change.

## Features

- **Multi-cluster monitoring**: Watches VMs across all configured clusters
- **Real-time updates**: Automatically detects VM changes (create, update, delete)
- **Database synchronization**: Updates the internal database automatically
- **Graceful error handling**: Continues running even if some clusters are unavailable
- **Resource extraction**: Extracts CPU, memory, disk, and network information

## Configuration

The watcher reads cluster configurations from `config/datacenters.yaml`. Each datacenter can have multiple clusters, and each cluster requires a kubeconfig file:

```yaml
datacenters:
  - id: dc-sollentuna
    name: "Stockholm Sollentuna DC"
    clusters:
    - vulcan:
      kubeconfig: .kubeconfigs/vulcan.yaml
```

## Usage

### Starting the server with VM watcher

```bash
# Start server with VM watcher enabled
./summit-connect serve backend --watch-vms

# Start on specific port with VM watcher
./summit-connect serve backend -p 8080 --watch-vms

# Short form
./summit-connect serve backend -w
```

### Setting up kubeconfigs

1. Create the kubeconfig directory:
   ```bash
   mkdir -p config/.kubeconfigs
   ```

2. Copy your cluster kubeconfig files:
   ```bash
   cp ~/.kube/config-vulcan config/.kubeconfigs/vulcan.yaml
   cp ~/.kube/config-borg config/.kubeconfigs/borg.yaml
   ```

3. Ensure the kubeconfig files have the correct permissions:
   ```bash
   chmod 600 config/.kubeconfigs/*.yaml
   ```

## Architecture

The VM watcher consists of several components:

### VMWatcher
- Main coordinator that manages multiple cluster watchers
- Reads datacenter configuration
- Creates and manages ClusterWatcher instances

### ClusterWatcher
- Watches a single Kubernetes cluster
- Uses KubeVirt client to monitor VirtualMachine resources
- Converts KubeVirt VMs to internal VM models
- Updates database when changes occur

### Data Flow

1. **Initialization**: Reads `config/datacenters.yaml` and creates cluster watchers
2. **Initial Sync**: Fetches all existing VMs from each cluster
3. **Watch Loop**: Monitors for VM changes using Kubernetes watch API
4. **Event Processing**: Converts KubeVirt events to database updates
5. **Database Updates**: Adds/updates/removes VMs in the internal database

## VM Information Extracted

The watcher extracts the following information from KubeVirt VMs:

- **Basic Info**: Name, namespace, age
- **Resources**: CPU cores, memory (MB), disk size (GB)
- **Status**: Running, stopped, starting, etc.
- **Network**: IP address (when available)
- **Placement**: Node name where VM is running
- **Phase**: Current KubeVirt phase (Running, Pending, etc.)

## Error Handling

The watcher is designed to be resilient:

- **Missing kubeconfigs**: Logs error but continues with other clusters
- **Network issues**: Automatically reconnects when connection is restored
- **Permission errors**: Logs detailed error messages
- **Invalid VM data**: Skips problematic VMs but continues processing others

## Monitoring

The watcher provides detailed logging:

```
2025/09/24 10:29:59 Starting VM watcher for 4 clusters
2025/09/24 10:29:59 Starting watcher for cluster vulcan (datacenter: dc-sollentuna)
2025/09/24 10:29:59 Added new VM test-vm to datacenter dc-sollentuna
2025/09/24 10:29:59 VM event: Modified for VM test-vm in cluster vulcan
```

## API Integration

VMs discovered by the watcher are automatically available through the REST API:

```bash
# Get all datacenters with their VMs
curl http://localhost:3001/api/v1/datacenters

# Get status including VM counts
curl http://localhost:3001/api/v1/status
```

The watcher seamlessly integrates with the existing VM management API, so all existing functionality (migration, status updates, etc.) works with watched VMs.