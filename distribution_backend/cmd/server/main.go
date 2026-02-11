package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"distribution_backend/internal/auth"
	"distribution_backend/internal/client"
	"distribution_backend/internal/config"
	"distribution_backend/internal/db"
	"distribution_backend/internal/domain"
	"distribution_backend/internal/handlers"
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

	// Initialize organization backend client
	orgClient := client.NewOrgClient(cfg.OrganizationBackendURL, cfg.OrganizationBackendAPIKey)
	inventoryHandler := handlers.NewInventoryHandler(store, orgClient)

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
	mux.HandleFunc("GET /api/inventory/{id}", authMiddleware.RequireAuth(inventoryHandler.GetMaterialInstance))
	mux.HandleFunc("PUT /api/inventory/{id}", authMiddleware.RequireAuth(inventoryHandler.UpdateMaterialInstance))
	mux.HandleFunc("DELETE /api/inventory/{id}", authMiddleware.RequireAuth(inventoryHandler.DeleteMaterialInstance))
	mux.HandleFunc("POST /api/inventory/{id}/assign", authMiddleware.RequireAuth(inventoryHandler.AssignToRequest))
	mux.HandleFunc("POST /api/inventory/{id}/release", authMiddleware.RequireAuth(inventoryHandler.ReleaseFromRequest))
	mux.HandleFunc("GET /api/inventory/summary", authMiddleware.RequireAuth(inventoryHandler.CountByTypeAndStatus))
	mux.HandleFunc("GET /api/inventory/available", authMiddleware.RequireAuth(inventoryHandler.GetAvailableByType))

	// Material types endpoint (fetches from organization backend)
	mux.HandleFunc("GET /api/material-types", authMiddleware.RequireAuth(inventoryHandler.GetMaterialTypes))

	server := &http.Server{
		Addr:              ":8081",
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("distribution backend listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
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
