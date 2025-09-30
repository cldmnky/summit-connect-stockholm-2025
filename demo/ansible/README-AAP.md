# Ansible Automation Platform (AAP) 2.5 Setup Guide for KubeVirt VM Management

This guide provides a comprehensive walkthrough for deploying Ansible Automation Platform 2.5 on OpenShift and configuring it to manage KubeVirt/OpenShift Virtualization VMs using the Resource Operator Custom Resources (CRs).

## Overview

Ansible Automation Platform 2.5 introduces enhanced operator-based deployment capabilities and native Resource Operator support for managing automation resources as Kubernetes Custom Resources. This setup enables infrastructure-as-code management of VMs through AAP.

## What's Included

- **AAP 2.5 Operator Deployment** - Full platform installation
- **Resource Operator CRs** - Automation resources defined as Kubernetes manifests
- **KubeVirt Integration** - Dynamic inventory plugin for VM discovery
- **Bootc VM Management** - Automated VM image switching capabilities
- **Security Best Practices** - SSH key authentication and secret management

### Manifest Files
- `00-aap-connection-secret.yaml` - AAP API access token
- `01-aap-credential.yaml` - SSH-based machine credentials
- `02-aap-project.yaml` - Git-backed project configuration
- `03-aap-inventory.yaml` - KubeVirt dynamic inventory source
- `04-aap-jobtemplate.yaml` - Bootc switch job template
- `05-aap-job.yaml` - AnsibleJob to execute bootc operations
- `06-aap-kubevirt-credential.yaml` - Custom credential for cluster access
- `inventory.kubevirt.yml` - KubeVirt inventory plugin configuration
- `playbooks/bootc-switch.yml` - Bootc image switching playbook
- `requirements.yml` - Required Ansible collections

## Prerequisites

- OpenShift Container Platform 4.14+
- Cluster administrator privileges
- OpenShift Virtualization operator installed
- Git repository access for project sources
- SSH key pair for VM access

## Step 1: Deploy AAP 2.5 Operator

### 1.1 Create the Operator Subscription

Create a subscription file (`aap-subscription.yaml`):

```yaml
---
apiVersion: v1
kind: Namespace
metadata:
  labels:
    openshift.io/cluster-monitoring: "true"
  name: ansible-automation-platform
---
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: ansible-automation-platform-operator
  namespace: ansible-automation-platform
spec:
  targetNamespaces:
    - ansible-automation-platform
---
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: ansible-automation-platform
  namespace: ansible-automation-platform
spec:
  channel: 'stable-2.5'
  installPlanApproval: Automatic
  name: ansible-automation-platform-operator
  source: redhat-operators
  sourceNamespace: openshift-marketplace
```

Apply the subscription:

```bash
oc apply -f aap-subscription.yaml
```

### 1.2 Verify Operator Installation

Monitor the installation progress:

```bash
# Check operator status
oc get csv -n ansible-automation-platform

# Wait for PHASE: Succeeded
# Expected output:
# NAME                               DISPLAY                       VERSION              PHASE
# aap-operator.v2.5.0-0.1728520175   Ansible Automation Platform   2.5.0+0.1728520175   Succeeded
```

### 1.3 Deploy AAP Platform Instance

Create the platform deployment (`aap-platform.yaml`):

```yaml
---
apiVersion: aap.ansible.com/v1alpha1
kind: AnsibleAutomationPlatform
metadata:
  name: aap
  namespace: ansible-automation-platform
spec:
  # Enable development features for detailed logging
  no_log: false
  
  controller:
    disabled: false
    # Configure resource requirements based on your environment
    web:
      replicas: 1
    task:
      replicas: 1
  
  gateway:
    disabled: false
    replicas: 1
  
  hub:
    disabled: false
    storage:
      size: 100Gi
  
  eda:
    disabled: false
```

Deploy the platform:

```bash
oc apply -f aap-platform.yaml
```

### 1.4 Get Platform Access Information

Retrieve the gateway route and admin credentials:

```bash
# Get the platform route
oc get routes -n ansible-automation-platform

# Get admin password
oc get secret aap-admin-password -n ansible-automation-platform -o jsonpath="{.data.password}" | base64 --decode
```

## Step 2: Configure Authentication Secrets

### 2.1 Create SSH Key Secret

Generate and store SSH credentials for VM access:

```bash
# Generate SSH key pair (if not existing)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/aap-vm-key -N ""

# Create the SSH private key secret
oc create secret generic aap-ssh-key \
  --from-file=ssh-privatekey=$HOME/.ssh/aap-vm-key \
  -n ansible-automation-platform
```

### 2.2 Create Cluster Access Secret

Create credentials for accessing the OpenShift cluster:

```bash
# Get current cluster API URL and token
API_URL=$(oc whoami --show-server)
TOKEN=$(oc whoami -t)

# Create cluster access secret
oc create secret generic aap-oc-token \
  --from-literal=oc_token="$TOKEN" \
  --from-literal=oc_api_url="$API_URL" \
  -n ansible-automation-platform
```

### 2.3 Create AAP API Access Token

Generate an API token in the AAP UI and create the connection secret:

1. Log into AAP platform using the admin credentials
2. Navigate to **Access Management > Users > admin > Tokens**
3. Create a new token with appropriate scope
4. Create the secret:

```bash
oc create secret generic aap-connection-secret \
  --from-literal=token="YOUR_AAP_TOKEN" \
  --from-literal=host="https://$(oc get route aap -n ansible-automation-platform -o jsonpath='{.spec.host}')" \
  -n ansible-automation-platform
```

## Step 3: Deploy Resource Operator CRs

### 3.1 Apply All Automation Resources

Deploy all the Resource Operator Custom Resources:

```bash
# Apply all CRs from the demo/ansible directory
oc apply -f demo/ansible/ -n ansible-automation-platform
```

### 3.2 Verify Resource Creation

Check that all resources were created successfully:

```bash
# Check AnsibleCredentials
oc get ansiblecredentials -n ansible-automation-platform

# Check AnsibleProjects
oc get ansibleprojects -n ansible-automation-platform

# Check AnsibleInventories
oc get ansibleinventories -n ansible-automation-platform

# Check JobTemplates
oc get jobtemplates -n ansible-automation-platform

# Check AnsibleJobs
oc get ansiblejobs -n ansible-automation-platform
```

## Step 4: Configure KubeVirt Inventory

### 4.1 Install Required Collections

The `requirements.yml` file specifies the necessary Ansible collections:

```yaml
collections:
  - name: kubevirt.core
    version: ">=1.5.0"
  - name: kubernetes.core
    version: ">=2.4.0"
  - name: redhat.openshift_virtualization
    version: ">=1.0.0"
```

### 4.2 Verify Inventory Plugin Configuration

The KubeVirt inventory plugin (`inventory.kubevirt.yml`) is configured to:

- Connect using environment variables (`K8S_AUTH_HOST`, `K8S_AUTH_API_KEY`)
- Group VMs by namespace, status, and custom labels
- Include detailed VM metadata for automation tasks

### 4.3 Test Inventory Sync

Monitor the inventory sync in the AAP UI:

1. Navigate to **Resources > Inventories > KubeVirt Inventory**
2. Go to **Sources** tab and click **Sync**
3. Verify VMs are discovered and grouped appropriately

## Step 5: Execute VM Management Jobs

### 5.1 Launch Bootc Switch Job

Execute the bootc image switching job:

```bash
# Create an AnsibleJob to switch VM images
cat <<EOF | oc apply -f -
apiVersion: aap.ansible.com/v1alpha1
kind: AnsibleJob
metadata:
  generateName: bootc-switch-job-
  namespace: ansible-automation-platform
spec:
  connection_secret: aap-connection-secret
  job_template_name: "Bootc Switch Image"
  extra_vars:
    imagename: "quay.io/example/my-bootc-image:latest"
    target_vm_group: "kubevirt_vms"
EOF
```

### 5.2 Monitor Job Execution

Track job progress:

```bash
# Watch AnsibleJob status
oc get ansiblejobs -n ansible-automation-platform -w

# View job logs in AAP UI
# Navigate to Jobs > Recent Jobs > [Job Name]
```

## Step 6: Advanced Configuration

### 6.1 Custom Credential Types

For advanced authentication scenarios, create custom credential types in AAP:

1. **Navigate to**: Administration > Credential Types
2. **Create New**: Custom credential type for KubeVirt clusters
3. **Input Configuration**:
   ```yaml
   fields:
     - id: api_url
       type: string
       label: API URL
     - id: token
       type: string
       label: Bearer Token
       secret: true
   ```
4. **Injector Configuration**:
   ```yaml
   env:
     K8S_AUTH_HOST: '{{ api_url }}'
     K8S_AUTH_API_KEY: '{{ token }}'
   ```

### 6.2 Container Groups for Multi-Cluster

Configure container groups to execute jobs on remote OpenShift clusters:

1. **Create ServiceAccount** on target cluster:
   ```bash
   oc create serviceaccount aap-execution-sa
   oc adm policy add-cluster-role-to-user edit -z aap-execution-sa
   ```

2. **Get ServiceAccount Token**:
   ```bash
   SA_TOKEN=$(oc serviceaccounts get-token aap-execution-sa)
   ```

3. **Configure Container Group** in AAP UI:
   - Name: `remote-ocp-cluster`
   - Credential: Use custom credential type with SA token
   - Pod Specification: Define resource limits and image

### 6.3 Workflow Templates

Create workflow templates for complex VM lifecycle operations:

1. **VM Provisioning Workflow**:
   - Create VM from template
   - Configure networking
   - Install bootc image
   - Run post-configuration playbooks

2. **VM Migration Workflow**:
   - Backup current state
   - Switch to new bootc image
   - Validate migration
   - Rollback if needed

## Troubleshooting

### Common Issues

1. **Operator Installation Fails**:
   ```bash
   # Check operator logs
   oc logs -n ansible-automation-platform deployment/aap-operator-controller-manager
   ```

2. **Resource Operator CRs Not Processing**:
   ```bash
   # Verify resource operator is running
   oc get pods -n ansible-automation-platform -l app.kubernetes.io/name=automation-controller-operator
   
   # Check CR status
   oc describe ansibleproject <project-name> -n ansible-automation-platform
   ```

3. **KubeVirt Inventory Not Syncing**:
   - Verify collections are installed: Check project sync logs
   - Validate credentials: Test API connectivity
   - Check network policies: Ensure AAP can reach KubeVirt API

4. **Job Execution Fails**:
   - Review job logs in AAP UI
   - Verify VM accessibility via SSH
   - Check bootc binary availability on target VMs

### Log Collection

Enable verbose logging for troubleshooting:

```bash
# Get controller logs
oc logs -n ansible-automation-platform deployment/aap-controller -f

# Get operator logs
oc logs -n ansible-automation-platform deployment/automation-controller-operator-controller-manager -f

# Get gateway logs
oc logs -n ansible-automation-platform deployment/aap-gateway -f
```

## Security Best Practices

1. **Use Secret References**: Never store credentials inline in CRs
2. **Rotate API Tokens**: Regularly update AAP and cluster access tokens
3. **Network Policies**: Restrict network access between AAP components
4. **RBAC**: Implement least-privilege access for ServiceAccounts
5. **Audit Logging**: Enable audit logs for compliance requirements

## Additional Resources

- [Red Hat AAP 2.5 Documentation](https://docs.redhat.com/en/documentation/red_hat_ansible_automation_platform/2.5)
- [AAP Resource Operator Guide](https://docs.redhat.com/en/documentation/red_hat_ansible_automation_platform/2.5/html/installing_on_openshift_container_platform/assembly-controller-resource-operator)
- [KubeVirt Ansible Collection](https://galaxy.ansible.com/kubevirt/core)
- [OpenShift Virtualization Documentation](https://docs.redhat.com/en/documentation/openshift_container_platform/4.14/html/virtualization)