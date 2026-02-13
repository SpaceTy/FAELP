package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"organization_backend/internal/api"
	"organization_backend/internal/auth"
	"organization_backend/internal/client"
	"organization_backend/internal/config"
	"organization_backend/internal/db"
	"organization_backend/internal/socket"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load failed: %v", err)
	}

	// Initialize WorkOS
	auth.InitWorkOS(cfg.WorkOSAPIKey, cfg.WorkOSClientID)

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
	materialNotifier := db.NewMaterialNotifier(cfg.DatabaseURL)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := materialNotifier.Start(ctx); err != nil {
		log.Fatalf("material notifier start failed: %v", err)
	}

	handler := &api.Handler{
		Store:            store,
		MaterialNotifier: materialNotifier,
	}

	authHandler := &api.AuthHandler{
		Store:     store,
		JWTSecret: cfg.JWTSecret,
	}

	// Initialize distribution backend client for fetching material availability
	distClient := client.NewDistClient(cfg.DistBackend.SocketPath)

	materialTypeHandler := &api.MaterialTypeHandler{
		Store:      store,
		UploadPath: "uploads",
		DistClient: distClient,
		SocketPath: cfg.DistBackend.SocketPath,
	}

	uploadHandler := &api.UploadHandler{
		Store:      store,
		UploadPath: "uploads",
	}

	dcHandler := &api.DistributionCenterHandler{
		Store: store,
	}

	requestHandler := &api.RequestHandler{
		Store: store,
	}

	router := api.Routes(handler, authHandler, materialTypeHandler, uploadHandler, dcHandler, requestHandler, cfg.JWTSecret)

	// Mount user frontend at root if enabled (must be after API routes)
	if cfg.Frontend.User.Enabled && cfg.Frontend.User.Path != "" {
		spaHandler := api.NewSPAHandler(cfg.Frontend.User.Path)
		router.Get("/*", spaHandler.ServeHTTP)
		log.Printf("user frontend served from %s", cfg.Frontend.User.Path)
	}

	server := &http.Server{
		Addr:              ":8080",
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Start TCP listener (public)
	go func() {
		log.Printf("org backend listening on %s (TCP)", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	// Start admin frontend server if enabled
	var adminServer *http.Server
	if cfg.Frontend.Admin.Enabled && cfg.Frontend.Admin.Port != 0 && cfg.Frontend.Admin.Path != "" {
		adminRouter := chi.NewRouter()
		adminRouter.Use(api.CORS)
		adminRouter.Handle("/api/*", router)
		adminRouter.Handle("/internal/*", router)
		adminRouter.Handle("/uploads/*", router)
		adminRouter.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"status":"ok"}`))
		})
		spaHandler := api.NewSPAHandler(cfg.Frontend.Admin.Path)
		adminRouter.Get("/*", spaHandler.ServeHTTP)

		adminServer = &http.Server{
			Addr:              fmt.Sprintf(":%d", cfg.Frontend.Admin.Port),
			Handler:           adminRouter,
			ReadHeaderTimeout: 5 * time.Second,
		}

		go func() {
			log.Printf("orgadmin frontend listening on %s", adminServer.Addr)
			if err := adminServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Printf("admin server error: %v", err)
			}
		}()
	}

	// Start Unix socket listener (internal) if enabled
	if cfg.Internal.SocketEnabled && cfg.Internal.SocketPath != "" {
		go func() {
			listener, err := socket.Listen(cfg.Internal.SocketPath)
			if err != nil {
				log.Printf("Failed to create Unix socket: %v", err)
				return
			}
			defer listener.Close()

			log.Printf("internal communication on %s (Unix socket)", cfg.Internal.SocketPath)
			if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
				log.Printf("Unix socket server error: %v", err)
			}
		}()
	}

	// Auto-detect and register co-located distribution backends
	if cfg.DistBackend.SocketPath != "" {
		go func() {
			// Wait a moment for the dist backend to start its socket
			time.Sleep(2 * time.Second)
			if err := autoRegisterDistBackend(context.Background(), store, cfg.DistBackend.SocketPath); err != nil {
				log.Printf("Auto-registration of dist backend skipped: %v", err)
			}
		}()
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	if adminServer != nil {
		if err := adminServer.Shutdown(shutdownCtx); err != nil {
			log.Printf("admin server shutdown error: %v", err)
		}
	}
}

// autoRegisterDistBackend attempts to connect to a co-located dist backend and register it
func autoRegisterDistBackend(ctx context.Context, store *db.Store, socketPath string) error {
	// Check if already registered
	_, err := store.GetDistributionCenterBySocketPath(ctx, socketPath)
	if err == nil {
		log.Printf("Distribution backend already registered for socket: %s", socketPath)
		return nil
	}

	// Try to connect to the dist backend via Unix socket to verify it's there
	distClient := client.NewDistClient(socketPath)
	_, err = distClient.GetAvailableMaterials(ctx)
	if err != nil {
		return fmt.Errorf("dist backend not available at %s: %w", socketPath, err)
	}

	// Register the dist backend with a generated ID
	center, err := store.CreateDistributionCenterWithSocket(ctx,
		"Auto-registered Distribution Center",
		"Co-located via Unix socket",
		socketPath,
	)
	if err != nil {
		return fmt.Errorf("failed to register dist backend: %w", err)
	}

	log.Printf("Auto-registered distribution backend with ID: %s", center.ID)
	return nil
}
