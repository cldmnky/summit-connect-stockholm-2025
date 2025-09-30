#!/usr/bin/env bash
set -euo pipefail

# move-image-to-root.sh
# Save a podman image as a temporary archive and load it into root's podman
# storage so that 'sudo podman run' can access the image.
#
# Usage:
#   ./move-image-to-root.sh quay.io/cldmnky/summit-connect-base:latest
#
IMAGE="$1"

if [[ -z "${IMAGE:-}" ]]; then
  echo "Usage: $0 <image:tag>"
  exit 2
fi

if ! command -v podman >/dev/null 2>&1; then
  echo "ERROR: podman not found in PATH"
  exit 3
fi

if ! podman image exists "$IMAGE" >/dev/null 2>&1; then
  echo "ERROR: image '$IMAGE' not found in current user's podman store. Pull or build it first (podman pull $IMAGE)"
  exit 4
fi

TMPFILE=$(mktemp --tmpdir image-XXXXXX.tar)
echo "Saving $IMAGE to $TMPFILE (this may take a while)..."
podman save -o "$TMPFILE" "$IMAGE"

echo "Loading $TMPFILE into root's podman store (requires sudo)..."
sudo podman load -i "$TMPFILE"
rc=$?

if [[ $rc -ne 0 ]]; then
  echo "ERROR: sudo podman load failed (exit $rc)"
  echo "The archive is left at: $TMPFILE"
  exit $rc
fi

echo "Load succeeded. Removing temporary archive $TMPFILE"
rm -f "$TMPFILE"

echo "Done. root's podman store should now contain $IMAGE"
