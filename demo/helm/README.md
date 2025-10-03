# Summit Connect Helm Repository

This repository provides a Helm chart for deploying Summit Connect VM applications with KubeVirt and bootc pivot support.

## 🚀 Quick Start

### Add the Helm Repository

```bash
helm repo add summit-connect https://cldmnky.github.io/summit-connect-stockholm-2025/
helm repo update
```

### Search for Available Charts

```bash
helm search repo summit-connect
```

### Install the Chart

```bash
# Basic installation
helm install my-summit-connect summit-connect/summit-connect

# Installation with custom namespace
helm install my-summit-connect summit-connect/summit-connect --namespace my-namespace --create-namespace

# Installation with bootc pivot enabled
helm install my-summit-connect summit-connect/summit-connect --set bootcPivot.enabled=true
```

## 🔧 Configuration Options

The chart supports various configuration options including:

- **bootc Pivot Support**: Automatically switch from base to application image on first boot
- **KubeVirt VM Configuration**: Customize CPU, memory, and storage
- **Network Configuration**: Configure VM network settings
- **SSH Access**: Set up SSH keys for VM access

### Key Values

```yaml
bootcPivot:
  enabled: true  # Enable bootc pivot from base to app image
  targetImage: "quay.io/cldmnky/summit-connect-app:latest"

vm:
  resources:
    cpu: "2"
    memory: "4Gi"
  
ssh:
  authorizedKeys: []  # Add your SSH public keys here
```

## 📖 Documentation

For detailed configuration options and examples, see:

- [Chart Values](./summit-connect/values.yaml)
- [Bootc Pivot Guide](./BOOTC-PIVOT.md)

## 🔄 Automated Releases

This repository uses GitHub Actions to automatically:

1. Package Helm charts when changes are detected
2. Create GitHub releases with chart artifacts
3. Update the Helm repository index on GitHub Pages
4. Serve the repository at <https://cldmnky.github.io/summit-connect-stockholm-2025/>

## 🛠️ Development

To work with the chart locally:

```bash
# Validate the chart
helm lint demo/helm/summit-connect/

# Test rendering
helm template demo/helm/summit-connect/

# Test installation (dry-run)
helm install test-release demo/helm/summit-connect/ --dry-run
```

## 📋 Features

- ✅ KubeVirt VirtualMachine deployment
- ✅ Bootc pivot automation (base → app image)  
- ✅ Cloud-init configuration with systemd services
- ✅ Automated SSH key setup
- ✅ Persistent storage configuration
- ✅ Network policy templates
- ✅ RBAC configuration
- ✅ Automated Helm repository via GitHub Pages

## 📝 Version History

- **v0.1.2**: Added bootc pivot support with cloud-init automation
- **v0.1.1**: Initial release with basic KubeVirt VM deployment
