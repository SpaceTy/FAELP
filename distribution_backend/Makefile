APP_NAME=distbackend
CMD_PATH=./cmd/server
DISTADMIN_FRONTEND_PATH=../frontend/distadmin
DISTRIBUTION_FRONTEND_PATH=../frontend/distribution

.PHONY: build run test tidy \
	install-distadmin build-distadmin run-distadmin preview-distadmin dev-distadmin \
	install-distribution build-distribution run-distribution preview-distribution dev-distribution \
	dev-all build-all setup clean help

# Backend targets
build:
	go build -o bin/$(APP_NAME) $(CMD_PATH)

run:
	go run $(CMD_PATH)

test:
	go test ./...

tidy:
	go mod tidy

# Distadmin frontend targets
install-distadmin:
	cd $(DISTADMIN_FRONTEND_PATH) && npm install

build-distadmin:
	cd $(DISTADMIN_FRONTEND_PATH) && npm run build

run-distadmin:
	cd $(DISTADMIN_FRONTEND_PATH) && npm run dev

preview-distadmin:
	cd $(DISTADMIN_FRONTEND_PATH) && npm run preview

# Distribution frontend targets (optional until frontend exists)
install-distribution:
	@if [ -f "$(DISTRIBUTION_FRONTEND_PATH)/package.json" ]; then \
		cd $(DISTRIBUTION_FRONTEND_PATH) && npm install; \
	else \
		echo "Skipping install-distribution: $(DISTRIBUTION_FRONTEND_PATH)/package.json not found"; \
	fi

build-distribution:
	@if [ -f "$(DISTRIBUTION_FRONTEND_PATH)/package.json" ]; then \
		cd $(DISTRIBUTION_FRONTEND_PATH) && npm run build; \
	else \
		echo "Skipping build-distribution: $(DISTRIBUTION_FRONTEND_PATH)/package.json not found"; \
	fi

run-distribution:
	@if [ -f "$(DISTRIBUTION_FRONTEND_PATH)/package.json" ]; then \
		cd $(DISTRIBUTION_FRONTEND_PATH) && npm run dev; \
	else \
		echo "Skipping run-distribution: $(DISTRIBUTION_FRONTEND_PATH)/package.json not found"; \
	fi

preview-distribution:
	@if [ -f "$(DISTRIBUTION_FRONTEND_PATH)/package.json" ]; then \
		cd $(DISTRIBUTION_FRONTEND_PATH) && npm run preview; \
	else \
		echo "Skipping preview-distribution: $(DISTRIBUTION_FRONTEND_PATH)/package.json not found"; \
	fi

# Combined development targets
dev-distadmin:
	cd $(DISTADMIN_FRONTEND_PATH) && npm run dev

dev-distribution:
	@if [ -f "$(DISTRIBUTION_FRONTEND_PATH)/package.json" ]; then \
		cd $(DISTRIBUTION_FRONTEND_PATH) && npm run dev; \
	else \
		echo "Skipping dev-distribution: $(DISTRIBUTION_FRONTEND_PATH)/package.json not found"; \
	fi

# Run backend and dist frontends concurrently (development)
dev-all:
	@echo "Starting backend, distadmin frontend, and distribution frontend..."
	@(trap 'kill 0' SIGINT; go run $(CMD_PATH) & make dev-distadmin & make dev-distribution & wait)

# Build backend and dist frontends
build-all: build build-distadmin build-distribution

# Database setup
setup-db:
	./scripts/setup_database.sh

# Full setup: tidy go modules and install frontend dependencies
setup: tidy install-distadmin install-distribution

# Clean build artifacts
clean:
	rm -rf bin/
	rm -rf $(DISTADMIN_FRONTEND_PATH)/dist/ $(DISTADMIN_FRONTEND_PATH)/node_modules/ 2>/dev/null || true
	rm -rf $(DISTRIBUTION_FRONTEND_PATH)/dist/ $(DISTRIBUTION_FRONTEND_PATH)/node_modules/ 2>/dev/null || true

# Help target
help:
	@echo "Available targets:"
	@echo "  Backend:"
	@echo "    build          - Build the backend binary"
	@echo "    run            - Run the backend server"
	@echo "    test           - Run Go tests"
	@echo "    tidy           - Run go mod tidy"
	@echo ""
	@echo "  Distadmin Frontend:"
	@echo "    install-distadmin    - Install distadmin npm dependencies"
	@echo "    build-distadmin      - Build distadmin frontend"
	@echo "    run-distadmin        - Run distadmin dev server (alias: dev-distadmin)"
	@echo "    preview-distadmin    - Preview distadmin production build"
	@echo ""
	@echo "  Distribution Frontend:"
	@echo "    install-distribution - Install distribution frontend npm dependencies (if present)"
	@echo "    build-distribution   - Build distribution frontend (if present)"
	@echo "    run-distribution     - Run distribution dev server (alias: dev-distribution, if present)"
	@echo "    preview-distribution - Preview distribution production build (if present)"
	@echo ""
	@echo "  Database:"
	@echo "    setup-db       - Run database setup script"
	@echo ""
	@echo "  Combined:"
	@echo "    dev-all        - Run backend and dist frontends concurrently (development)"
	@echo "    build-all      - Build backend and dist frontends"
	@echo "    setup          - Setup project (tidy + frontend installs)"
	@echo "    clean          - Remove build artifacts"
