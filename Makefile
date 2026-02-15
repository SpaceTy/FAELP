# Global Makefile for FAELP - runs orgbackend, distbackend, and all frontends

# Directories
ORG_BACKEND_DIR=organization_backend
DIST_BACKEND_DIR=distribution_backend
USER_FRONTEND_DIR=frontend/user
ORGADMIN_FRONTEND_DIR=frontend/orgadmin
DISTADMIN_FRONTEND_DIR=frontend/distadmin
DISTRIBUTION_FRONTEND_DIR=frontend/distribution
DEPLOY_ORG_TEMPLATE_DIR=deployment/orgbackend/template
DEPLOY_ORG_CONTAINER_DIR=deployment/orgbackend/container

.PHONY: dev dev-org dev-dist dev-all dev-backends \
	install install-org install-dist \
	build build-org build-dist build-all \
	clean clean-org clean-dist clean-all \
	test test-org test-dist \
	deploy-org package-deploy-org \
	setup setup-db help

# =============================================================================
# Development - Run everything
# =============================================================================

# Run orgbackend with user and orgadmin frontends (backend-served)
dev-org:
	@echo "Building frontends..."
	cd $(USER_FRONTEND_DIR) && npm run build
	cd $(ORGADMIN_FRONTEND_DIR) && npm run build
	@echo "Starting orgbackend with served frontends..."
	cd $(ORG_BACKEND_DIR) && go run ./cmd/server

# Run distbackend with distadmin and distribution frontends (backend-served)
dev-dist:
	@echo "Building frontends..."
	cd $(DISTRIBUTION_FRONTEND_DIR) && npm run build
	cd $(DISTADMIN_FRONTEND_DIR) && npm run build
	@echo "Starting distbackend with served frontends..."
	cd $(DIST_BACKEND_DIR) && go run ./cmd/server

# Run EVERYTHING - both backends and all frontends (backend-served)
dev-all:
	@echo "Building all frontends..."
	cd $(USER_FRONTEND_DIR) && npm run build
	cd $(ORGADMIN_FRONTEND_DIR) && npm run build
	cd $(DISTRIBUTION_FRONTEND_DIR) && npm run build
	cd $(DISTADMIN_FRONTEND_DIR) && npm run build
	@echo "Starting ALL backends with served frontends..."
	@echo "This will run:"
	@echo "  - orgbackend (Go) on :8080/:8082"
	@echo "  - distbackend (Go) on :8081/:8083"
	@echo ""
	@(trap 'kill 0' SIGINT; \
		cd $(ORG_BACKEND_DIR) && go run ./cmd/server & \
		cd $(DIST_BACKEND_DIR) && go run ./cmd/server & \
		wait)

# Alias for dev-all
dev: dev-all

# Run both backends without building frontends (for development with dev servers)
dev-backends:
	@echo "Starting both backends (no frontend builds)..."
	@echo "  - orgbackend (Go) on :8080/:8082"
	@echo "  - distbackend (Go) on :8081/:8083"
	@echo ""
	@(trap 'kill 0' SIGINT; \
		cd $(ORG_BACKEND_DIR) && go run ./cmd/server & \
		cd $(DIST_BACKEND_DIR) && go run ./cmd/server & \
		wait)

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
# Deployment Packaging
# =============================================================================

package-deploy-org:
	@echo "Packaging org deployment bundle..."
	rm -rf $(DEPLOY_ORG_CONTAINER_DIR)
	mkdir -p $(DEPLOY_ORG_CONTAINER_DIR)/app/frontend/user
	mkdir -p $(DEPLOY_ORG_CONTAINER_DIR)/app/frontend/orgadmin
	cp -R $(DEPLOY_ORG_TEMPLATE_DIR)/. $(DEPLOY_ORG_CONTAINER_DIR)/
	cp $(ORG_BACKEND_DIR)/bin/orgbackend $(DEPLOY_ORG_CONTAINER_DIR)/app/orgbackend
	cp -R $(USER_FRONTEND_DIR)/dist $(DEPLOY_ORG_CONTAINER_DIR)/app/frontend/user/
	cp -R $(ORGADMIN_FRONTEND_DIR)/dist $(DEPLOY_ORG_CONTAINER_DIR)/app/frontend/orgadmin/
	chmod +x $(DEPLOY_ORG_CONTAINER_DIR)/scripts/entrypoint.sh
	chmod +x $(DEPLOY_ORG_CONTAINER_DIR)/scripts/setup_database.sh
	@echo "Org deployment bundle ready at $(DEPLOY_ORG_CONTAINER_DIR)"

deploy-org: build-org-backend build-user build-orgadmin package-deploy-org

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

clean-sockets:
	@echo "Cleaning up Unix sockets..."
	rm -f /tmp/org-backend.sock /tmp/dist-backend.sock

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

clean-all: clean-org clean-dist clean-sockets
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
	@echo "  make dev           - Run ALL backends with served frontends"
	@echo "  make dev-all       - Same as 'make dev'"
	@echo "  make dev-backends  - Run both backends without building frontends"
	@echo "  make dev-org       - Run orgbackend with user/orgadmin frontends on :8080/:8082"
	@echo "  make dev-dist      - Run distbackend with distribution/distadmin frontends on :8081/:8083"
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
	@echo "DEPLOYMENT:"
	@echo "  make deploy-org    - Build and package orgbackend deployment bundle"
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
