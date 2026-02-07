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
	"distribution_backend/internal/config"
	"distribution_backend/internal/db"
	"distribution_backend/internal/domain"
	"distribution_backend/internal/handlers"
	"distribution_backend/internal/interbackend"
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

	if err := initAdminUser(context.Background(), store, cfg.Admin); err != nil {
		log.Fatalf("failed to initialize admin user: %v", err)
	}

	jwtService := auth.NewJWTService(cfg.JWTSecret)
	authMiddleware := auth.NewMiddleware(jwtService)
	authHandler := handlers.NewAuthHandler(store, jwtService)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ibManager := interbackend.NewManager(store, cfg)
	if err := ibManager.Start(ctx); err != nil {
		log.Fatalf("failed to start interbackend manager: %v", err)
	}
	ibHandler := handlers.NewInterbackendHandler(store, ibManager, cfg.OrgJWTSecret)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	mux.HandleFunc("POST /api/auth/login", authHandler.Login)
	mux.HandleFunc("GET /api/auth/me", authMiddleware.RequireAuth(authHandler.GetCurrentUser))
	mux.HandleFunc("PUT /api/auth/password", authMiddleware.RequireAuth(authHandler.UpdatePassword))

	mux.HandleFunc("GET /api/users", authMiddleware.RequireAdmin(authHandler.ListUsers))
	mux.HandleFunc("POST /api/users", authMiddleware.RequireAdmin(authHandler.CreateUser))
	mux.HandleFunc("GET /api/users/{id}", authMiddleware.RequireAdmin(authHandler.GetUser))
	mux.HandleFunc("DELETE /api/users/{id}", authMiddleware.RequireAdmin(authHandler.DeleteUser))
	mux.HandleFunc("PUT /api/users/{id}/password", authMiddleware.RequireAdmin(authHandler.ResetUserPassword))
	mux.HandleFunc("PUT /api/users/{id}/admin", authMiddleware.RequireAdmin(authHandler.SetUserAdmin))

	mux.HandleFunc("GET /api/inventory/summary", authMiddleware.RequireAuth(func(w http.ResponseWriter, r *http.Request) {
		summary, err := store.CountByTypeAndStatus(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(summary)
	}))

	mux.HandleFunc("GET /api/interbackend/inventory/export", ibHandler.ExportInventory)
	mux.HandleFunc("GET /api/interbackend/link/status", authMiddleware.RequireAdmin(ibHandler.LinkStatus))

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
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}

func initAdminUser(ctx context.Context, store *db.Store, adminCfg config.AdminConfig) error {
	_, err := store.GetUserByUsername(ctx, adminCfg.Username)
	if err == nil {
		log.Printf("admin user '%s' already exists", adminCfg.Username)
		return nil
	}
	if err != sql.ErrNoRows {
		return err
	}

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
