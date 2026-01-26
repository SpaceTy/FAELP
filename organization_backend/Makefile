APP_NAME=orgbackend
CMD_PATH=./cmd/server

.PHONY: build run test tidy

build:
	go build -o bin/$(APP_NAME) $(CMD_PATH)

run:
	go run $(CMD_PATH)

test:
	go test ./...

tidy:
	go mod tidy
