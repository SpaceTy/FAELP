APP_NAME=distbackend
CMD_PATH=./cmd/server

.PHONY: build run test tidy setup clean help

# Backend targets
build:
	go build -o bin/$(APP_NAME) $(CMD_PATH)

run:
	go run $(CMD_PATH)

test:
	go test ./...

tidy:
	go mod tidy

# Database setup
setup-db:
	./scripts/setup_database.sh

# Full setup: tidy go modules
setup: tidy

# Clean build artifacts
clean:
	rm -rf bin/

# Help target
help:
	@echo "Available targets:"
	@echo "  Backend:"
	@echo "    build          - Build the backend binary"
	@echo "    run            - Run the backend server"
	@echo "    test           - Run Go tests"
	@echo "    tidy           - Run go mod tidy"
	@echo ""
	@echo "  Database:"
	@echo "    setup-db       - Run database setup script"
	@echo ""
	@echo "  Combined:"
	@echo "    setup          - Setup project (tidy)"
	@echo "    clean          - Remove build artifacts"
