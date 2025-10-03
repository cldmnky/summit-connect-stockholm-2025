# Summit Connect Helm Chart

This Helm chart deploys a KubeVirt Virtual Machine for the Summit Connect application.

## Features

- **KubeVirt Virtual Machine**: Deploys a RHEL 9 VM with custom ```

## DataImportCron Configuration

The chart can optionally create a DataImportCron for automatic VM image updates:

```yaml
dataImportCron:
  enabled: true
  schedule: "0 0 * * 2"  # Weekly on Tuesday at midnight
  garbageCollect: Outdated
  importsToKeep: 3
```

If you already have a DataImportCron managing the `summit-connect-base` DataSource, keep `dataImportCron.enabled: false` (default).

## Uninstall

```bash
helm uninstall summit-connect
```

**Note:** This will not automatically remove the DataVolumes. You may need to clean them up manually if desired.ration
- **Dynamic MAC Address Generation**: Ensures unique MAC addresses per deployment  
- **Conditional Secrets**: Manages SSH keys and application configuration externally
- **Service and Route**: Enables external access to VM application
- **Configurable Networking**: Supports multiple network interfaces
- **DataImportCron Integration**: Automated VM image updates with CDI

## Prerequisites

- Kubernetes cluster with KubeVirt installed
- Multus CNI for network attachment
- CDI (Containerized Data Importer) for data volumes
- A storage class that supports dynamic provisioning

## Required Secrets

Before installing the chart, you need to create the required secrets in the target namespace. The chart expects these secrets to be created externally with actual configuration data:

### 1. SSH Access Secret

```bash
# Create SSH key secret with your public key
oc create secret generic ssh-key --from-file=key=~/.ssh/id_rsa.pub -n summit-connect-demo
```

### 2. Application Configuration Secret

```bash
# Create config secret from your datacenters configuration
oc create secret generic summit-connect-app-config --from-file config/datacenters.yaml -n summit-connect-demo
```

### 3. Kubeconfigs Secret

```bash
# Create kubeconfigs secret from your kubeconfig files
oc create secret generic summit-connect-kubeconfigs --from-file .kubeconfigs -n summit-connect-demo
```

### Automated Secret Creation

For convenience, you can use the provided script to create all secrets at once:

```bash
# Make script executable (if not already)
chmod +x ../create-secrets.sh

# Create all secrets (customize paths as needed)
../create-secrets.sh summit-connect-demo config/datacenters.yaml .kubeconfigs ~/.ssh/id_rsa.pub
```

**Note:** If you want the chart to create placeholder secrets for testing purposes, you can enable them in values.yaml:

```yaml
sshAccess:
  createSecret: true
secrets:
  createConfigSecret: true
  createKubeconfigsSecret: true
```

## Installation

```bash
helm install summit-connect ./summit-connect
```

## Configuration

The following table lists the configurable parameters and their default values:

| Parameter | Description | Default |
|-----------|-------------|---------|
| Parameter | Description | Default |
|-----------|-------------|---------|
| `vm.enabled` | Enable VM deployment | `true` |
| `vm.name` | VM name | `summit-connect-app` |
| `vm.namespace` | VM namespace | `summit-connect-demo` |
| `vm.runStrategy` | VM run strategy | `Always` |
| `dataVolumeTemplate.generateName` | Data volume name prefix | `summit-connect-app-volume-` |
| `dataVolumeTemplate.sourceRef.kind` | Source reference kind | `DataSource` |
| `dataVolumeTemplate.sourceRef.name` | Source reference name | `summit-connect-base` |
| `dataVolumeTemplate.storage.resources.requests.storage` | Storage size | `30Gi` |
| `dataVolumeTemplate.storage.storageClassName` | Storage class | `lvms-vg1` |
| `instanceType.name` | Instance type | `u1.2xmedium` |
| `preference.name` | VM preference | `rhel.10` |
| `network.macAddress` | MAC address (auto-generated if empty) | `""` |
| `network.multusNetworkName` | Multus network | `default/vlan201` |
| `sshAccess.secretName` | SSH key secret | `ssh-key` |
| `sshAccess.createSecret` | Create SSH secret (recommended: false) | `false` |
| `cloudInit.password` | Default password | `sadg-sd7f-jumv` |
| `cloudInit.runcmd` | Cloud-init run commands | `[]` |
| `secrets.configSecretName` | Config secret name | `summit-connect-app-config` |
| `secrets.createConfigSecret` | Create config secret (recommended: false) | `false` |
| `secrets.kubeconfigsSecretName` | Kubeconfigs secret name | `summit-connect-kubeconfigs` |
| `secrets.createKubeconfigsSecret` | Create kubeconfigs secret (recommended: false) | `false` |
| `service.name` | Service name | `""` |
| `service.port` | Application port | `3001` |
| `service.createRegularService` | Create ClusterIP service for ingress/routes | `true` |
| `route.enabled` | Enable OpenShift Route | `true` |
| `route.host` | Route hostname (auto-generated if empty) | `""` |
| `route.tls.enabled` | Enable TLS for route | `true` |
| `route.tls.termination` | TLS termination type | `edge` |
| `nameOverride` | Override chart name | `""` |
| `fullnameOverride` | Override full name | `""` |

## Custom Values Example

```yaml
vm:
  name: my-summit-connect
  namespace: my-namespace
  
dataVolumeTemplate:
  storage:
    resources:
      requests:
        storage: 50Gi
    storageClassName: my-storage-class

network:
  # macAddress will be auto-generated if not specified
  # macAddress: "02:e6:bd:00:00:06"  # Optional: specify custom MAC
  multusNetworkName: my-network/vlan202

service:
  port: 3001
  createRegularService: true

route:
  enabled: true
  host: summit-connect.apps.my-cluster.example.com
  tls:
    enabled: true
    termination: edge

cloudInit:
  password: my-secure-password
  runcmd:
    - "subscription-manager register --org=YOUR_ORG_ID --activationkey=YOUR_ACTIVATION_KEY"
```

## Usage

After installation, you can:

1. Check VM status:

   ```bash
   kubectl get vm -n summit-connect-demo
   ```

2. Access VM console:

   ```bash
   virtctl console summit-connect-app -n summit-connect-demo
   ```

3. SSH into the VM:

   ```bash
   virtctl ssh rhel@summit-connect-app -n summit-connect-demo
   ```

4. Test the deployment:

   ```bash
   helm test summit-connect
   ```

5. Access the application via OpenShift Route:

   ```bash
   # Get the route URL
   oc get route summit-connect-app -n summit-connect-demo -o jsonpath='{.spec.host}'
   
   # Access the application
   curl https://$(oc get route summit-connect-app -n summit-connect-demo -o jsonpath='{.spec.host}')
   ```

## Important Notes

- **External Secrets**: By default, the chart expects secrets to be created externally with actual configuration data. See the "Required Secrets" section above for commands to create them.
- **Registration Commands**: The `cloudInit.runcmd` is empty by default. Configure it with your organization ID and activation key for RHEL subscription registration.
- **MAC Address Generation**: If no MAC address is specified in `network.macAddress`, a unique MAC address will be automatically generated based on the release name and namespace. This ensures no conflicts between deployments while maintaining deterministic addresses for the same deployment.
- Ensure the DataSource `summit-connect-base` exists in your cluster or update the source reference
- The VM requires proper network configuration to work with the specified Multus network

## Uninstallation

```bash
helm uninstall summit-connect
```

Note: This will not automatically remove the DataVolumes. You may need to clean them up manually if desired.