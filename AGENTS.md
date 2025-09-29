---
description: Enforces use of the Makefile
alwaysApply: true
---

Makefile Rule
=============

- **Always use the Makefile targets to run the server.**
- **Prefer the `make dev &` command.**
- **Run the dev server in the background.**

Makefile usage
--------------

Follow these quick instructions when running the application locally. The repository Makefile defines the canonical targets for starting, stopping and developing the server; use those targets rather than launching the binary directly.

Recommended (development, background):

```bash
# Start the dev server in the background (job control)
make dev &
```

Recommended (development, background with logs):

```bash
# Start the dev server and redirect stdout/stderr to the project log file
make dev > logs/server.log 2>&1 &
```

Run in the foreground (useful for debugging):

```bash
make dev
# stop with Ctrl-C
```

Stopping a backgrounded job

Use shell job control to list and stop background jobs:

```bash
jobs            # list background jobs
kill %1         # stop job number 1 (replace with the job id shown)
# or find PID and kill: ps aux | grep 'make' | grep dev
```

View logs (live):

```bash
tail -f logs/server.log
```

Notes:

- Always run Makefile targets from the repository root.
- If you need to run a different Makefile target, prefer naming the target explicitly (for example `make test` or `make build`) rather than running the underlying commands by hand.
- These instructions intentionally rely on standard shell job control so they work across macOS and Linux development environments.


description: Enforces PatternFly Vibe coding standards and documentation best practices for all PatternFly React code.
globs: "**/*.{js,jsx,ts,tsx,css,scss}"
alwaysApply: true
---

PatternFly Vibe Coding Rule
--------------------------

Purpose
-------

Always reference the README and markdown documentation in this repository when generating, editing, or reviewing any PatternFly (PF) code. These files contain the authoritative best practices, guidelines, and up-to-date standards for PatternFly development.

Scope
-----

This rule applies to all code generation, refactoring, and review tasks involving PatternFly React, PatternFly Chatbot, and related UI components in this project.

Documentation to Reference
-------------------------

- The root `README.md`
- The `.pf-ai-documentation/README.md` file, which serves as the table of contents for all documentation in the `.pf-ai-documentation/` directory and its subdirectories. Use this file to discover and navigate all relevant rules, guidelines, and best practices for PatternFly development.
- All markdown files referenced by `.pf-ai-documentation/README.md`.

Rule
----

- **Always consult the above documentation before generating or editing any PatternFly code.**
- **Use the documented best practices for component usage, styling, accessibility, and layout.**
- **Prefer semantic design tokens and utility classes as described in the docs.**
- **Follow accessibility and ARIA guidelines from the documentation.**
- **Reference official PatternFly components and avoid custom solutions unless explicitly allowed.**
- **If a question arises, search these docs first before using external sources.**

Example Prompt
--------------

> "When generating PatternFly code, use the guidelines and examples from all README and markdown files in this repository, especially those referenced in documentation/README.md. Follow the documented best practices for styling, accessibility, and component usage."

Enforcement
-----------

If code is generated or edited without following these documentation sources, request changes and point to the relevant section in the docs.

