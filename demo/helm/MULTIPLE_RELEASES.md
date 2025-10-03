# Multiple Release Deployments

This guide demonstrates how to deploy multiple instances of the Summit Connect Helm chart in the same namespace using different release names.

## Overview

As of version 0.2.0, the Summit Connect Helm chart fully supports multiple releases in the same namespace. Each release creates uniquely named resources based on the release name, allowing you to run multiple VM instances side by side.

## How It Works

The chart uses the Helm release name to generate unique resource names:

- **VirtualMachine**: `{release-name}-summit-connect`
- **DataVolume**: `{release-name}-summit-connect-volume`
- **Services**: `{release-name}-summit-connect-app` and `{release-name}-summit-connect-headless`
- **Route**: `{release-name}-summit-connect-app`

## Example: Multiple Environments

Deploy development, staging, and production VMs in the same namespace:

### Development Environment

```bash
helm install dev summit-connect/summit-connect \
  --namespace summit-connect \
  --set bootcPivot.enabled=true \
  --set vm.runStrategy=Always
```

This creates:
- VM: `dev-summit-connect`
- Route: `dev-summit-connect-app`
- Services: `dev-summit-connect-app`, `dev-summit-connect-headless`

### Staging Environment

```bash
helm install staging summit-connect/summit-connect \
  --namespace summit-connect \
  --set bootcPivot.enabled=true \
  --set vm.runStrategy=Always
```

This creates:
- VM: `staging-summit-connect`
- Route: `staging-summit-connect-app`
- Services: `staging-summit-connect-app`, `staging-summit-connect-headless`

### Production Environment

```bash
helm install prod summit-connect/summit-connect \
  --namespace summit-connect \
  --set bootcPivot.enabled=true \
  --set vm.runStrategy=Always \
  --set instanceType.name=u1.xlarge
```

This creates:
- VM: `prod-summit-connect`
- Route: `prod-summit-connect-app`
- Services: `prod-summit-connect-app`, `prod-summit-connect-headless`

## Verification

### List All Releases

```bash
helm list --namespace summit-connect
```

Expected output:
```
NAME     NAMESPACE        REVISION  STATUS    CHART              
dev      summit-connect   1         deployed  summit-connect-0.2.0
staging  summit-connect   1         deployed  summit-connect-0.2.0
prod     summit-connect   1         deployed  summit-connect-0.2.0
```

### List All VMs

```bash
oc get vm -n summit-connect
```

Expected output:
```
NAME                  AGE   STATUS    READY
dev-summit-connect    5m    Running   True
staging-summit-connect 4m   Running   True
prod-summit-connect   3m    Running   True
```

### List All Routes

```bash
oc get routes -n summit-connect
```

Expected output:
```
NAME                         HOST                               
dev-summit-connect-app       dev-summit-connect-app-summit-...
staging-summit-connect-app   staging-summit-connect-app-summ...
prod-summit-connect-app      prod-summit-connect-app-summit-...
```

## Custom VM Names

If you need a completely custom VM name (not based on the release name), you can override it:

```bash
helm install my-release summit-connect/summit-connect \
  --namespace summit-connect \
  --set vm.name=my-custom-vm-name
```

**Warning**: When using custom names, you are responsible for ensuring uniqueness across all releases.

## Managing Multiple Releases

### Upgrade a Specific Release

```bash
helm upgrade dev summit-connect/summit-connect \
  --namespace summit-connect \
  --set instanceType.name=u1.large
```

### Delete a Specific Release

```bash
helm uninstall dev --namespace summit-connect
```

This will delete all resources associated with the `dev` release, including the VM, services, and route.

### View Release-Specific Resources

```bash
# List all resources with labels matching the release
kubectl get all -n summit-connect -l app.kubernetes.io/instance=dev
```

## Testing Before Deployment

Use `helm template` to preview what resources will be created:

```bash
helm template my-test summit-connect/summit-connect \
  --set vm.enabled=true \
  --set route.enabled=true \
  | grep "^  name:" | sort | uniq
```

## Resource Naming Pattern

All resources follow this naming convention:

| Resource Type | Name Pattern |
|--------------|-------------|
| VirtualMachine | `{release}-summit-connect` |
| DataVolume | `{release}-summit-connect-volume` |
| Service (App) | `{release}-summit-connect-app` |
| Service (Headless) | `{release}-summit-connect-headless` |
| Route | `{release}-summit-connect-app` |
| ServiceAccount (Test) | `{release}-summit-connect-test` |

## Best Practices

1. **Use Meaningful Release Names**: Choose release names that clearly identify the purpose (e.g., `dev`, `staging`, `prod`, `feature-branch-name`)

2. **Consistent Configuration**: Use values files to maintain consistent configuration across releases:
   ```bash
   helm install prod summit-connect/summit-connect -f production-values.yaml
   ```

3. **Resource Limits**: Consider setting appropriate resource limits for each environment:
   ```bash
   # Development with smaller resources
   helm install dev summit-connect/summit-connect \
     --set instanceType.name=u1.small
   
   # Production with larger resources
   helm install prod summit-connect/summit-connect \
     --set instanceType.name=u1.xlarge
   ```

4. **Label Strategy**: Use additional labels to organize releases:
   ```bash
   helm install dev summit-connect/summit-connect \
     --set-string labels.environment=development \
     --set-string labels.team=platform
   ```

## Troubleshooting

### Resource Already Exists Error

If you get an error about resources already existing:

1. Check for existing releases:
   ```bash
   helm list --all-namespaces
   ```

2. Check for orphaned resources:
   ```bash
   kubectl get vm,svc,route -n summit-connect
   ```

3. Clean up orphaned resources if needed:
   ```bash
   kubectl delete vm <vm-name> -n summit-connect
   ```

### MAC Address Conflicts

Each release automatically gets a unique MAC address based on the release name and namespace. If you need to specify a custom MAC address:

```bash
helm install my-release summit-connect/summit-connect \
  --set network.macAddress="02:00:00:12:34:56"
```

## Migration from Old Versions

If you have charts deployed with versions < 0.2.0 where `vm.name` was hardcoded:

1. **Uninstall the old release**:
   ```bash
   helm uninstall old-release -n summit-connect
   ```

2. **Reinstall with the new version**:
   ```bash
   helm install new-release summit-connect/summit-connect -n summit-connect
   ```

The VM name will now be `new-release-summit-connect` instead of `summit-connect-app`.

## Examples with Different Configurations

### Minimal Development VM

```bash
helm install dev summit-connect/summit-connect \
  --namespace summit-connect \
  --set instanceType.name=u1.micro \
  --set dataVolumeTemplate.storage.resources.requests.storage=10Gi
```

### Production VM with Custom Image

```bash
helm install prod summit-connect/summit-connect \
  --namespace summit-connect \
  --set bootcPivot.targetImage=quay.io/myorg/custom-app:v2.0 \
  --set instanceType.name=u1.2xlarge \
  --set dataVolumeTemplate.storage.resources.requests.storage=50Gi
```

### Testing VM (No Route)

```bash
helm install test summit-connect/summit-connect \
  --namespace summit-connect \
  --set route.enabled=false \
  --set vm.runStrategy=Manual
```

## Additional Resources

- [Helm Chart Documentation](README.md)
- [Main Project README](../../README.md)
- [OpenShift Helm Repository Setup](../manifests/README.md)
