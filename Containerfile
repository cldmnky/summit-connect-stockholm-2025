#### Builder stage: compile the Go binary and prepare frontend ####
FROM registry.redhat.io/ubi9/go-toolset as builder
WORKDIR /workspace
# Ensure deterministic builds for linux/amd64
ENV GOOS=linux GOARCH=amd64 CGO_ENABLED=0
COPY . .
# Build the backend binary
RUN go build -o /workspace/summit-connect ./
# If the frontend needs a build step, you can add it here. For this repo
# we assume frontend assets are already present under frontend/ or built by CI.

#### Final runtime image: bootc base with systemd ####
FROM quay.io/cldmnky/summit-connect-base:latest
LABEL MAINTAINER="Virt Corp <rhel@virt-corp.com>"

# Copy the compiled Go binary and frontend assets from the builder
COPY --from=builder /workspace/summit-connect /usr/local/bin/summit-connect
COPY --from=builder /workspace/frontend/ /var/lib/summit-connect/frontend/

# Systemd service for the Summit Connect application (from app dir)
COPY demo/bootc/virt-corp-summit-app/summit-connect.service /etc/systemd/system/summit-connect.service
RUN useradd -r -s /bin/false summit-connect && \
    mkdir -p /var/lib/summit-connect && \
    chown -R summit-connect:summit-connect /var/lib/summit-connect && \
    chmod +x /usr/local/bin/summit-connect && \
    systemctl enable summit-connect

# Runtime expectations when running inside a bootc VM or container:
# - A Kubernetes Secret (or volume) containing `datacenters.yaml` will be mounted
#   at /config (so the app uses /config/datacenters.yaml)
# - A Secret/volume with kubeconfig files will be mounted at /.kubeconfigs
# These mounts match the Makefile run-container flags and are used by the systemd unit.

EXPOSE 3001
