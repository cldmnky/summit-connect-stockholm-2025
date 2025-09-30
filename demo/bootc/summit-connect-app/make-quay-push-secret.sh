#!/usr/bin/env bash
set -euo pipefail

# make-quay-push-secret.sh
# Extract quay.io credentials from ~/.config/containers/auth.json and populate
# quay-push-secret.generated.yaml next to the template in this directory.
# Usage:
#   ./make-quay-push-secret.sh         # writes the YAML file in the current dir
#   ./make-quay-push-secret.sh --apply # also kubectl apply -f the secret

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/quay-push-secret.yaml"
OUTPUT="$SCRIPT_DIR/quay-push-secret.generated.yaml"
AUTH_JSON="${HOME}/.config/containers/auth.json"
NAMESPACE=${NAMESPACE:-summit-connect-demo}

apply=false
if [[ ${1:-} == "--apply" ]]; then
  apply=true
fi

if [[ ! -f "$AUTH_JSON" ]]; then
  echo "ERROR: $AUTH_JSON not found. Please login with 'podman login quay.io' or create the auth file." >&2
  exit 2
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: 'jq' is required by this script. Install jq (brew install jq or apt-get install jq)" >&2
  exit 3
fi

# Extract credentials for quay.io and registry.redhat.io from auth.json
QUAY_AUTH_B64=$(jq -r '.auths["quay.io"].auth // empty' "$AUTH_JSON")
QUAY_USER=$(jq -r '.auths["quay.io"].username // empty' "$AUTH_JSON")
QUAY_PASS=$(jq -r '.auths["quay.io"].password // empty' "$AUTH_JSON")

RHEL_AUTH_B64=$(jq -r '.auths["registry.redhat.io"].auth // empty' "$AUTH_JSON")
RHEL_USER=$(jq -r '.auths["registry.redhat.io"].username // empty' "$AUTH_JSON")
RHEL_PASS=$(jq -r '.auths["registry.redhat.io"].password // empty' "$AUTH_JSON")

# If auth fields are missing but username/password exist, construct auth
if [[ -z "$QUAY_AUTH_B64" && -n "$QUAY_USER" && -n "$QUAY_PASS" ]]; then
  QUAY_AUTH_B64=$(printf "%s:%s" "$QUAY_USER" "$QUAY_PASS" | base64 -w0)
fi

if [[ -z "$RHEL_AUTH_B64" && -n "$RHEL_USER" && -n "$RHEL_PASS" ]]; then
  RHEL_AUTH_B64=$(printf "%s:%s" "$RHEL_USER" "$RHEL_PASS" | base64 -w0)
fi

# Build dockerconfigjson content including both registries if present
DOCKERCFG=$(jq -n --arg qa "$QUAY_AUTH_B64" --arg ra "$RHEL_AUTH_B64" '
  {
    auths: (
      {} 
      + (if $qa != "" then {"quay.io": {auth: $qa}} else {} end)
      + (if $ra != "" then {"registry.redhat.io": {auth: $ra}} else {} end)
    )
  }')
DOCKERCFG_B64=$(printf '%s' "$DOCKERCFG" | base64 -w0)

if [[ "$apply" == true ]]; then
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "ERROR: kubectl not found in PATH" >&2
    exit 5
  fi

  # Apply the secret directly without creating a file
  kubectl apply -f - <<KUBYAML
apiVersion: v1
kind: Secret
metadata:
  name: quay-push-secret
  namespace: ${NAMESPACE}
  annotations:
    build.shipwright.io/referenced.secret: "true"
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: "${DOCKERCFG_B64}"
KUBYAML

  echo "Applied secret to cluster (namespace ${NAMESPACE})."
else
  # Write generated YAML for inspection or manual apply
  cat > "$OUTPUT" <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: quay-push-secret
  namespace: ${NAMESPACE}
  annotations:
    build.shipwright.io/referenced.secret: "true"
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: "${DOCKERCFG_B64}"
EOF

  echo "Wrote $OUTPUT"
fi
