# Global Makefile for FAELP - runs orgbackend, distbackend, and all frontends

# Directories
ORG_BACKEND_DIR=organization_backend
DIST_BACKEND_DIR=distribution_backend
USER_FRONTEND_DIR=frontend/user
ORGADMIN_FRONTEND_DIR=frontend/orgadmin
DISTADMIN_FRONTEND_DIR=frontend/distadmin
DISTRIBUTION_FRONTEND_DIR=frontend/distribution

.PHONY: dev dev-org dev-dist dev-all \
	install install-org install-dist \
	build build-org build-dist build-all \
	clean clean-org clean-dist clean-all \
	test test-org test-dist \
	setup setup-db help

# =============================================================================
# Development - Run everything
# =============================================================================

# Run orgbackend with user and orgadmin frontends
dev-org:
	@echo "Starting orgbackend with user and orgadmin frontends..."
	@(trap 'kill 0' SIGINT; \
		cd $(ORG_BACKEND_DIR) && go run ./cmd/server & \
		cd $(USER_FRONTEND_DIR) && npm run dev & \
		cd $(ORGADMIN_FRONTEND_DIR) && npm run dev & \
		wait)

# Run distbackend with distadmin and distribution frontends
dev-dist:
	@echo "Starting distbackend with distadmin and distribution frontends..."
	@(trap 'kill 0' SIGINT; \
		cd $(DIST_BACKEND_DIR) && go run ./cmd/server & \
		cd $(DISTADMIN_FRONTEND_DIR) && npm run dev & \
		cd $(DISTRIBUTION_FRONTEND_DIR) && npm run dev & \
		wait)

# Run EVERYTHING - both backends and all frontends
dev-all:
	@echo "Starting ALL backends and frontends..."
	@echo "This will run:"
	@echo "  - orgbackend (Go)"
	@echo "  - distbackend (Go)"
	@echo "  - user frontend (Vite)"
	@echo "  - orgadmin frontend (Vite)"
	@echo "  - distadmin frontend (Vite)"
	@echo "  - distribution frontend (Vite)"
	@echo ""
	@(trap 'kill 0' SIGINT; \
		cd $(ORG_BACKEND_DIR) && go run ./cmd/server & \
		cd $(DIST_BACKEND_DIR) && go run ./cmd/server & \
		cd $(USER_FRONTEND_DIR) && npm run dev & \
		cd $(ORGADMIN_FRONTEND_DIR) && npm run dev & \
		cd $(DISTADMIN_FRONTEND_DIR) && npm run dev & \
		cd $(DISTRIBUTION_FRONTEND_DIR) && npm run dev & \
		wait)

# Alias for dev-all
dev: dev-all

# =============================================================================
# Installation - Install dependencies
# =============================================================================

install-user:
	cd $(USER_FRONTEND_DIR) && npm install

install-orgadmin:
	cd $(ORGADMIN_FRONTEND_DIR) && npm install

install-distadmin:
	cd $(DISTADMIN_FRONTEND_DIR) && npm install

install-distribution:
	cd $(DISTRIBUTION_FRONTEND_DIR) && npm install

install-frontends: install-user install-orgadmin install-distadmin install-distribution

install-org:
	cd $(ORG_BACKEND_DIR) && go mod tidy
	$(MAKE) install-user install-orgadmin

install-dist:
	cd $(DIST_BACKEND_DIR) && go mod tidy
	$(MAKE) install-distadmin install-distribution

install: install-org install-dist
	@echo "All dependencies installed!"

# =============================================================================
# Build - Build all projects
# =============================================================================

build-user:
	cd $(USER_FRONTEND_DIR) && npm run build

build-orgadmin:
	cd $(ORGADMIN_FRONTEND_DIR) && npm run build

build-distadmin:
	cd $(DISTADMIN_FRONTEND_DIR) && npm run build

build-distribution:
	cd $(DISTRIBUTION_FRONTEND_DIR) && npm run build

build-org-backend:
	cd $(ORG_BACKEND_DIR) && go build -o bin/orgbackend ./cmd/server

build-dist-backend:
	cd $(DIST_BACKEND_DIR) && go build -o bin/distbackend ./cmd/server

build-frontends: build-user build-orgadmin build-distadmin build-distribution

build-org: build-org-backend build-user build-orgadmin

build-dist: build-dist-backend build-distadmin build-distribution

build-all: build-org build-dist
	@echo "All projects built!"

build: build-all

# =============================================================================
# Testing
# =============================================================================

test-org:
	cd $(ORG_BACKEND_DIR) && go test ./...

test-dist:
	cd $(DIST_BACKEND_DIR) && go test ./...

test: test-org test-dist

# =============================================================================
# Cleanup
# =============================================================================

clean-user:
	rm -rf $(USER_FRONTEND_DIR)/dist $(USER_FRONTEND_DIR)/node_modules

clean-orgadmin:
	rm -rf $(ORGADMIN_FRONTEND_DIR)/dist $(ORGADMIN_FRONTEND_DIR)/node_modules

clean-distadmin:
	rm -rf $(DISTADMIN_FRONTEND_DIR)/dist $(DISTADMIN_FRONTEND_DIR)/node_modules

clean-distribution:
	rm -rf $(DISTRIBUTION_FRONTEND_DIR)/dist $(DISTRIBUTION_FRONTEND_DIR)/node_modules

clean-org-backend:
	rm -rf $(ORG_BACKEND_DIR)/bin

clean-dist-backend:
	rm -rf $(DIST_BACKEND_DIR)/bin

clean-frontends: clean-user clean-orgadmin clean-distadmin clean-distribution

clean-org: clean-org-backend clean-user clean-orgadmin

clean-dist: clean-dist-backend clean-distadmin clean-distribution

clean-all: clean-org clean-dist
	@echo "All build artifacts cleaned!"

clean: clean-all

# =============================================================================
# Database Setup
# =============================================================================

setup-db-org:
	cd $(ORG_BACKEND_DIR) && ./scripts/setup_database.sh

setup-db-dist:
	cd $(DIST_BACKEND_DIR) && ./scripts/setup_database.sh

setup-db: setup-db-org setup-db-dist

# =============================================================================
# Full Setup
# =============================================================================

setup: install setup-db
	@echo "Full setup complete!"

# =============================================================================
# Help
# =============================================================================

help:
	@echo "FAELP Global Makefile"
	@echo "====================="
	@echo ""
	@echo "DEVELOPMENT (run with Ctrl+C to stop all):"
	@echo "  make dev         - Run ALL backends and frontends"
	@echo "  make dev-all     - Same as 'make dev'"
	@echo "  make dev-org     - Run orgbackend + user + orgadmin frontends"
	@echo "  make dev-dist    - Run distbackend + distadmin + distribution frontends"
	@echo ""
	@echo "INSTALLATION:"
	@echo "  make install         - Install all Go and npm dependencies"
	@echo "  make install-org     - Install orgbackend dependencies"
	@echo "  make install-dist    - Install distbackend dependencies"
	@echo "  make install-frontends - Install all frontend dependencies"
	@echo ""
	@echo "BUILD:"
	@echo "  make build         - Build all backends and frontends"
	@echo "  make build-org     - Build orgbackend and its frontends"
	@echo "  make build-dist    - Build distbackend and its frontends"
	@echo "  make build-all     - Same as 'make build'"
	@echo ""
	@echo "TESTING:"
	@echo "  make test          - Run all Go tests"
	@echo "  make test-org      - Run orgbackend tests"
	@echo "  make test-dist     - Run distbackend tests"
	@echo ""
	@echo "CLEANUP:"
	@echo "  make clean         - Clean all build artifacts"
	@echo "  make clean-org     - Clean orgbackend artifacts"
	@echo "  make clean-dist    - Clean distbackend artifacts"
	@echo ""
	@echo "DATABASE:"
	@echo "  make setup-db      - Setup all databases"
	@echo "  make setup-db-org  - Setup orgbackend database"
	@echo "  make setup-db-dist - Setup distbackend database"
	@echo ""
	@echo "FULL SETUP:"
	@echo "  make setup         - Install dependencies + setup databases"
