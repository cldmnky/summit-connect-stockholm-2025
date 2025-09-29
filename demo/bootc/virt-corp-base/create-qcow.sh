#!/usr/bin/env bash
set -euo pipefail

# create-qcow.sh
# Helper to run the bootc image builder container (podman) and produce a qcow2
# Usage: ./create-qcow.sh [image] [builder_image]
#   image: the source container image to convert into a qcow2 (default: quay.io/cldmnky/summit-connect-base:latest)
#   builder_image: the bootc builder image (default: registry.redhat.io/rhel10/bootc-image-builder:latest)

IMAGE_DEFAULT="quay.io/cldmnky/summit-connect-base:latest"
BUILDER_DEFAULT="registry.redhat.io/rhel10/bootc-image-builder:latest"

IMAGE="${1:-$IMAGE_DEFAULT}"
BUILDER="${2:-$BUILDER_DEFAULT}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/output"

echo "Image to convert: $IMAGE"
echo "Bootc builder image: $BUILDER"

if ! command -v podman >/dev/null 2>&1; then
  echo "ERROR: podman not found. Install podman and try again."
  exit 2
fi

mkdir -p "$OUTPUT_DIR"

echo "Make sure you're logged into the registries if they require authentication:" \
     "(podman login quay.io) and (podman login registry.redhat.io)"

echo "Running bootc image builder... output will be written to: $OUTPUT_DIR"

cmd=(sudo podman run --rm --privileged --pull=newer --security-opt label=type:unconfined_t \
  -v "$OUTPUT_DIR":/output \
  -v /var/lib/containers/storage:/var/lib/containers/storage \
  "$BUILDER" --type qcow2 "$IMAGE")

echo "Command: ${cmd[*]}"

"${cmd[@]}"

echo "Builder finished. Check $OUTPUT_DIR for the generated qcow2 file(s)."
