#!/bin/bash

# Validate the Helm chart
echo "Validating Summit Connect Helm Chart..."

# Check if helm is installed
if ! command -v helm &> /dev/null; then
    echo "Error: Helm is not installed"
    exit 1
fi

# Lint the chart
echo "Running helm lint..."
helm lint ./summit-connect

# Template the chart to check for syntax errors
echo "Running helm template..."
helm template summit-connect ./summit-connect --dry-run

# Validate against Kubernetes schema (if kubectl is available)
if command -v kubectl &> /dev/null; then
    echo "Validating Kubernetes resources..."
    helm template summit-connect ./summit-connect | kubectl apply --dry-run=client -f -
else
    echo "kubectl not available, skipping Kubernetes validation"
fi

echo "Validation complete!"