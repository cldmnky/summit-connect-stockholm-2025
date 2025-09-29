#!/usr/bin/env bash
set -euo pipefail

# Build and push script for Containerfile.bootc
# Builds the image, tags it quay.io/cldmnky/summit-connect-base:latest and pushes it.
# Preference: use podman when available, otherwise fall back to docker.

IMAGE_DEFAULT="quay.io/cldmnky/summit-connect-base:latest"
CONTAINERFILE="Containerfile.bootc"
RETRIES=3

usage() {
	cat <<EOF
Usage: $0 [image]

image: optional full image name (default: $IMAGE_DEFAULT)

This script will build '${CONTAINERFILE}' and push the resulting image to the registry.
It prefers 'podman' if installed, otherwise uses 'docker'.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
	usage
	exit 0
fi

IMAGE="${1:-$IMAGE_DEFAULT}"

if [[ ! -f "$CONTAINERFILE" ]]; then
	echo "ERROR: ${CONTAINERFILE} not found in $(pwd). Run this script from the directory that contains ${CONTAINERFILE}."
	exit 2
fi

if command -v podman >/dev/null 2>&1; then
	CLI=podman
elif command -v docker >/dev/null 2>&1; then
	CLI=docker
else
	echo "ERROR: neither podman nor docker found in PATH. Install one to build images."
	exit 3
fi

echo "Using container CLI: $CLI"
echo "Building ${CONTAINERFILE} -> ${IMAGE}"

# Build the image
if [[ "$CLI" == "podman" ]]; then
	# Podman supports same options as docker for basic builds
	$CLI build -f "$CONTAINERFILE" -t "$IMAGE" .
else
	# Docker: use plain build
	$CLI build -f "$CONTAINERFILE" -t "$IMAGE" .
fi

echo "Build complete. Pushing ${IMAGE}"

push_attempts=0
until [[ $push_attempts -ge $RETRIES ]]; do
	set +e
	$CLI push "$IMAGE"
	rc=$?
	set -e
	if [[ $rc -eq 0 ]]; then
		echo "Push succeeded"
		exit 0
	fi
	push_attempts=$((push_attempts + 1))
	echo "Push failed (attempt ${push_attempts}/${RETRIES}), retrying in $((push_attempts * 2))s..."
	sleep $((push_attempts * 2))
done

echo "ERROR: push failed after ${RETRIES} attempts"
exit 4

