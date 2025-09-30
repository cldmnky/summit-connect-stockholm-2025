#### Builder stage: compile the Go binary and prepare frontend ####
# Builder stage: compile the Go binary and prepare frontend
FROM registry.redhat.io/ubi9/go-toolset as builder

# Build in a writable temp location to avoid permission issues inside build containers
WORKDIR /tmp/src
# Ensure deterministic builds for linux/amd64
ENV GOOS=linux GOARCH=amd64 CGO_ENABLED=0

# Copy source to a temp path (avoids permission issues writing into mounted /workspace)
COPY . /tmp/src

# Ensure output dir exists and build with VCS stamping disabled to avoid VCS lookup failures
RUN mkdir -p /tmp/bin && \
    go build -buildvcs=false -o /tmp/bin/summit-connect ./
# If the frontend needs a build step, you can add it here. For this repo
# we assume frontend assets are already present under frontend/ or built by CI.

#### Final runtime image: bootc base with systemd ####
FROM quay.io/cldmnky/summit-connect-base:latest
LABEL MAINTAINER="Virt Corp <rhel@virt-corp.com>"

# Copy the compiled Go binary and frontend assets from the builder
# Copy the compiled binary from the builder's writable /tmp location
COPY --from=builder /tmp/bin/summit-connect /usr/local/bin/summit-connect

# Systemd service for the Summit Connect application
COPY demo/bootc/summit-connect-app/summit-connect.service /etc/systemd/system/summit-connect.service
RUN chmod +x /usr/local/bin/summit-connect && \
    systemctl enable summit-connect

# Runtime expectations when running inside a bootc VM or container:
# - A Kubernetes Secret (or volume) containing `datacenters.yaml` will be mounted
#   at /config (so the app uses /config/datacenters.yaml)
# - A Secret/volume with kubeconfig files will be mounted at /.kubeconfigs
# These mounts match the Makefile run-container flags and are used by the systemd unit.

EXPOSE 3001
