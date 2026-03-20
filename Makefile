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
DEPLOY_DIST_TEMPLATE_DIR=deployment/distbackend/template
DEPLOY_DIST_CONTAINER_DIR=deployment/distbackend/container
DEPLOY_ORG_ENV_DEV=deployment/orgbackend/.env.dev
DEPLOY_DIST_ENV_DEV=deployment/distbackend/.env.dev
DEPLOY_ORG_ENV_DEV_TEMPLATE=$(DEPLOY_ORG_TEMPLATE_DIR)/.env.dev
DEPLOY_DIST_ENV_DEV_TEMPLATE=$(DEPLOY_DIST_TEMPLATE_DIR)/.env.dev

# Remote deployment settings (override with: make rsync-deploy DEPLOY_HOST=...)
DEPLOY_HOST?=apply.tysmp.com
DEPLOY_USER?=$(USER)
DEPLOY_REMOTE_PATH?=/home/st/fae

.PHONY: dev dev-org dev-dist dev-all dev-backends \
	install install-org install-dist npsetup \
	build build-org build-dist build-all \
	clean clean-org clean-dist clean-all \
	test test-org test-dist \
	deploy-org package-deploy-org \
	deploy-dist package-deploy-dist \
	rsync-deploy \
	cont cont-org cont-dist \
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

npsetup: install-frontends

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
	rsync -a --exclude='assets/material' $(USER_FRONTEND_DIR)/dist/ $(DEPLOY_ORG_CONTAINER_DIR)/app/frontend/user/dist/
	rsync -a --exclude='assets/material' $(ORGADMIN_FRONTEND_DIR)/dist/ $(DEPLOY_ORG_CONTAINER_DIR)/app/frontend/orgadmin/dist/
	ENV_SRC=""; \
	if [ -f $(DEPLOY_ORG_ENV_DEV) ]; then \
		ENV_SRC="$(DEPLOY_ORG_ENV_DEV)"; \
	elif [ -f $(DEPLOY_ORG_ENV_DEV_TEMPLATE) ]; then \
		ENV_SRC="$(DEPLOY_ORG_ENV_DEV_TEMPLATE)"; \
	fi; \
	if [ -n "$$ENV_SRC" ]; then \
		cp "$$ENV_SRC" $(DEPLOY_ORG_CONTAINER_DIR)/.env; \
		echo "Loaded org deployment env from $$ENV_SRC"; \
	elif [ -f $(DEPLOY_ORG_CONTAINER_DIR)/.env.example ]; then \
		cp $(DEPLOY_ORG_CONTAINER_DIR)/.env.example $(DEPLOY_ORG_CONTAINER_DIR)/.env; \
		echo "No org .env.dev found, using template defaults"; \
	fi
	rm -f $(DEPLOY_ORG_CONTAINER_DIR)/.env.example
	rm -f $(DEPLOY_ORG_CONTAINER_DIR)/.env.dev
	chmod +x $(DEPLOY_ORG_CONTAINER_DIR)/scripts/entrypoint.sh
	chmod +x $(DEPLOY_ORG_CONTAINER_DIR)/scripts/setup_database.sh
	@echo "Org deployment bundle ready at $(DEPLOY_ORG_CONTAINER_DIR)"

deploy-org: build-org-backend build-user build-orgadmin package-deploy-org
	/home/st/Documents/coding/faeenv/distribute-env.sh

package-deploy-dist:
	@echo "Packaging dist deployment bundle..."
	rm -rf $(DEPLOY_DIST_CONTAINER_DIR)
	mkdir -p $(DEPLOY_DIST_CONTAINER_DIR)/app/frontend/distribution
	mkdir -p $(DEPLOY_DIST_CONTAINER_DIR)/app/frontend/distadmin
	cp -R $(DEPLOY_DIST_TEMPLATE_DIR)/. $(DEPLOY_DIST_CONTAINER_DIR)/
	cp $(DIST_BACKEND_DIR)/bin/distbackend $(DEPLOY_DIST_CONTAINER_DIR)/app/distbackend
	rsync -a --exclude='assets/material' $(DISTRIBUTION_FRONTEND_DIR)/dist/ $(DEPLOY_DIST_CONTAINER_DIR)/app/frontend/distribution/dist/
	rsync -a --exclude='assets/material' $(DISTADMIN_FRONTEND_DIR)/dist/ $(DEPLOY_DIST_CONTAINER_DIR)/app/frontend/distadmin/dist/
	ENV_SRC=""; \
	if [ -f $(DEPLOY_DIST_ENV_DEV) ]; then \
		ENV_SRC="$(DEPLOY_DIST_ENV_DEV)"; \
	elif [ -f $(DEPLOY_DIST_ENV_DEV_TEMPLATE) ]; then \
		ENV_SRC="$(DEPLOY_DIST_ENV_DEV_TEMPLATE)"; \
	fi; \
	if [ -n "$$ENV_SRC" ]; then \
		cp "$$ENV_SRC" $(DEPLOY_DIST_CONTAINER_DIR)/.env; \
		echo "Loaded dist deployment env from $$ENV_SRC"; \
	elif [ -f $(DEPLOY_DIST_CONTAINER_DIR)/.env.example ]; then \
		cp $(DEPLOY_DIST_CONTAINER_DIR)/.env.example $(DEPLOY_DIST_CONTAINER_DIR)/.env; \
		echo "No dist .env.dev found, using template defaults"; \
	fi
	rm -f $(DEPLOY_DIST_CONTAINER_DIR)/.env.example
	rm -f $(DEPLOY_DIST_CONTAINER_DIR)/.env.dev
	chmod +x $(DEPLOY_DIST_CONTAINER_DIR)/scripts/entrypoint.sh
	chmod +x $(DEPLOY_DIST_CONTAINER_DIR)/scripts/setup_database.sh
	@echo "Dist deployment bundle ready at $(DEPLOY_DIST_CONTAINER_DIR)"

deploy-dist: build-dist-backend build-distribution build-distadmin package-deploy-dist
	/home/st/Documents/coding/faeenv/distribute-env.sh

cont-org: deploy-org
	@echo "Bringing up org container..."
	cd $(DEPLOY_ORG_CONTAINER_DIR) && podman compose up -d --build --force-recreate

cont-dist: deploy-dist
	@echo "Bringing up dist container..."
	cd $(DEPLOY_DIST_CONTAINER_DIR) && podman compose up -d --build --force-recreate

cont: cont-org cont-dist

rsync-deploy: deploy-org deploy-dist
	@echo "Syncing deployment to $(DEPLOY_USER)@$(DEPLOY_HOST):$(DEPLOY_REMOTE_PATH)"
	rsync -avz --delete \
		--exclude='.env' \
		--exclude='*/.env' \
		deployment/ $(DEPLOY_USER)@$(DEPLOY_HOST):$(DEPLOY_REMOTE_PATH)/

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
	@echo "  make deploy-dist   - Build and package distbackend deployment bundle"
	@echo "  make rsync-deploy  - Build and rsync deployment/ to server (excludes .env files)"
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
