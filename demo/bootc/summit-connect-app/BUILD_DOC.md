# Build documentation — virt-corp-summit-app

This document describes the Shipwright `Build` and `BuildRun` manifests in this directory, how they map to the in-cluster build behavior, and the recommended commands and troubleshooting steps to build and push the image.

Files

- `build.yaml` — Shipwright `Build` resource. Defines source, build strategy, and output image.

- `buildrun.yaml` — Shipwright `BuildRun` resource. Triggers a one-off execution of the `Build`.

High-level contract

- Inputs: Git repository (this repository), branch `feature/demo` (set in `build.yaml`), Dockerfile/Dockerfile-equivalent at the context root.

- Output: image `quay.io/cldmnky/virt-corp-summit-app:latest` pushed to quay.io.

- Success criteria: BuildRun completes with Succeeded condition and image appears in quay.io.

Key fields in `build.yaml`

- `apiVersion`, `kind`, `metadata` — standard k8s/Shipwright meta. `namespace` must match where you run BuildRun.

- `spec.source.git.url` — git URL to clone. `spec.source.git.revision` set to `feature/demo` to build that branch.

- `spec.source.contextDir` — path inside the repo used for the build context (here: `.`).

- `spec.strategy.name` & `spec.strategy.kind` — which strategy to use (this repo uses `buildah` as a ClusterBuildStrategy). `strategyRef` is also present for compatibility across Shipwright versions.

- `spec.output.image` — fully qualified image name to push to (quay.io/...)

Key fields in `buildrun.yaml`

- `spec.buildRef.name` — references the `Build` name.

- `spec.serviceAccount.serviceAccountName` — the ServiceAccount used by the build pod. That SA should have the pull/push secret in the same namespace.

- `spec.timeout` — build timeout (example: `30m`).

Secrets and authentication (OpenShift / Shipwright guidance)

- Build pods need registry credentials to pull builder images (e.g. `registry.redhat.io/ubi9/go-toolset`) and to push the resulting image to the target registry (quay.io). Provide a `kubernetes.io/dockerconfigjson` secret containing both entries.

- The repo contains a helper script `make-quay-push-secret.sh` which builds a combined dockerconfigjson from `~/.config/containers/auth.json` (podman/login). It now includes both `quay.io` and `registry.redhat.io` entries and annotates the secret with:

  - `build.shipwright.io/referenced.secret: "true"`

- Put the secret in the same namespace as your Build/BuildRun (default used in the scripts: `summit-connect-demo`).

- Link the secret to the ServiceAccount so builder pods can mount/use it:

  oc apply -f shipwright-builder-sa.yaml

  oc secrets link shipwright-builder quay-push-secret -n summit-connect-demo --for=pull,push

How to run (one-time)

1. Generate & apply the annotated secret (defaults to `summit-connect-demo`):

  ```bash
  ./make-quay-push-secret.sh --apply
  ```

1. Ensure ServiceAccount and RBAC are applied:

  ```bash
  oc apply -f shipwright-builder-sa.yaml
  oc apply -f shipwright-builder-rolebinding.yaml
  ```

1. Apply/refresh the Build resource and trigger a BuildRun:

  ```bash
  oc apply -f build.yaml
  oc delete buildrun virt-corp-summit-app-buildrun -n summit-connect-demo --ignore-not-found
  oc apply -f buildrun.yaml
  ```

1. Watch status and logs:

  ```bash
  oc get buildruns.shipwright.io -n summit-connect-demo
  oc get build virt-corp-summit-app -n summit-connect-demo -o yaml
  oc get pods -n summit-connect-demo
  oc logs -f <build-pod-name> -n summit-connect-demo --container=step-build-and-push
  ```

Troubleshooting (common failures seen and fixes)

- BuildStrategyNotFound

  - Symptom: Build status says strategy not found in namespace.

  - Fix: Use `spec.strategy.kind: ClusterBuildStrategy` and optionally `spec.strategyRef` pointing to `buildah`. Ensure cluster has `clusterbuildstrategies.shipwright.io` named `buildah`.

- DockerfileNotFound

  - Symptom: BuildRun failure: Dockerfile 'Dockerfile' does not exist.

  - Fix: Ensure a `Dockerfile` (or `Containerfile`) is present at the `contextDir` root. This repo includes a repo-root `Dockerfile` (and `Containerfile`) so the builder finds it.

- Unauthorized pulling Red Hat builder image

  - Symptom: build pod logs show "unable to retrieve auth token: invalid username/password" when pulling `registry.redhat.io/...`.

  - Fix: Add `registry.redhat.io` credentials to your `.dockerconfigjson` secret (the helper script adds it). Ensure the secret is present and linked to the ServiceAccount (imagePullSecrets / secrets field). Re-run the BuildRun.

- Go build: VCS stamping error

  - Symptom: "error obtaining VCS status" during `go build`.

  - Fix: Use `go build -buildvcs=false` in the Dockerfile or configure your build to set VCS info. This repository's `Containerfile` builds with `-buildvcs=false`.

- Go build: permission denied when writing binary

  - Symptom: "open /workspace/summit-connect: permission denied" during build.

  - Fix: Build artifacts to a writable location in the builder (e.g., `/tmp/bin`). This repo's `Containerfile` copies source to `/tmp/src` and outputs binary to `/tmp/bin` to avoid permission issues.

- Buildah push auth

  - Symptom: Build succeeds but push fails when Buildah tries to push using an auth format it doesn't accept.

  - Fix: Convert the mounted secret into a JSON authfile before pushing (example in docs): copy `.dockercfg` and wrap it into `{ "auths": ... }` and pass `--authfile /tmp/.dockercfg.json` to buildah push.

Notes and tips

- Keep namespace consistent: secret, SA, RBAC, Build, and BuildRun must be in the same namespace.

- If your cluster already has a global pull/push secret configured by the cluster admin, you may not need to create a per-namespace secret; check cluster policies first.

- If you want Shipwright to build a specific Dockerfile filename, ensure the file name matches the expectation or adjust the build strategy/task to pass `-f`/`--file` args.

Summary

- `build.yaml` declares how to build (source, branch, strategy, output), `buildrun.yaml` executes it. The primary operational tasks are: ensure the combined dockerconfigjson secret includes both `quay.io` and `registry.redhat.io`, annotate it with `build.shipwright.io/referenced.secret: "true"`, link it to the `shipwright-builder` ServiceAccount in `summit-connect-demo`, apply Build/BuildRun, and watch logs.
