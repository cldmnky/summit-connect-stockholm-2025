# Bootc Pivot Configuration

This Helm chart supports automatic first-boot pivoting from a base RHEL bootc image to an application-specific image. This enables a clean separation between base OS infrastructure and application-specific configurations.

## Overview

The bootc pivot functionality works as follows:

1. **Deploy Base Image**: The VM starts with a generic base RHEL bootc image (`quay.io/cldmnky/summit-connect-base:latest`)
2. **First Boot Detection**: A systemd service with `ConditionFirstBoot=true` runs only on the first boot
3. **Automatic Pivot**: The service executes `bootc switch --apply <target-image>` to pivot to your application image
4. **Reboot and Run**: The system reboots into the application image and runs your application

## Configuration

### Enable Bootc Pivot

You can enable bootc pivot in several ways:

#### Method 1: Using the Helper Script (Recommended)

```bash
# Enable with default application image
./configure-bootc-pivot.sh --enable

# Enable with custom application image
./configure-bootc-pivot.sh --enable --target-image quay.io/myorg/my-app:latest

# Enable with registry authentication
./configure-bootc-pivot.sh --enable --auth-file ~/.docker/config.json
```

#### Method 2: Manual Configuration in values.yaml

```yaml
bootcPivot:
  enabled: true
  targetImage: "quay.io/cldmnky/summit-connect-app:latest"
  registryAuth:
    createAuthFile: true
    authJson: |
      {
        "auths": {
          "quay.io": {
            "auth": "your-base64-encoded-auth-token"
          }
        }
      }
```

#### Method 3: Helm Command Line Override

```bash
helm upgrade -i summit summit-connect \
  --set bootcPivot.enabled=true \
  --set bootcPivot.targetImage=quay.io/myorg/my-app:latest
```

### Registry Authentication

If your application image is in a private registry, you need to provide authentication:

1. **Get your registry credentials**:
   ```bash
   # For Quay.io
   podman login quay.io
   cat ~/.docker/config.json
   ```

2. **Configure authentication**:
   ```bash
   ./configure-bootc-pivot.sh --enable --auth-file ~/.docker/config.json
   ```

## How It Works

### systemd Service Implementation

The chart creates a systemd one-shot service at `/etc/systemd/system/bootc-pivot.service`:

```ini
[Unit]
Description=Pivot to Derived bootc Image on First Boot
Documentation=man:bootc-switch(1) man:systemd.unit(5)
ConditionFirstBoot=true
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStartPre=/usr/bin/sh -c 'echo "Starting bootc pivot to <target>..." | systemd-cat -p info -t bootc-pivot'
ExecStart=/usr/bin/bootc switch --apply <target-image>
ExecStartPost=/usr/bin/sh -c 'echo "bootc pivot completed successfully" | systemd-cat -p info -t bootc-pivot'

[Install]
WantedBy=multi-user.target
```

### Key Features

- **`ConditionFirstBoot=true`**: Ensures the service runs exactly once, only on systems without `/etc/machine-id`
- **Network Dependencies**: Waits for network connectivity before attempting to pull the image
- **Logging**: Provides clear log messages via systemd journal
- **Atomic Operation**: Uses `bootc switch --apply` for transactional OS updates with automatic reboot

### Cloud-init Integration

The systemd service is delivered via cloud-init, which:

1. Writes the service file to `/etc/systemd/system/bootc-pivot.service`
2. Optionally creates `/etc/ostree/auth.json` for registry authentication
3. Enables the service with `systemctl enable bootc-pivot.service`

## Monitoring and Debugging

### Check VM Status

```bash
# Check VM status
kubectl get vm summit-connect-app -n summit-connect

# Check VM instance (after first boot)
kubectl get vmi summit-connect-app -n summit-connect
```

### View Logs

```bash
# Access VM console
virtctl console summit-connect-app -n summit-connect

# View systemd journal for pivot logs
journalctl -u bootc-pivot.service -f

# View cloud-init logs
journalctl -u cloud-init -f
```

### SSH Access

```bash
# SSH into the VM (after first boot completes)
virtctl ssh rhel@summit-connect-app -n summit-connect
```

## Troubleshooting

### Common Issues

1. **Image Pull Failures**:
   - Check registry authentication in `/etc/ostree/auth.json`
   - Verify network connectivity: `ping quay.io`
   - Check image exists: `bootc switch --check <target-image>`

2. **Service Not Running**:
   - Check if service exists: `systemctl list-unit-files | grep bootc-pivot`
   - Check service status: `systemctl status bootc-pivot.service`
   - View logs: `journalctl -u bootc-pivot.service`

3. **Multiple Execution**:
   - The `ConditionFirstBoot=true` should prevent re-execution
   - Check if `/etc/machine-id` exists (should exist after first boot)
   - Verify cloud-init cache: `ls -la /var/lib/cloud/`

### Manual Pivot

If automatic pivot fails, you can manually pivot:

```bash
# SSH into VM
virtctl ssh rhel@summit-connect-app -n summit-connect

# Check current image
bootc status

# Manually switch (replace with your target image)
sudo bootc switch --apply quay.io/cldmnky/summit-connect-app:latest

# Reboot
sudo reboot
```

## Disabling Bootc Pivot

To disable bootc pivot and use only the base image:

```bash
./configure-bootc-pivot.sh --disable
helm upgrade -i summit summit-connect
```

## Architecture Benefits

This bootc pivot approach provides several advantages:

1. **Clean Separation**: Base OS infrastructure is separate from application concerns
2. **Immutable Updates**: Both base and application layers are atomically updatable
3. **GitOps Ready**: Application images can be updated via GitOps workflows
4. **Rollback Capability**: Both layers support atomic rollbacks
5. **Security**: Minimal base image reduces attack surface
6. **Flexibility**: Teams can iterate on application images independently

## Example Workflow

```bash
# 1. Configure bootc pivot
./configure-bootc-pivot.sh --enable --target-image quay.io/myorg/summit-connect:v1.2.0

# 2. Deploy VM
helm upgrade -i summit summit-connect

# 3. Monitor deployment
kubectl get vm,vmi -n summit-connect
watch kubectl get vm summit-connect-app -n summit-connect

# 4. Access application (after pivot completes)
oc get route summit-summit-connect-app -n summit-connect -o jsonpath='{.spec.host}'
```