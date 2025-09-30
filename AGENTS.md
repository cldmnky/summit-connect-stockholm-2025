---
description: Authoritative guidance for AI agents and contributors. Contains Makefile-first rules and PatternFly conventions.
alwaysApply: true
globs: "**/*"
---

# AGENTS.md — Summit Connect (Stockholm 2025)

This file is the canonical instructions set for AI coding agents and humans working in this repository. It combines the VS Code "Use an AGENTS.md file" guidance, the agents.md open standard, and project-specific rules (notably: always prefer Makefile targets).

Use this file to discover:

- What tasks are allowed and how to run them (Makefile targets).
- Which tools are preferred for which tasks (air, ko, podman, npm/playwright, go).
- Project-specific conventions (PatternFly frontend rules, security, and testing requirements).

If you are an automated agent, obey `alwaysApply: true` rules and the Makefile-first policy. If in doubt, prefer the Makefile target over invoking tools directly.

## Why this exists

VS Code's experimental guidance and the agents.md standard recommend a single authoritative file for agent instructions. This file:

- Exposes critical project targets and tools.
- Forces reproducible workflows through the Makefile.
- Documents where to find external docs and how to query them (Tavily / Context7 / web).

## Quick rules (read first)

- Always use the Makefile targets from the repository root. Prefer `make dev &` for iterative development.
- When a Makefile target calls a tool, prefer using that tool via the target (e.g., `make build-container-local`) unless you need an advanced use-case.
- For frontend PatternFly work, consult the repo's README and `.pf-ai-documentation` before generating UI code.
- Avoid making network requests or exfiltrating secrets. Use provided kubeconfigs or test stubs.

## How AI agents should use this file

This file follows the agents.md and VS Code recommendations. Agents should read the top metadata and honor `alwaysApply` rules. Useful metadata keys used here:

- `description` — brief purpose for this AGENTS.md file.
- `globs` — files the rules apply to.
- `alwaysApply` — boolean; if true, the agent must enforce the rule.

Agents should also:

- Check the Makefile for canonical commands and map their internal tool invocations to high-level tasks listed below.
- When external documentation is required, prefer structured, indexed sources first (Context7 / Tavily). If you must browse the web, cite URLs.

## Makefile tool assignment

The project's Makefile defines the authoritative mapping from tasks to tools. Use these mappings when performing actions.

- `make dev` → air (hot reload) — development server with live rebuilds and VM watcher. Prefer `make dev &` for background runs.
- `make build` → `go build` — compile the Go binary `bin/summit-connect`.
- `make test-go` → `go test -v ./...` — Go unit tests.
- `make test-e2e` → builds, starts backend, then uses npm/Playwright to run e2e tests. Ensure Node/npm and Playwright browsers are installed.
- `make test` → runs `test-go` then `test-e2e`.
- `make tools` → installs dev tools locally into `bin/` (ko and air via `go install`). Use this to ensure `ko` and `air` are available.
- `make build-container` / `make build-container-local` → ko (github.com/google/ko) — builds multi-arch container images. `build-container` pushes to IMAGE_REGISTRY, `build-container-local` produces `ko.local/...` images.
- `make run-container` / `make stop-container` → podman (or Docker) — run images locally with mounts (`config`, `.kubeconfigs`). The Makefile uses `podman run`.
- `make logs` → tail logs in `logs/server.log`.
- `make start` / `make stop` / `make status` → run/stop the backend binary via pid files and `nohup`.

Agents should not bypass these targets unless instructed by a human reviewer. When a human explicitly requests a different command, document why you're diverging.

## Documentation queries (Tavily & Context7 guidance)

When you need up-to-date documentation or package-specific docs:

- Prefer Context7-style library docs (Context7-compatible IDs) if you need authoritative library docs for code generation — e.g., `mcp_upstash_conte_resolve-library-id` then `mcp_upstash_conte_get-library-docs` for deep API docs.
- Use Tavily search for broad web searches and recent articles: it returns clean, relevant results (use `mcp_tavily_tavily-search`).
- When you consult external docs, include the URL and the exact sections you used.

Examples:

- To find ko usage examples: query Context7 for `/google/ko` or use Tavily to search "google ko build --platform ko.local examples".
- To find Playwright usage: Tavily or direct Playwright docs are acceptable.

If your toolchain includes local wrappers for these services, prefer them over web searches.

## Contract for automated edits

- **Inputs**: Makefile target name, repository root path, optional flags (e.g. dev/background).
- **Outputs**: Terminal output, modified files (if any), logs.
- **Error modes**: missing binaries (ko/air/npm), missing kubeconfigs, container runtime missing, failing tests. When error occurs, stop and report clearly with reproduction steps.

Edge cases to handle:

- Node/npm not installed on host but required for e2e: detect and report, do not attempt to install globally.
- podman not available: fall back to Docker where possible, but document the decision.
- Insufficient permissions to write bin/ or install tools: report actionable steps (use `make tools` and set LOCALBIN or GOBIN accordingly).

## Development workflow

1. Install local tools: `make tools` (installs `ko` and `air` into `bin/` by default).
2. Start dev server with hot reload in background:

   ```bash
   make dev &
   ```

3. Run Go unit tests frequently:

   ```bash
   make test-go
   ```

4. For UI or integration changes, run e2e:

   ```bash
   make test-e2e
   ```

5. Build local container for testing:

   ```bash
   make build-container-local
   make run-container
   ```

6. Before committing:

   ```bash
   make test
   make build
   ```

## PatternFly / Frontend guidance

- Always consult the repo READMEs and `.pf-ai-documentation` before adding or modifying PatternFly components.
- Prefer official PatternFly components over custom implementations. Watch for accessibility (a11y) and ARIA attributes.
- Keep styling in `styles.css` or component-specific CSS and use CSS custom properties for theming.

## Testing & CI guidance

- Unit tests: `make test-go`.
- E2E tests: `make test-e2e` (requires Node/npm and Playwright browsers). The Makefile handles npm install and Playwright install as needed.
- CI pipelines should run `make test` and `make build-container` where appropriate.

## Security and secrets

- Never commit secrets to the repo. Use `.kubeconfigs` and mounted secrets for runtime.
- Containers should run non-root where possible and use minimal base images.
- Run vulnerability scans on built images (outside the Makefile steps) and keep dependencies updated.

## Troubleshooting

- **npm is required for e2e tests but not installed** — install Node.js locally, or run `make test-e2e` on a machine with Node/npm.
- **Missing `ko` or `air`** — run `make tools` to install into `./bin` or set `LOCALBIN`/`GOBIN`.
- **Podman missing** — switch to Docker or run container steps in a supported environment.
- **Failing to start server in `make dev`** — view `logs/server.log` or run `make dev` in the foreground to inspect build errors.

## Contributing

- Create a feature branch from `main`.
- Keep changes focused and add tests for behavior changes.
- Run `make test` locally before opening a PR.
- Use clear commit messages and reference issues when applicable.

## References

- VS Code: [Use an AGENTS.md file](https://code.visualstudio.com/docs/copilot/customization/custom-instructions#_use-an-agentsmd-file-experimental)
- agents.md open standard: [agents.md](https://agents.md/)

---

Always prefer the Makefile. If you need me to expand or make the file stricter (for example adding enforced globs or additional metadata fields), tell me which rules you want to lock and I will update `AGENTS.md` accordingly.

