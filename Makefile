SHELL := /bin/bash
PWD := $(shell pwd)

.PHONY: help build start stop dev status logs clean

LOG_DIR := logs
PID_DIR := .pids

help:
	@echo "Makefile targets:"
	@echo "  build          # build the Go application"
	@echo "  start          # start the backend server in background (with VM watcher)"
	@echo "  stop           # stop background processes"
	@echo "  dev            # start server with hot reloading and VM watcher (foreground)"
	@echo "  status         # show running processes"
	@echo "  logs           # tail server logs"
	@echo "  clean          # remove logs and pid files"
	@echo ""
	@echo "URLs:"
	@echo "  Frontend:      http://localhost:3001"
	@echo "  Backend API:   http://localhost:3001/api/v1"
	@echo "  Health:        http://localhost:3001/health"

build:
	@echo "Building Go application..."
	go build -o summit-connect
	@echo "Built summit-connect binary"

start: build
	@mkdir -p $(LOG_DIR) $(PID_DIR)
	@echo "Starting backend server (background)..."
	@nohup ./summit-connect serve backend --port 3001 --config ./config/datacenters.yaml --watch-vms > $(LOG_DIR)/server.log 2>&1 & echo $$! > $(PID_DIR)/server.pid
	@sleep 1
	@echo "Started. Server PID: `cat $(PID_DIR)/server.pid 2>/dev/null || echo -`"
	@echo "Logs: $(LOG_DIR)/server.log"
	@echo "Frontend: http://localhost:3001"
	@echo "Backend API: http://localhost:3001/api/v1"

dev:
	@echo "Starting development server with hot reloading..."
	@echo "Press Ctrl+C to stop"
	# remove default dev DB so each dev run starts fresh
	@if [ -f /tmp/summit-connect.db ]; then rm -f /tmp/summit-connect.db && echo "Removed existing /tmp/summit-connect.db"; fi
	# also remove the test DB used by quick runs
	@if [ -f /tmp/summit-viper-test.db ]; then rm -f /tmp/summit-viper-test.db && echo "Removed existing /tmp/summit-viper-test.db"; fi
	@which air > /dev/null 2>&1 || (echo "Installing air for hot reloading..." && go install github.com/air-verse/air@latest)
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
	@air

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
