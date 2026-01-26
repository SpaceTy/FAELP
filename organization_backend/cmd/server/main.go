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
	"organization_backend/internal/service"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load failed: %v", err)
	}

	log.Printf("connecting to database")
	conn, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db open failed: %v", err)
	}
	if err := conn.Ping(); err != nil {
		log.Fatalf("db ping failed: %v", err)
	}
	log.Printf("database connection established")
	log.Printf("running migrations")
	if err := db.Migrate(context.Background(), conn); err != nil {
		log.Fatalf("db migrations failed: %v", err)
	}
	log.Printf("migrations complete")
	defer conn.Close()

	store := db.NewStore(conn)
	requestService := service.NewRequestService(store)
	notifier := db.NewNotifier(cfg.DatabaseURL)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := notifier.Start(ctx); err != nil {
		log.Fatalf("notifier start failed: %v", err)
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
