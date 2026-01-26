package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"organization_backend/internal/api"
	"organization_backend/internal/config"
	"organization_backend/internal/db"
	"organization_backend/internal/domain"
	"organization_backend/internal/service"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load failed: %v", err)
	}

	log.Printf("initializing database (mode: %s)", cfg.DatabaseMode)

	var store interface {
		CreateRequest(context.Context, db.CreateRequestInput) (domain.Request, error)
		GetRequestByID(context.Context, string) (domain.Request, error)
		ListRequests(context.Context, db.ListRequestsParams) (db.ListRequestsResult, error)
		Close() error
	}

	// Use middleware-based store
	middlewareStore, err := db.NewMiddlewareStore(cfg)
	if err != nil {
		log.Fatalf("failed to initialize database: %v", err)
	}
	store = middlewareStore
	defer store.Close()

	log.Printf("database initialized successfully")
	requestService := service.NewRequestService(store)

	// Notifier only works with PostgreSQL
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var notifier *db.Notifier
	if cfg.DatabaseMode == "postgresql" && cfg.DatabaseURL != "" {
		notifier = db.NewNotifier(cfg.DatabaseURL)
		if err := notifier.Start(ctx); err != nil {
			log.Printf("warning: notifier start failed: %v", err)
		}
	} else {
		log.Printf("notifier disabled (only available in PostgreSQL mode)")
	}

	handler := &api.Handler{
		Service:  requestService,
		Store:    store,
		Notifier: notifier,
	}

	router := api.Routes(handler)

	server := &http.Server{
		Addr:              ":8080",
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("org backend listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
