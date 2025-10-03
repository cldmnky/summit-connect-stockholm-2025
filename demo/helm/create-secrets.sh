#!/bin/bash

# Summit Connect VM Secrets Creation Script
# This script creates the required secrets for the Summit Connect VM deployment

set -e

NAMESPACE=${1:-summit-connect}
CONFIG_FILE=${2:-demo/helm/summit-connect/files/datacenters.yaml}
KUBECONFIGS_DIR=${3:-.kubeconfigs}
SSH_KEY=${4:-~/.ssh/id_rsa.pub}

echo "Creating secrets for Summit Connect VM in namespace: $NAMESPACE"

# Check if namespace exists, create if it doesn't
if ! oc get namespace "$NAMESPACE" >/dev/null 2>&1; then
    echo "Creating namespace: $NAMESPACE"
    oc create namespace "$NAMESPACE"
fi

# Create SSH key secret
if [ -f "$SSH_KEY" ]; then
    echo "Creating SSH key secret..."
    oc create secret generic ssh-key \
        --from-file=key="$SSH_KEY" \
        -n "$NAMESPACE" \
        --dry-run=client -o yaml | oc apply -f -
    echo "✓ SSH key secret created"
else
    echo "⚠️  SSH key file not found at: $SSH_KEY"
    echo "   Please specify the correct path to your SSH public key"
fi

# Create application config secret
if [ -f "$CONFIG_FILE" ]; then
    echo "Creating application config secret..."
    oc create secret generic summit-connect-app-config \
        --from-file "$CONFIG_FILE" \
        -n "$NAMESPACE" \
        --dry-run=client -o yaml | oc apply -f -
    echo "✓ Application config secret created"
else
    echo "⚠️  Config file not found at: $CONFIG_FILE"
    echo "   Please specify the correct path to your datacenters.yaml file"
fi

# Create kubeconfigs secret
if [ -d "$KUBECONFIGS_DIR" ]; then
    echo "Creating kubeconfigs secret..."
    oc create secret generic summit-connect-kubeconfigs \
        --from-file "$KUBECONFIGS_DIR" \
        -n "$NAMESPACE" \
        --dry-run=client -o yaml | oc apply -f -
    echo "✓ Kubeconfigs secret created"
else
    echo "⚠️  Kubeconfigs directory not found at: $KUBECONFIGS_DIR"
    echo "   Please specify the correct path to your kubeconfigs directory"
fi

echo ""
echo "Secret creation completed! You can now install the Helm chart:"
echo "  helm install summit-connect ./summit-connect -n $NAMESPACE"