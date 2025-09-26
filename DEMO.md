# Summit Connect Stockholm 2025 Keynote Demo

## Overview

This demo showcases an advanced GitOps-driven deployment pipeline using RHEL 10 bootc (bootable container) technology combined with OpenShift, Ansible EDA (Event-Driven Automation), Tekton Pipelines, and the Summit Connect Stockholm application. The demo illustrates how modern infrastructure can be completely automated through event-driven processes, from image building to application deployment, using bootc's revolutionary approach to immutable operating systems.

The demo demonstrates a complete end-to-end workflow where infrastructure changes trigger automated builds, deployments, and seamless application switches without downtime. This showcases the future of infrastructure management where VMs can be treated as immutable, containerized workloads that can be upgraded atomically using container image techniques.

## Demo Flow - Detailed Implementation

### Phase 1: Base Image Creation and Push

* **Ansible Automation**: Execute Ansible playbook to build the RHEL 10 bootc base image
  * Build occurs on a dedicated builder VM with podman/buildah
  * Uses the existing `bootc/virt-corp-base/Containerfile` as the foundation
  * Includes monitoring tools (node_exporter, systemd_exporter, qemu-guest-agent)
  * Tags and pushes the completed base image to `quay.io/cldmnky/summit-soe:latest`
  * Base image serves as the Standard Operating Environment (SOE) for all VMs

### Phase 2: Application Image Build Pipeline

* **Application Image Creation**: Build application-specific bootc image
  * Creates new Containerfile using `FROM quay.io/cldmnky/summit-soe:latest`
  * Builds the Go application binary and includes frontend assets
  * Configures systemd service unit files for automatic application startup
  * Sets up proper user permissions and service dependencies
  * Pushes completed application image to `quay.io/cldmnky/summit-app:latest`
* **Pipeline Integration**: Optionally trigger Tekton CI/CD pipeline
  * Tekton TaskRun handles the container build process
  * Automated testing and security scanning of the application image
  * GitOps workflow updates deployment manifests upon successful build

### Phase 3: VM Deployment with Helm

* **Helm Chart Deployment**: Deploy VM to `borg.blahonga.me` OpenShift cluster
  * Helm chart creates KubeVirt VirtualMachine resource using base SOE image
  * Chart includes necessary secrets for summit-app configuration
  * Configures OpenShift Route for external application access
  * VM labeled with `app: summit-app` to trigger EDA automation
  * Cloud-init configuration prepares VM for bootc operations
  * Persistent storage allocated for application data and logs

### Phase 4: Event-Driven Automation Trigger

* **Ansible EDA Monitoring**: EDA rulebook watches for VM creation events
  * Monitors Kubernetes API for VMs with `app: summit-app` label
  * Event detection triggers immediate execution of bootc switch playbook
  * Playbook connects to newly created VM via SSH or OpenShift console
  * Executes `bootc switch quay.io/cldmnky/summit-app:latest` command
  * VM performs atomic reboot into the application-specific image
  * Zero-downtime switch from base SOE to fully configured application

### Phase 5: Live Application Access

* **Application Availability**: Summit Connect Stockholm app becomes accessible
  * Application automatically starts via systemd after bootc switch
  * OpenShift Route provides external HTTPS access to the application
  * Real-time Stockholm datacenters visualization fully operational
  * VM monitoring and migration capabilities demonstrate live functionality

### Phase 6: Conference Session Promotion

* **Shameless Plug Integration**: Demonstrate cross-cluster VM migration
  * Live showcase of VM migration between OpenShift clusters
  * Regional datacenter simulation using the Stockholm map interface
  * Real-time visualization of workload movement across geographic regions
  * Invitation to attend detailed technical session on cross-cluster migration
  * Highlight advanced features: live migration, disaster recovery, workload balancing

## Architecture Components

### Core Technologies

* **RHEL 10 bootc** - Revolutionary bootable container images for immutable infrastructure
* **OpenShift/Kubernetes** - Enterprise container orchestration with KubeVirt for VM management
* **Ansible** - Infrastructure automation and configuration management platform  
* **Ansible EDA** - Event-driven automation for reactive infrastructure management
* **Tekton Pipelines** - Cloud-native CI/CD framework for container image builds
* **Helm** - Kubernetes package manager for complex application deployment
* **Quay.io** - Enterprise container registry for bootc image distribution
* **Go Application** - Summit Connect Stockholm datacenters visualization and migration demo

### Infrastructure Flow

```text
[Ansible Playbook] → [Build Base bootc Image] → [Push to quay.io/cldmnky/summit-soe:latest]
                              ↓
[Tekton Pipeline] → [Build App bootc Image] → [Push to quay.io/cldmnky/summit-app:latest]
                              ↓
[Helm Chart] → [Deploy VM with Base Image] → [OpenShift Cluster (borg.blahonga.me)]
                              ↓
[VM with app: summit-app label] → [Ansible EDA Detection] → [bootc switch Playbook]
                              ↓
[Application bootc Image] → [Atomic VM Reboot] → [Live Summit Connect App]
```

## Outline

### Phase 1: Infrastructure Preparation

- Set up container registry for bootc images
- Configure Kubernetes cluster with KubeVirt
- Prepare Ansible EDA environment and rulebooks

### Phase 2: Image Building Pipeline

- Build RHEL 10 base bootc image with monitoring tools
- Create application-specific bootc image with Summit Connect app
- Push images to registry using Ansible automation

### Phase 3: VM Deployment

- Deploy VM using Helm chart with base bootc image
- Configure VM with `app=summit-connect-stockholm-2025` label
- Verify VM boot and base image functionality

### Phase 4: Event-Driven Automation

- Ansible EDA detects newly labeled VM
- Triggers playbook to perform bootc switch operation
- VM seamlessly switches to application-specific image
- Application becomes available without downtime

### Phase 5: Application Demonstration

- Access the Stockholm datacenters visualization
- Show real-time VM monitoring across datacenters
- Demonstrate live migration capabilities
- Highlight the modern web interface with interactive maps

## Steps to Implement

### Prerequisites

1. **Container Registry Setup**
   - Set up a container registry (Quay.io, Harbor, or OpenShift registry)
   - Configure authentication and push/pull permissions
   - Ensure registry supports bootc image formats

2. **Kubernetes/OpenShift Cluster**
   - Install KubeVirt operator for VM management
   - Configure storage classes for VM disks
   - Ensure cluster has sufficient resources for VM workloads

3. **Ansible Automation Platform 2.5 Setup on OpenShift**
   - Deploy AAP operator and configure EDA controller
   - Set up KubeVirt dynamic inventory
   - Configure declarative automation resources

## AAP 2.5 Installation and Configuration on OpenShift

### Step 1: Install Ansible Automation Platform Operator

**Create Namespace and Operator Subscription**:

```yaml
# aap-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ansible-automation-platform
  labels:
    name: ansible-automation-platform
---
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: ansible-automation-platform-operator-group
  namespace: ansible-automation-platform
spec:
  targetNamespaces:
    - ansible-automation-platform
---
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: ansible-automation-platform-operator
  namespace: ansible-automation-platform
spec:
  channel: stable-2.5-cluster-scoped
  name: aap-operator
  source: redhat-operators
  sourceNamespace: openshift-marketplace
  installPlanApproval: Automatic
```

### Step 2: Deploy AutomationController (Ansible Tower)

**Create AutomationController Custom Resource**:

```yaml
# automation-controller.yaml
apiVersion: automationcontroller.ansible.com/v1beta1
kind: AutomationController
metadata:
  name: summit-automation-controller
  namespace: ansible-automation-platform
spec:
  create_preload_data: true
  route_tls_termination_mechanism: Edge
  loadbalancer_protocol: https
  image_pull_policy: IfNotPresent
  projects_storage_size: 8Gi
  projects_storage_access_mode: ReadWriteMany
  projects_persistence: true
  replicas: 1
  admin_user: admin
  loadbalancer_port: 80
  nodeport_port: 30080
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi
    limits:
      cpu: 2000m
      memory: 4Gi
```

### Step 3: Deploy Event-Driven Ansible Controller

**Create EDAController Custom Resource**:

```yaml
# eda-controller.yaml
apiVersion: eda.ansible.com/v1alpha1
kind: EDAController
metadata:
  name: summit-eda-controller
  namespace: ansible-automation-platform
spec:
  automation_server_url: https://summit-automation-controller-ansible-automation-platform.apps.borg.blahonga.me
  image_pull_policy: IfNotPresent
  loadbalancer_port: 80
  nodeport_port: 30080
  replicas: 1
  route_tls_termination_mechanism: Edge
  service_type: ClusterIP
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 1000m
      memory: 2Gi
```

### Step 4: Configure KubeVirt Dynamic Inventory

**Create KubeVirt Inventory Source in AAP**:

```yaml
# kubevirt-inventory.yml (for use in AAP)
plugin: kubevirt.core.kubevirt
connections:
  - kubeconfig: ~/.kube/config
    # Use the borg cluster kubeconfig
namespaces:
  - default
  - openshift-cnv
network_name: default
label_selectors:
  - app=summit-app
  - bootc=enabled
api_version: kubevirt.io/v1
strict: False
compose:
  # Create Ansible inventory vars from VM metadata
  ansible_host: status.interfaces[0].ipAddress
  vm_name: metadata.name
  vm_namespace: metadata.namespace
  vm_labels: metadata.labels
  bootc_image: spec.template.spec.domain.devices.disks[0].bootOrder
keyed_groups:
  # Group VMs by namespace
  - key: metadata.namespace
    prefix: namespace
  # Group VMs by labels
  - key: metadata.labels.app
    prefix: app
  - key: metadata.labels.bootc
    prefix: bootc
```

### Step 5: Create Declarative Automation Resources

**Project Configuration**:

```yaml
# summit-project.yaml
apiVersion: automationcontroller.ansible.com/v1beta1
kind: Project
metadata:
  name: summit-bootc-project
  namespace: ansible-automation-platform
spec:
  name: Summit Connect Bootc Demo
  scm_type: git
  scm_url: https://github.com/cldmnky/summit-connect-stockholm-2025.git
  scm_branch: main
  scm_clean: true
  scm_delete_on_update: true
  scm_update_on_launch: true
  scm_update_cache_timeout: 0
  organization: Default
```

**Inventory Configuration**:

```yaml
# summit-inventory.yaml
apiVersion: automationcontroller.ansible.com/v1beta1
kind: Inventory
metadata:
  name: summit-kubevirt-inventory
  namespace: ansible-automation-platform
spec:
  name: Summit KubeVirt VMs
  description: Dynamic inventory for KubeVirt VMs on borg cluster
  organization: Default
  variables: |
    ---
    cluster_name: borg.blahonga.me
    bootc_registry: quay.io/cldmnky
    base_image: summit-soe:latest
    app_image: summit-app:latest
```

**Inventory Source Configuration**:

```yaml
# summit-inventory-source.yaml
apiVersion: automationcontroller.ansible.com/v1beta1
kind: InventorySource
metadata:
  name: summit-kubevirt-source
  namespace: ansible-automation-platform
spec:
  name: KubeVirt Dynamic Source
  inventory: summit-kubevirt-inventory
  source: kubevirt
  source_vars: |
    plugin: kubevirt.core.kubevirt
    connections:
      - kubeconfig: /var/lib/awx/.kube/config
    namespaces:
      - default
    label_selectors:
      - app=summit-app
    compose:
      ansible_host: status.interfaces[0].ipAddress
      vm_name: metadata.name
      vm_namespace: metadata.namespace
  update_on_launch: true
  overwrite: true
  overwrite_vars: true
```

**Job Template for Bootc Switch**:

```yaml
# bootc-switch-job-template.yaml
apiVersion: automationcontroller.ansible.com/v1beta1
kind: JobTemplate
metadata:
  name: summit-bootc-switch
  namespace: ansible-automation-platform
spec:
  name: Summit Connect Bootc Switch
  description: Switch VM to Summit Connect application image
  job_type: run
  inventory: summit-kubevirt-inventory
  project: summit-bootc-project
  playbook: ansible/playbooks/bootc-switch.yml
  credentials:
    - summit-cluster-credential
  extra_vars: |
    target_image: quay.io/cldmnky/summit-app:latest
    registry_auth: true
  become_enabled: true
  limit: app_summit_app
  verbosity: 1
  concurrent_jobs_enabled: false
```

### Step 6: Configure EDA Rulebook Integration

**Create EDA Rulebook for VM Detection**:

```yaml
# eda-rulebook-activation.yaml
apiVersion: eda.ansible.com/v1alpha1
kind: Activation
metadata:
  name: summit-vm-watcher
  namespace: ansible-automation-platform
spec:
  name: Summit VM Bootc Watcher
  description: Watch for new VMs and trigger bootc switch
  rulebook_name: summit-vm-watcher.yml
  extra_vars: |
    controller_host: summit-automation-controller-service
    controller_username: admin
    controller_password: "{{ controller_admin_password }}"
    job_template_name: Summit Connect Bootc Switch
  restart_policy: on-failure
  git_hash: main
  project: Summit Connect Bootc Demo
```

**EDA Rulebook Content** (`ansible/rulebooks/summit-vm-watcher.yml`):

```yaml
---
- name: Summit Connect VM Bootc Automation
  hosts: localhost
  sources:
    - name: kubernetes_events
      ansible.eda.k8s:
        api_version: kubevirt.io/v1
        kind: VirtualMachine
        namespace: default
        label_selectors:
          - "app=summit-app"
  rules:
    - name: New Summit VM detected
      condition: >
        event.type == "ADDED" and 
        event.resource.metadata.labels.app == "summit-app" and
        event.resource.status.phase == "Running"
      action:
        run_job_template:
          name: Summit Connect Bootc Switch
          organization: Default
          extra_vars:
            vm_name: "{{ event.resource.metadata.name }}"
            vm_namespace: "{{ event.resource.metadata.namespace }}"
            limit: "{{ event.resource.metadata.name }}"
```

### Step 7: Deployment Commands

```bash
# Deploy AAP components
oc apply -f aap-namespace.yaml
oc apply -f automation-controller.yaml
oc apply -f eda-controller.yaml

# Wait for deployments to be ready
oc wait --for=condition=Ready automationcontroller/summit-automation-controller -n ansible-automation-platform --timeout=300s
oc wait --for=condition=Ready edacontroller/summit-eda-controller -n ansible-automation-platform --timeout=300s

# Apply automation resources
oc apply -f summit-project.yaml
oc apply -f summit-inventory.yaml
oc apply -f summit-inventory-source.yaml
oc apply -f bootc-switch-job-template.yaml
oc apply -f eda-rulebook-activation.yaml

# Get access URLs
echo "Automation Controller URL: https://$(oc get route summit-automation-controller -n ansible-automation-platform -o jsonpath='{.spec.host}')"
echo "EDA Controller URL: https://$(oc get route summit-eda-controller -n ansible-automation-platform -o jsonpath='{.spec.host}')"
```

### Step 8: Validation and Testing

```bash
# Check AAP deployment status
oc get automationcontroller,edacontroller -n ansible-automation-platform

# Verify inventory sync
oc logs -f deployment/summit-automation-controller -n ansible-automation-platform

# Test EDA rulebook activation
oc get activation summit-vm-watcher -n ansible-automation-platform -o yaml

# Monitor EDA events
oc logs -f deployment/summit-eda-controller-api -n ansible-automation-platform
```

### Step 1: Create Ansible Playbooks for Image Building

Create directory structure:

```text
ansible/
├── playbooks/
│   ├── build-base-image.yml
│   ├── build-app-image.yml
│   └── bootc-switch.yml
├── inventory/
│   └── hosts.yml
└── vars/
    └── images.yml
```

**Base Image Build Playbook** (`ansible/playbooks/build-base-image.yml`):

- Build base RHEL 10 bootc image using existing Containerfile
- Include monitoring tools (node_exporter, systemd_exporter)
- Tag and push to registry
- Use podman or buildah for container operations

**Application Image Build Playbook** (`ansible/playbooks/build-app-image.yml`):

- Extend base image with Summit Connect application
- Copy Go binary and frontend assets
- Configure systemd services for the application
- Tag with application-specific labels

**Example Application Containerfile** (`bootc/summit-app/Containerfile`):

```dockerfile
FROM quay.io/cldmnky/summit-soe:latest

# Copy application binary and assets
COPY --from=builder /workspace/summit-connect /usr/local/bin/summit-connect
COPY --from=builder /workspace/frontend/ /var/lib/summit-connect/frontend/

# Create systemd service for the application
COPY summit-connect.service /etc/systemd/system/
RUN systemctl enable summit-connect

# Configure application user and permissions
RUN useradd -r -s /bin/false summit-connect && \
    chown -R summit-connect:summit-connect /var/lib/summit-connect && \
    chmod +x /usr/local/bin/summit-connect

# Expose application port
EXPOSE 3001
```

**Summit Connect systemd service** (`bootc/summit-app/summit-connect.service`):

```ini
[Unit]
Description=Summit Connect Stockholm 2025 Demo Application
After=network.target
Wants=network.target

[Service]
Type=simple
User=summit-connect
WorkingDirectory=/var/lib/summit-connect
ExecStart=/usr/local/bin/summit-connect serve backend --port 3001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Step 2: Create Helm Chart for VM Deployment

Create Helm chart structure:

```text
helm/
└── summit-vm/
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
        ├── virtualmachine.yaml
        ├── service.yaml
        └── configmap.yaml
```

**VM Template Requirements**:

- Use KubeVirt VirtualMachine CRD
- Configure bootc base image as boot disk
- Add label: `app=summit-connect-stockholm-2025`
- Set up cloud-init for initial configuration
- Configure network access and persistent storage

### Step 3: Configure Ansible EDA

**Create EDA Rulebook** (`ansible/rulebooks/vm-watcher.yml`):

```yaml
---
- name: Watch for Summit Connect VMs
  hosts: all
  sources:
    - name: kubernetes_events
      ansible.eda.k8s:
        api_version: kubevirt.io/v1
        kind: VirtualMachine
        namespace: default
        label_selectors:
          - "app=summit-app"
  rules:
    - name: VM with summit-app label detected
      condition: event.type == "ADDED" and event.resource.metadata.labels.app == "summit-app"
      action:
        run_playbook:
          name: ansible/playbooks/bootc-switch.yml
          extra_vars:
            vm_name: "{{ event.resource.metadata.name }}"
            vm_namespace: "{{ event.resource.metadata.namespace }}"
            target_image: "quay.io/cldmnky/summit-app:latest"
            cluster_name: "borg.blahonga.me"
```

**Bootc Switch Playbook** (`ansible/playbooks/bootc-switch.yml`):

```yaml
---
- name: Switch VM to application bootc image
  hosts: localhost
  gather_facts: false
  vars:
    bootc_target_image: "{{ target_image | default('quay.io/cldmnky/summit-app:latest') }}"
  
  tasks:
    - name: Wait for VM to be running
      kubernetes.core.k8s_info:
        api_version: kubevirt.io/v1
        kind: VirtualMachineInstance
        name: "{{ vm_name }}"
        namespace: "{{ vm_namespace | default('default') }}"
        wait: true
        wait_condition:
          type: Ready
          status: "True"
        wait_timeout: 300

    - name: Execute bootc switch via virtctl console
      ansible.builtin.shell: |
        virtctl console {{ vm_name }} -n {{ vm_namespace | default('default') }} --timeout=30s << EOF
        sudo bootc switch {{ bootc_target_image }}
        sudo systemctl reboot
        EOF
      register: bootc_switch_result
      
    - name: Verify bootc switch success
      ansible.builtin.debug:
        msg: "bootc switch initiated for VM {{ vm_name }} to image {{ bootc_target_image }}"
```

### Step 4: Implement the Demo Workflow

**Phase 1 - Build Images**:

```bash
# Run Ansible playbook to build base image
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/build-base-image.yml

# Build application image
ansible-playbook -i ansible/inventory/hosts.yml ansible/playbooks/build-app-image.yml
```

**Phase 2 - Start EDA**:

```bash
# Start Ansible EDA in the background
ansible-rulebook --rulebook ansible/rulebooks/vm-watcher.yml --inventory ansible/inventory/hosts.yml &
```

**Phase 3 - Deploy VM**:

```bash
# Deploy VM using Helm
helm install summit-vm helm/summit-vm/ \
  --set image.repository="your-registry/rhel10-bootc-base" \
  --set image.tag="latest" \
  --set labels.app="summit-connect-stockholm-2025"
```

**Phase 4 - Monitor and Demonstrate**:

- EDA detects the VM with the specified label
- Automatically triggers bootc switch to application image
- VM reboots with Summit Connect application
- Access application at VM's IP address or service endpoint

### Step 5: Validation and Monitoring

**Verify Image Switch**:

```bash
# Check current bootc status on VM
bootc status

# Verify application services
systemctl status summit-connect
```

**Monitor EDA Events**:

- Check EDA logs for triggered rules
- Verify playbook execution success
- Monitor VM status during bootc switch

**Application Testing**:

- Access Stockholm datacenters visualization
- Test VM migration functionality
- Verify real-time updates and interactive features

### Troubleshooting Tips

1. **Image Build Issues**:
   - Verify registry credentials and push permissions
   - Check Containerfile syntax and base image availability
   - Ensure proper tagging conventions

2. **VM Deployment Problems**:
   - Validate KubeVirt installation and node resources
   - Check storage class configuration
   - Verify network policies and service mesh settings

3. **EDA Rule Execution**:
   - Check kubernetes API permissions for EDA service account
   - Validate rule conditions and event matching
   - Monitor ansible-runner logs for playbook execution

4. **Bootc Switch Failures**:
   - Ensure VM has internet connectivity for image pulls
   - Verify bootc service is running and configured
   - Check image compatibility and signature verification

### Success Metrics

- ✅ Base and application images built and pushed successfully
- ✅ VM deployed with correct labels and base image
- ✅ EDA rule triggered upon VM detection
- ✅ Bootc switch completed without errors
- ✅ Application accessible and fully functional
- ✅ Real-time monitoring and migration features working

