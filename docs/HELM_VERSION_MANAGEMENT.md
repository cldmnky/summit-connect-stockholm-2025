# Helm Chart Version Management

This document describes the automated Helm chart version management system for the Summit Connect Stockholm 2025 project.

## Overview

The `make helm-bump-version` target provides a complete automated workflow for:

1. **Semantic Version Bumping**: Automatically calculates and updates chart versions
2. **Git Integration**: Commits and pushes changes to the main branch
3. **CI/CD Trigger**: Triggers GitHub Actions to update the Helm repository
4. **OpenShift Integration**: Automatically refreshes the OpenShift Helm repository

## Usage

### Basic Usage

```bash
# Patch version bump (default): 0.1.3 → 0.1.4
make helm-bump-version

# Minor version bump: 0.1.3 → 0.2.0
make helm-bump-version BUMP_TYPE=minor

# Major version bump: 0.1.3 → 1.0.0
make helm-bump-version BUMP_TYPE=major
```

### Dry Run Mode

Preview changes before applying them:

```bash
# Preview patch bump
make helm-bump-version DRY_RUN=true

# Preview minor bump
make helm-bump-version BUMP_TYPE=minor DRY_RUN=true

# Preview major bump  
make helm-bump-version BUMP_TYPE=major DRY_RUN=true
```

## Version Types

| Type  | Example Change | Use Case |
|-------|----------------|----------|
| `patch` | 0.1.3 → 0.1.4 | Bug fixes, small updates |
| `minor` | 0.1.3 → 0.2.0 | New features, schema changes |
| `major` | 0.1.3 → 1.0.0 | Breaking changes |

## Workflow Details

### What Happens When You Run `make helm-bump-version`

1. **Version Calculation**: 
   - Reads current version from `demo/helm/summit-connect/Chart.yaml`
   - Calculates new version based on semantic versioning rules
   - Updates the Chart.yaml file

2. **Git Operations**:
   - Adds the modified Chart.yaml to git
   - Commits with message: "Bump Helm chart version to X.Y.Z"
   - Pushes to the current branch (typically `main`)

3. **CI/CD Trigger**:
   - GitHub Actions workflow detects the push
   - Packages the new chart version
   - Updates the Helm repository index
   - Publishes to GitHub Pages

4. **OpenShift Integration**:
   - Waits 10 seconds for GitHub Actions to start
   - Patches the OpenShift `HelmChartRepository` resource
   - Forces an immediate refresh of the chart catalog

### Prerequisites

- **yq**: YAML processor for version manipulation
  ```bash
  # macOS
  brew install yq
  
  # Ubuntu/Debian
  apt-get install yq
  ```

- **oc**: OpenShift CLI (optional, for repository refresh)
  ```bash
  # Download from OpenShift console or install via package manager
  ```

- **Git**: Configured with push access to the repository

## Configuration

The Makefile uses these configurable variables:

```makefile
HELM_CHART_DIR := demo/helm/summit-connect
HELM_CHART_FILE := $(HELM_CHART_DIR)/Chart.yaml
HELM_REPO_NAME := summit-connect-helm-repo-cluster
```

### Customization

To use with a different chart or repository:

```bash
# Custom chart directory
make helm-bump-version HELM_CHART_DIR=path/to/your/chart

# Custom OpenShift repository name
make helm-bump-version HELM_REPO_NAME=your-repo-name
```

## Error Handling

### Common Issues

1. **yq not installed**:
   ```
   Error: yq is required for version bumping but not installed.
   Install with: brew install yq (macOS) or apt-get install yq (Ubuntu)
   ```

2. **Chart file not found**:
   ```
   Error: Helm chart file not found: demo/helm/summit-connect/Chart.yaml
   ```

3. **OpenShift repository not found**:
   ```
   Warning: Helm repository summit-connect-helm-repo-cluster not found in cluster
   Available repositories: [list of available repos]
   ```

4. **Git push fails**:
   - Ensure you have push permissions to the repository
   - Check if you're on the correct branch
   - Verify git is properly configured

### Manual Recovery

If the automated process fails partway through:

1. **Check git status**: `git status`
2. **Review uncommitted changes**: `git diff`
3. **Manual commit if needed**: 
   ```bash
   git add demo/helm/summit-connect/Chart.yaml
   git commit -m "Bump Helm chart version to X.Y.Z"
   git push
   ```
4. **Manual OpenShift refresh**:
   ```bash
   oc patch helmchartrepository summit-connect-helm-repo-cluster \
     --type='merge' -p='{"metadata":{"annotations":{"force-refresh":"force"}}}'
   ```

## Integration with CI/CD

### GitHub Actions Workflow

The version bump triggers the existing `.github/workflows/helm-pages.yml` workflow:

1. **Chart Packaging**: Creates `.tgz` package from updated chart
2. **Release Creation**: Creates GitHub release with the new version tag
3. **Index Update**: Updates `index.yaml` with new chart metadata
4. **GitHub Pages**: Publishes updated repository to GitHub Pages

### Timeline

- **Immediate**: Version updated in git
- **~30 seconds**: GitHub Actions starts
- **~2 minutes**: Chart available in GitHub Pages repository
- **~3 minutes**: OpenShift picks up the new version (after forced refresh)

## Best Practices

1. **Use Semantic Versioning**: Follow semver rules for version bumps
2. **Test First**: Use `DRY_RUN=true` to preview changes
3. **Coordinate Changes**: Ensure chart changes are ready before bumping
4. **Monitor CI/CD**: Check GitHub Actions after version bumps
5. **Verify in OpenShift**: Confirm new version appears in Developer Catalog

## Examples

### Development Workflow

```bash
# 1. Make changes to Helm chart templates or values
vim demo/helm/summit-connect/templates/vm.yaml

# 2. Test changes locally
helm template test demo/helm/summit-connect

# 3. Preview version bump
make helm-bump-version DRY_RUN=true

# 4. Apply version bump
make helm-bump-version

# 5. Verify in OpenShift Developer Console
```

### Release Workflow

```bash
# Patch release (bug fixes)
make helm-bump-version BUMP_TYPE=patch

# Minor release (new features)
make helm-bump-version BUMP_TYPE=minor

# Major release (breaking changes)
make helm-bump-version BUMP_TYPE=major
```

## Monitoring and Verification

### Check GitHub Actions
https://github.com/cldmnky/summit-connect-stockholm-2025/actions

### Check OpenShift Repository Status
```bash
# List all Helm repositories
oc get helmchartrepositories

# Check specific repository
oc describe helmchartrepository summit-connect-helm-repo-cluster

# Check repository URL manually
curl -s https://cldmnky.github.io/summit-connect-stockholm-2025/index.yaml
```

### Verify in OpenShift Console
1. Navigate to **Developer** perspective
2. Go to **+Add** → **Helm Chart**
3. Look for "Summit Connect Stockholm 2025" repository
4. Verify new version is available

## Troubleshooting

### Version Not Appearing in OpenShift

1. **Check repository URL**:
   ```bash
   curl -I https://cldmnky.github.io/summit-connect-stockholm-2025/index.yaml
   ```

2. **Force refresh**:
   ```bash
   make helm-bump-version  # Will trigger refresh as part of the process
   ```

3. **Manual refresh**:
   ```bash
   oc patch helmchartrepository summit-connect-helm-repo-cluster \
     --type='merge' -p='{"metadata":{"annotations":{"force-refresh":"'$(date +%s)'"}}}'
   ```

### GitHub Actions Failed

1. Check the Actions tab in GitHub
2. Review workflow logs for errors
3. Re-run failed jobs if needed
4. Ensure Chart.yaml is valid: `helm lint demo/helm/summit-connect`

This automated system ensures consistent, reliable Helm chart releases with minimal manual intervention while maintaining full traceability through git history and CI/CD logs.