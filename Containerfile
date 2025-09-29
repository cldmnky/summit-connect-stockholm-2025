#### Builder stage: compile the Go binary and prepare frontend ####
# Builder stage: use /tmp locations so builder (possibly non-root) can write outputs
FROM registry.redhat.io/ubi9/go-toolset as builder
WORKDIR /tmp/src
# Ensure deterministic builds for linux/amd64
ENV GOOS=linux GOARCH=amd64 CGO_ENABLED=0
# Copy source into a tmp location; /tmp is typically writable by the container user
COPY . /tmp/src
# Build output to /tmp/bin which is writable
RUN mkdir -p /tmp/bin && \
    go build -buildvcs=false -o /tmp/bin/summit-connect ./
# If the frontend needs a build step, you can add it here. For this repo
# we assume frontend assets are already present under frontend/ or built by CI.

#### Final runtime image: bootc base with systemd ####
FROM quay.io/cldmnky/summit-connect-base:latest
LABEL MAINTAINER="Virt Corp <rhel@virt-corp.com>"

# Copy the compiled Go binary and frontend assets from the builder
COPY --from=builder /tmp/bin/summit-connect /usr/local/bin/summit-connect
COPY --from=builder /tmp/src/frontend/ /var/lib/summit-connect/frontend/

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
