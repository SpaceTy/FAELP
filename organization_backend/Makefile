APP_NAME=orgbackend
CMD_PATH=./cmd/server
USER_FRONTEND_PATH=../frontend/user

.PHONY: build run test tidy dev-all dev-frontend

build:
	go build -o bin/$(APP_NAME) $(CMD_PATH)

run:
	go run $(CMD_PATH)

test:
	go test ./...

tidy:
	go mod tidy

# Run both backend and user frontend concurrently (development)
dev-all:
	@echo "Starting backend and user frontend..."
	@(trap 'kill 0' SIGINT; go run $(CMD_PATH) & make dev-frontend & wait)

# Run only the user frontend (development)
dev-frontend:
	cd $(USER_FRONTEND_PATH) && npm run dev
