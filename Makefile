SHELL := /bin/bash
PWD := $(shell pwd)

.PHONY: help build test test-go test-e2e build-container build-container-local run-container stop-container start stop dev status logs clean tools ko air

# Local bin directory for tools
LOCALBIN ?= $(shell pwd)/bin
$(LOCALBIN):
	mkdir -p $(LOCALBIN)

LOG_DIR := logs
PID_DIR := .pids
IMAGE_REGISTRY := quay.io/cldmnky/summit-connect-stockholm-2025

# Tool Binaries
KO ?= $(LOCALBIN)/ko
AIR ?= $(LOCALBIN)/air

help:
	@echo "Makefile targets:"
	@echo "  build          # build the Go application"
	@echo "  test           # run all tests (Go unit tests + e2e tests)"
	@echo "  test-go        # run Go unit tests only"
	@echo "  test-e2e       # run e2e tests only"
	@echo "  build-container # build and push multi-arch container images using ko"
	@echo "  build-container-local # build container image locally (no push)"
	@echo "  run-container  # build and run container locally with config mounts"
	@echo "  stop-container # stop and remove the running container"
	@echo "  start          # start the backend server in background (with VM watcher)"
	@echo "  stop           # stop background processes"
	@echo "  dev            # start server with hot reloading and VM watcher (foreground)"
	@echo "  status         # show running processes"
	@echo "  logs           # tail server logs"
	@echo "  clean          # remove logs and pid files"
	@echo "  tools          # install all dev tools locally"
	@echo ""
	@echo "URLs:"
	@echo "  Frontend:      http://localhost:3001"
	@echo "  Backend API:   http://localhost:3001/api/v1"
	@echo "  Health:        http://localhost:3001/health"

build:
	@echo "Building Go application..."
	go build -o bin/summit-connect
	@echo "Built summit-connect binary"

test: test-go test-e2e
	@echo "All tests completed successfully!"

test-go:
	@echo "Running Go unit tests..."
	@go test -v ./...
	@echo "Go unit tests completed."

test-e2e: | build start
	@echo "Running e2e tests..."
	@echo "Waiting for server to be ready..."
	@sleep 2
	@if ! command -v npm >/dev/null 2>&1; then \
		echo "npm is required for e2e tests but not installed."; \
		echo "Please install Node.js and npm to run e2e tests."; \
		make stop; \
		exit 1; \
	fi
	@if [ ! -f package.json ]; then \
		echo "package.json not found. Cannot run e2e tests."; \
		make stop; \
		exit 1; \
	fi
	@if [ ! -d node_modules ]; then \
		echo "Installing npm dependencies..."; \
		npm install; \
	fi
	@if [ ! -d node_modules/@playwright ]; then \
		echo "Installing Playwright browsers..."; \
		npm run test:install; \
	fi
	@echo "Starting e2e test execution..."
	@npm run test:e2e || (echo "E2E tests failed"; make stop; exit 1)
	@make stop
	@echo "E2E tests completed."

build-container: ko
	@echo "Building multi-architecture container images with ko..."
	@echo "Building and pushing for aarch64 and amd64 architectures to $(IMAGE_REGISTRY)"
	KO_DOCKER_REPO=$(IMAGE_REGISTRY) $(KO) build --platform=linux/amd64,linux/arm64 --bare .
	@echo "Container images built and pushed successfully"

build-container-local: ko
	@echo "Building local multi-arch container image with ko..."
	KO_DOCKER_REPO=ko.local $(KO) build --platform=linux/amd64,linux/arm64 --preserve-import-paths .
	@echo "Local multi-arch container image built: ko.local/$(shell basename $(PWD))"

run-container: | build-container-local ## Run container locally with config and kubeconfig mounts
	@echo "Running container with config and kubeconfig mounts..."
	podman stop summit-connect 2>/dev/null || true
	podman rm summit-connect 2>/dev/null || true
	@echo "Starting new container..."
	podman run -d --name summit-connect \
		-p 3001:3001 \
		--tmpfs /tmp \
		-v $(PWD)/config:/config:ro \
		-v $(PWD)/.kubeconfigs:/.kubeconfigs:ro \
		ko.local/github.com/cldmnky/summit-connect-stockholm-2025:latest \
		serve backend --port 3001 --config /config/datacenters.yaml --watch-vms
	@echo "Container started. Waiting for startup..."
	@sleep 3
	@echo "Container logs:"
	@podman logs summit-connect 2>/dev/null || echo "No logs available yet"
	@echo ""
	@echo "Container is running at: http://localhost:3001"
	@echo "To stop: make stop-container"

build-container-arm64: $(KO) ## Build ARM64-only container for local testing
	@echo "Building ARM64 container image with ko..."
	KO_DOCKER_REPO=ko.local $(KO) build --platform=linux/arm64 --preserve-import-paths . --tags=arm64
	@echo "ARM64 container image built: ko.local/summit-connect-stockholm-2025:arm64"

run-container-arm64: | build-container-arm64 ## Run ARM64 container locally with config and kubeconfig mounts
	@echo "Running ARM64 container with config and kubeconfig mounts..."
	podman stop summit-connect 2>/dev/null || true
	podman rm summit-connect 2>/dev/null || true
	@echo "Starting new ARM64 container..."
	podman run -d --name summit-connect \
		--platform=linux/arm64 \
		-p 3001:3001 \
		--tmpfs /tmp \
		-v $(PWD)/config:/config:ro \
		-v $(PWD)/.kubeconfigs:/.kubeconfigs:ro \
		ko.local/github.com/cldmnky/summit-connect-stockholm-2025:arm64 \
		serve backend --port 3001 --config /config/datacenters.yaml --watch-vms
	@echo "Container started. Waiting for startup..."
	@sleep 3
	@echo "Container logs:"
	@podman logs summit-connect 2>/dev/null || echo "No logs available yet"
	@echo ""
	@echo "Container is running at: http://localhost:3001"
	@echo "To stop: make stop-container"

stop-container:
	@echo "Stopping and removing summit-connect container..."
	@-podman stop summit-connect 2>/dev/null || echo "Container not running"
	@-podman rm summit-connect 2>/dev/null || echo "Container not found"
	@echo "Container stopped and removed"

start: build
	@mkdir -p $(LOG_DIR) $(PID_DIR)
	@echo "Starting backend server (background)..."
	@nohup ./bin/summit-connect serve backend --port 3001 --config ./config/datacenters.yaml --watch-vms > $(LOG_DIR)/server.log 2>&1 & echo $$! > $(PID_DIR)/server.pid
	@sleep 1
	@echo "Started. Server PID: `cat $(PID_DIR)/server.pid 2>/dev/null || echo -`"
	@echo "Logs: $(LOG_DIR)/server.log"
	@echo "Frontend: http://localhost:3001"
	@echo "Backend API: http://localhost:3001/api/v1"

dev: air
	@echo "Starting development server with hot reloading..."
	@echo "Press Ctrl+C to stop"
	# remove default dev DB so each dev run starts fresh
	@if [ -f /tmp/summit-connect.db ]; then rm -f /tmp/summit-connect.db && echo "Removed existing /tmp/summit-connect.db"; fi
	# also remove the test DB used by quick runs
	@if [ -f /tmp/summit-viper-test.db ]; then rm -f /tmp/summit-viper-test.db && echo "Removed existing /tmp/summit-viper-test.db"; fi
	@if [ ! -f .air.toml ]; then \
		echo "Creating .air.toml configuration..."; \
		echo 'root = "."' > .air.toml; \
		echo 'testdata_dir = "testdata"' >> .air.toml; \
		echo 'tmp_dir = "tmp"' >> .air.toml; \
		echo '' >> .air.toml; \
		echo '[build]' >> .air.toml; \
		echo '  args_bin = ["serve", "backend", "--port", "3001", "--config", "./config/datacenters.yaml", "--watch-vms"]' >> .air.toml; \
		echo '  bin = "./tmp/main"' >> .air.toml; \
		echo '  cmd = "go build -o ./tmp/main ."' >> .air.toml; \
		echo '  delay = 1000' >> .air.toml; \
		echo '  exclude_dir = ["assets", "tmp", "vendor", "testdata", "frontend/node_modules", ".git", ".pids", "logs"]' >> .air.toml; \
		echo '  exclude_file = []' >> .air.toml; \
		echo '  exclude_regex = ["_test.go"]' >> .air.toml; \
		echo '  exclude_unchanged = false' >> .air.toml; \
		echo '  follow_symlink = false' >> .air.toml; \
		echo '  full_bin = ""' >> .air.toml; \
		echo '  include_dir = []' >> .air.toml; \
		echo '  include_ext = ["go", "tpl", "tmpl", "html", "js", "css"]' >> .air.toml; \
		echo '  include_file = []' >> .air.toml; \
		echo '  kill_delay = "0s"' >> .air.toml; \
		echo '  log = "build-errors.log"' >> .air.toml; \
		echo '  rerun = false' >> .air.toml; \
		echo '  rerun_delay = 500' >> .air.toml; \
		echo '  send_interrupt = false' >> .air.toml; \
		echo '  stop_on_root = false' >> .air.toml; \
		echo '' >> .air.toml; \
		echo '[color]' >> .air.toml; \
		echo '  app = ""' >> .air.toml; \
		echo '  build = "yellow"' >> .air.toml; \
		echo '  main = "magenta"' >> .air.toml; \
		echo '  runner = "green"' >> .air.toml; \
		echo '  watcher = "cyan"' >> .air.toml; \
		echo '' >> .air.toml; \
		echo '[log]' >> .air.toml; \
		echo '  main_only = false' >> .air.toml; \
		echo '  time = false' >> .air.toml; \
		echo '' >> .air.toml; \
		echo '[misc]' >> .air.toml; \
		echo '  clean_on_exit = false' >> .air.toml; \
	fi
	@$(AIR)

stop:
	@if [ -f $(PID_DIR)/server.pid ]; then \
		PID=$$(cat $(PID_DIR)/server.pid); \
		echo "Stopping server PID $$PID"; \
		if kill -0 $$PID 2>/dev/null; then kill $$PID; else echo "Process $$PID not running"; fi; \
		rm -f $(PID_DIR)/server.pid; \
	fi
	@echo "Stopped."

status:
	@echo "Server PID: `cat $(PID_DIR)/server.pid 2>/dev/null || echo "not running"`"
	@if [ -f $(PID_DIR)/server.pid ]; then \
		PID=$$(cat $(PID_DIR)/server.pid); \
		if kill -0 $$PID 2>/dev/null; then \
			echo "Server is running on http://localhost:3001"; \
		else \
			echo "Server PID file exists but process is not running"; \
		fi; \
	fi

logs:
	@mkdir -p $(LOG_DIR)
	@tail -n 200 -f $(LOG_DIR)/server.log || true

clean:
	@rm -rf $(LOG_DIR) $(PID_DIR) tmp build-errors.log
	@echo "Cleaned logs, pid files, and temporary files."

restart: stop start

##@ Build Dependencies

## Install development tools
tools: ko air

## Download ko locally if necessary
.PHONY: ko
ko: $(KO)
$(KO): $(LOCALBIN)
	test -s $(LOCALBIN)/ko || GOBIN=$(LOCALBIN) go install github.com/google/ko@latest

## Download air locally if necessary
.PHONY: air
air: $(AIR)
$(AIR): $(LOCALBIN)
	test -s $(LOCALBIN)/air || GOBIN=$(LOCALBIN) go install github.com/air-verse/air@latest
