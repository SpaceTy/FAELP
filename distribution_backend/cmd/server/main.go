package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"distribution_backend/internal/auth"
	"distribution_backend/internal/client"
	"distribution_backend/internal/config"
	"distribution_backend/internal/db"
	"distribution_backend/internal/domain"
	"distribution_backend/internal/handlers"
	"distribution_backend/internal/socket"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config load failed: %v", err)
	}

	if err := cfg.Validate(); err != nil {
		log.Fatalf("config validation failed: %v", err)
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

	// Initialize admin user from config
	if err := initAdminUser(context.Background(), store, cfg.Admin); err != nil {
		log.Fatalf("failed to initialize admin user: %v", err)
	}

	// Initialize auth services
	jwtService := auth.NewJWTService(cfg.JWTSecret)
	authMiddleware := auth.NewMiddleware(jwtService)
	authHandler := handlers.NewAuthHandler(store, jwtService)

	// Initialize organization backend client (prefer Unix socket if configured)
	orgClient := client.NewOrgClient(cfg.OrgBackend.URL, cfg.OrgBackend.APIKey, cfg.OrgBackend.SocketPath)

	distributionCenterID, err := resolveDistributionCenterID(context.Background(), store, orgClient, cfg.DistributionCenterID, cfg.Internal.SocketPath)
	if err != nil {
		log.Printf("Failed to resolve distribution center ID: %v", err)
	}

	uploadsPath := cfg.UploadPath
	inventoryHandler := handlers.NewInventoryHandler(store, orgClient)
	requestsHandler := handlers.NewRequestsHandler(store, orgClient, distributionCenterID, uploadsPath)

	// Create cancellable context for background services
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize and start availability notifier if distribution center ID is configured
	var availabilityNotifier *db.AvailabilityNotifier
	if distributionCenterID != "" {
		availabilityNotifier = db.NewAvailabilityNotifier(cfg.DatabaseURL, orgClient, store, distributionCenterID)
		if err := availabilityNotifier.Start(ctx); err != nil {
			log.Printf("Failed to start availability notifier: %v", err)
		} else {
			log.Printf("Availability notifier started for distribution center: %s", distributionCenterID)
		}
	} else {
		log.Printf("Distribution center ID not configured, availability notifier disabled")
	}

	mux := http.NewServeMux()

	// Health check endpoint (public)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// Auth endpoints (public)
	mux.HandleFunc("POST /api/auth/login", authHandler.Login)

	// Current user endpoints (authenticated)
	mux.HandleFunc("GET /api/auth/me", authMiddleware.RequireAuth(authHandler.GetCurrentUser))
	mux.HandleFunc("PUT /api/auth/password", authMiddleware.RequireAuth(authHandler.UpdatePassword))

	// User management endpoints (admin only)
	mux.HandleFunc("GET /api/users", authMiddleware.RequireAdmin(authHandler.ListUsers))
	mux.HandleFunc("POST /api/users", authMiddleware.RequireAdmin(authHandler.CreateUser))
	mux.HandleFunc("GET /api/users/{id}", authMiddleware.RequireAdmin(authHandler.GetUser))
	mux.HandleFunc("DELETE /api/users/{id}", authMiddleware.RequireAdmin(authHandler.DeleteUser))
	mux.HandleFunc("PUT /api/users/{id}/password", authMiddleware.RequireAdmin(authHandler.ResetUserPassword))
	mux.HandleFunc("PUT /api/users/{id}/admin", authMiddleware.RequireAdmin(authHandler.SetUserAdmin))

	// Inventory endpoints (authenticated)
	mux.HandleFunc("POST /api/inventory", authMiddleware.RequireAuth(inventoryHandler.CreateMaterialInstance))
	mux.HandleFunc("GET /api/inventory", authMiddleware.RequireAuth(inventoryHandler.ListMaterialInstances))
	mux.HandleFunc("GET /api/inventory/export", authMiddleware.RequireAuth(inventoryHandler.ExportInventoryCSV))
	mux.HandleFunc("POST /api/inventory/import", authMiddleware.RequireAuth(inventoryHandler.ImportInventoryCSV))
	mux.HandleFunc("GET /api/inventory/code", authMiddleware.RequireAuth(inventoryHandler.GenerateMaterialCode))
	mux.HandleFunc("GET /api/inventory/{id}", authMiddleware.RequireAuth(inventoryHandler.GetMaterialInstance))
	mux.HandleFunc("PUT /api/inventory/{id}", authMiddleware.RequireAuth(inventoryHandler.UpdateMaterialInstance))
	mux.HandleFunc("DELETE /api/inventory/{id}", authMiddleware.RequireAuth(inventoryHandler.DeleteMaterialInstance))
	mux.HandleFunc("POST /api/inventory/{id}/assign", authMiddleware.RequireAuth(inventoryHandler.AssignToRequest))
	mux.HandleFunc("POST /api/inventory/{id}/release", authMiddleware.RequireAuth(inventoryHandler.ReleaseFromRequest))
	mux.HandleFunc("GET /api/inventory/summary", authMiddleware.RequireAuth(inventoryHandler.CountByTypeAndStatus))
	mux.HandleFunc("GET /api/inventory/available", authMiddleware.RequireAuth(inventoryHandler.GetAvailableByType))

	// Material types endpoint (fetches from organization backend)
	mux.HandleFunc("GET /api/material-types", authMiddleware.RequireAuth(inventoryHandler.GetMaterialTypes))
	mux.HandleFunc("GET /api/requests/incoming", authMiddleware.RequireAuth(requestsHandler.ListIncomingRequests))
	mux.HandleFunc("POST /api/requests/{id}/approve", authMiddleware.RequireAuth(requestsHandler.ApproveIncomingRequest))
	mux.HandleFunc("POST /api/requests/{id}/in-action", authMiddleware.RequireAuth(requestsHandler.MarkIncomingRequestInAction))
	mux.HandleFunc("POST /api/requests/{id}/cancel", authMiddleware.RequireAuth(requestsHandler.CancelAssignedIncomingRequest))
	mux.HandleFunc("POST /api/requests/{id}/archive", authMiddleware.RequireAuth(requestsHandler.ArchiveIncomingRequest))
	mux.HandleFunc("POST /api/requests/{id}/unarchive", authMiddleware.RequireAuth(requestsHandler.UnarchiveIncomingRequest))

	// Internal endpoint for org backend to get available material counts (Unix socket only, no auth needed)
	mux.HandleFunc("GET /internal/available-materials", inventoryHandler.GetAvailableMaterialCounts)

	// Static file serving for locally synced uploads
	_ = os.MkdirAll(uploadsPath, 0755)
	uploadsFS := http.FileServer(http.Dir(uploadsPath))
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", uploadsFS))

	// Mount distribution frontend at root if enabled
	if cfg.Frontend.Distribution.Enabled && cfg.Frontend.Distribution.Path != "" {
		spaHandler := handlers.NewSPAHandler(cfg.Frontend.Distribution.Path)
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/" ||
				!strings.HasPrefix(r.URL.Path, "/api/") &&
					!strings.HasPrefix(r.URL.Path, "/internal/") &&
					!strings.HasPrefix(r.URL.Path, "/uploads/") &&
					r.URL.Path != "/health" {
				spaHandler.ServeHTTP(w, r)
			} else {
				http.NotFound(w, r)
			}
		})
		log.Printf("distribution frontend served from %s", cfg.Frontend.Distribution.Path)
	}

	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Frontend.Distribution.Port),
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Start admin frontend server if enabled
	var adminServer *http.Server
	if cfg.Frontend.Admin.Enabled && cfg.Frontend.Admin.Port != 0 && cfg.Frontend.Admin.Path != "" {
		adminMux := http.NewServeMux()
		adminMux.Handle("/api/", mux)
		adminMux.Handle("/internal/", mux)
		adminMux.Handle("/uploads/", mux)
		adminMux.Handle("/health", mux)
		spaHandler := handlers.NewSPAHandler(cfg.Frontend.Admin.Path)
		adminMux.Handle("/", spaHandler)

		adminServer = &http.Server{
			Addr:              fmt.Sprintf(":%d", cfg.Frontend.Admin.Port),
			Handler:           adminMux,
			ReadHeaderTimeout: 5 * time.Second,
		}

		go func() {
			log.Printf("distadmin frontend listening on %s", adminServer.Addr)
			if err := adminServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Printf("admin server error: %v", err)
			}
		}()
	}

	// Start TCP listener (public)
	go func() {
		log.Printf("distribution backend listening on %s (TCP)", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

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

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

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

func resolveDistributionCenterID(ctx context.Context, store *db.Store, orgClient *client.OrgClient, configuredID, internalSocketPath string) (string, error) {
	if configuredID != "" {
		if err := store.SetDistributionCenterID(ctx, configuredID); err != nil {
			return "", err
		}
		return configuredID, nil
	}

	storedID, err := store.GetDistributionCenterID(ctx)
	if err == nil && storedID != "" {
		return storedID, nil
	}
	if err != nil && err != sql.ErrNoRows {
		return "", err
	}

	if orgClient == nil {
		return "", fmt.Errorf("organization backend client not configured")
	}
	if internalSocketPath == "" {
		return "", fmt.Errorf("internal socket path not configured")
	}

	var lastErr error
	for attempt := 1; attempt <= 10; attempt++ {
		center, registerErr := orgClient.RegisterDistBackend(ctx,
			"Auto-registered Distribution Center",
			"Co-located via Unix socket",
			internalSocketPath,
		)
		if registerErr == nil {
			if center.ID == "" {
				return "", fmt.Errorf("organization backend returned empty distribution center id")
			}
			if err := store.SetDistributionCenterID(ctx, center.ID); err != nil {
				return "", err
			}
			return center.ID, nil
		}
		lastErr = registerErr
		time.Sleep(1 * time.Second)
	}

	return "", fmt.Errorf("failed to register distribution center: %w", lastErr)
}

// initAdminUser ensures the admin user from config exists in the database
func initAdminUser(ctx context.Context, store *db.Store, adminCfg config.AdminConfig) error {
	// Check if admin user already exists
	_, err := store.GetUserByUsername(ctx, adminCfg.Username)
	if err == nil {
		log.Printf("admin user '%s' already exists", adminCfg.Username)
		return nil
	}
	if err != sql.ErrNoRows {
		return err
	}

	// Create admin user
	passwordHash, err := auth.HashPassword(adminCfg.Password)
	if err != nil {
		return err
	}

	_, err = store.CreateUser(ctx, domain.CreateUserInput{
		Username:     adminCfg.Username,
		PasswordHash: passwordHash,
		IsAdmin:      true,
	})
	if err != nil {
		return err
	}

	log.Printf("admin user '%s' created successfully", adminCfg.Username)
	return nil
}
