APP_NAME=orgbackend
CMD_PATH=./cmd/server
USER_FRONTEND_PATH=../frontend/user

.PHONY: build run test tidy dev-all dev-frontend build-frontend install-frontend

# Backend targets
build:
	go build -o bin/$(APP_NAME) $(CMD_PATH)

run:
	go run $(CMD_PATH)

test:
	go test ./...

tidy:
	go mod tidy

# Frontend targets
install-frontend:
	cd $(USER_FRONTEND_PATH) && npm install

build-frontend:
	cd $(USER_FRONTEND_PATH) && npm run build

run-frontend:
	cd $(USER_FRONTEND_PATH) && npm run dev

preview-frontend:
	cd $(USER_FRONTEND_PATH) && npm run preview

# Combined development targets
dev-frontend:
	cd $(USER_FRONTEND_PATH) && npm run dev

# Run both backend and user frontend concurrently (development)
dev-all:
	@echo "Starting backend and user frontend..."
	@(trap 'kill 0' SIGINT; go run $(CMD_PATH) & make dev-frontend & wait)

# Build both backend and frontend
build-all: build build-frontend

# Full setup: install frontend dependencies, tidy go modules
setup: tidy install-frontend

# Clean build artifacts
clean:
	rm -rf bin/
	rm -rf $(USER_FRONTEND_PATH)/dist/ $(USER_FRONTEND_PATH)/node_modules/ .vite/ 2>/dev/null || true

# Help target
help:
	@echo "Available targets:"
	@echo "  Backend:"
	@echo "    build          - Build the backend binary"
	@echo "    run            - Run the backend server"
	@echo "    test           - Run Go tests"
	@echo "    tidy           - Run go mod tidy"
	@echo ""
	@echo "  Frontend:"
	@echo "    install-frontend   - Install frontend npm dependencies"
	@echo "    build-frontend     - Build the frontend for production"
	@echo "    run-frontend       - Run frontend dev server (alias: dev-frontend)"
	@echo "    preview-frontend   - Preview the built frontend"
	@echo ""
	@echo "  Combined:"
	@echo "    dev-all        - Run backend and frontend concurrently (development)"
	@echo "    build-all      - Build both backend and frontend"
	@echo "    setup          - Setup project (tidy + install-frontend)"
	@echo "    clean          - Remove build artifacts and dependencies"
