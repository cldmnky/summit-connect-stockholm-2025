#!/usr/bin/env bash
set -euo pipefail

# configure-bootc-pivot.sh
# Helper script to configure the bootc pivot functionality in the Helm chart

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALUES_FILE="$SCRIPT_DIR/summit-connect/values.yaml"

usage() {
    cat <<EOF
Usage: $0 [options]

This script helps configure the bootc pivot functionality for the Summit Connect Helm chart.
The bootc pivot allows VMs to start with a base RHEL bootc image and automatically switch
to your application image on first boot.

Options:
    -h, --help                  Show this help
    --enable                    Enable bootc pivot functionality
    --disable                   Disable bootc pivot functionality
    --target-image <image>      Set the target application image (default: quay.io/cldmnky/summit-connect-app:latest)
    --auth-file <path>          Path to podman/docker auth.json file for registry authentication
    --show-config               Show current bootc pivot configuration

Examples:
    # Enable pivot with default application image
    $0 --enable

    # Enable pivot with custom application image
    $0 --enable --target-image quay.io/myorg/my-app:latest

    # Enable pivot with registry authentication
    $0 --enable --auth-file ~/.docker/config.json

    # Show current configuration
    $0 --show-config

    # Disable pivot (use base image only)
    $0 --disable

EOF
}

show_config() {
    echo "Current bootc pivot configuration:"
    echo "=================================="
    
    if command -v yq >/dev/null 2>&1; then
        echo "Enabled: $(yq '.bootcPivot.enabled' "$VALUES_FILE")"
        echo "Target Image: $(yq '.bootcPivot.targetImage' "$VALUES_FILE")"
        echo "Auth File Enabled: $(yq '.bootcPivot.registryAuth.createAuthFile' "$VALUES_FILE")"
    else
        echo "Note: Install 'yq' for better config display"
        grep -A 10 "bootcPivot:" "$VALUES_FILE" || echo "No bootc pivot configuration found"
    fi
}

enable_pivot() {
    local target_image="${1:-quay.io/cldmnky/summit-connect-app:latest}"
    
    echo "Enabling bootc pivot functionality..."
    
    # Use yq if available, otherwise use sed
    if command -v yq >/dev/null 2>&1; then
        yq -i '.bootcPivot.enabled = true' "$VALUES_FILE"
        yq -i ".bootcPivot.targetImage = \"$target_image\"" "$VALUES_FILE"
    else
        sed -i.bak 's/enabled: false/enabled: true/' "$VALUES_FILE"
        sed -i.bak "s|targetImage: .*|targetImage: \"$target_image\"|" "$VALUES_FILE"
    fi
    
    echo "✓ Bootc pivot enabled"
    echo "✓ Target image set to: $target_image"
}

disable_pivot() {
    echo "Disabling bootc pivot functionality..."
    
    if command -v yq >/dev/null 2>&1; then
        yq -i '.bootcPivot.enabled = false' "$VALUES_FILE"
        yq -i '.bootcPivot.registryAuth.createAuthFile = false' "$VALUES_FILE"
    else
        sed -i.bak 's/enabled: true/enabled: false/' "$VALUES_FILE"
        sed -i.bak 's/createAuthFile: true/createAuthFile: false/' "$VALUES_FILE"
    fi
    
    echo "✓ Bootc pivot disabled"
}

configure_auth() {
    local auth_file="$1"
    
    if [[ ! -f "$auth_file" ]]; then
        echo "Error: Auth file not found: $auth_file"
        exit 1
    fi
    
    echo "Configuring registry authentication from $auth_file..."
    
    # Read the auth file content and escape it for YAML
    local auth_content
    auth_content=$(cat "$auth_file")
    
    # Create a temporary file with the auth content properly indented
    local temp_file
    temp_file=$(mktemp)
    echo "$auth_content" | sed 's/^/      /' > "$temp_file"
    
    if command -v yq >/dev/null 2>&1; then
        yq -i '.bootcPivot.registryAuth.createAuthFile = true' "$VALUES_FILE"
        # Replace the authJson content
        yq -i ".bootcPivot.registryAuth.authJson = \"$(cat "$auth_file" | tr '\n' ' ')\"" "$VALUES_FILE"
    else
        # Use sed to replace the auth content
        sed -i.bak 's/createAuthFile: false/createAuthFile: true/' "$VALUES_FILE"
        echo "Note: Manual auth.json content update required when not using yq"
        echo "Please update the bootcPivot.registryAuth.authJson section in $VALUES_FILE"
        echo "with the content from $auth_file"
    fi
    
    rm -f "$temp_file"
    echo "✓ Registry authentication configured"
}

# Parse command line arguments
ENABLE=false
DISABLE=false
SHOW_CONFIG=false
TARGET_IMAGE=""
AUTH_FILE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        --enable)
            ENABLE=true
            shift
            ;;
        --disable)
            DISABLE=true
            shift
            ;;
        --target-image)
            TARGET_IMAGE="$2"
            shift 2
            ;;
        --auth-file)
            AUTH_FILE="$2"
            shift 2
            ;;
        --show-config)
            SHOW_CONFIG=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate values file exists
if [[ ! -f "$VALUES_FILE" ]]; then
    echo "Error: Values file not found: $VALUES_FILE"
    echo "Please run this script from the demo/helm directory"
    exit 1
fi

# Execute actions
if [[ "$SHOW_CONFIG" == true ]]; then
    show_config
elif [[ "$ENABLE" == true ]]; then
    enable_pivot "$TARGET_IMAGE"
    if [[ -n "$AUTH_FILE" ]]; then
        configure_auth "$AUTH_FILE"
    fi
elif [[ "$DISABLE" == true ]]; then
    disable_pivot
else
    echo "Error: Please specify an action (--enable, --disable, or --show-config)"
    usage
    exit 1
fi

echo ""
echo "Configuration complete. You can now run:"
echo "  helm upgrade -i summit summit-connect"